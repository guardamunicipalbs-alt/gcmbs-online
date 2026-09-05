import postgres from 'npm:postgres@3.4.7';
import { createHash } from 'node:crypto';

const db=postgres(Deno.env.get('SUPABASE_DB_URL'),{prepare:false,max:1});
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,authorization',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:cors});
const norm=v=>String(v??'').trim();
const sha=v=>createHash('sha256').update(v).digest('hex');
const rank={CONSULTA:1,EDICAO:2};

function roleOf(u){
  const r=norm(u?.role).toLowerCase(),c=norm(u?.cargo).toUpperCase();
  if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return'comandante';
  if(r==='subcomandante'||/\bSUBCOMANDANTE\b/.test(c))return'subcomandante';
  return r||'gcm';
}
function total(u){return Boolean(u?.controle_total)||roleOf(u)==='comandante'}
async function can(u,modulo,nivel='CONSULTA'){
  if(total(u))return true;
  const rows=await db`select upper(nivel) nivel from public.mobile_permissions where guarda_id=${Number(u.guarda_id)} and ativo=true and modulo in (${modulo},'*')`;
  return rows.some(x=>(rank[String(x.nivel).toUpperCase()]||0)>=(rank[nivel]||1));
}
async function user(req){
  const h=req.headers.get('authorization')||'',t=h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():'';
  if(!t)return null;
  const r=await db`select s.guarda_id,s.desktop_usuario_id,p.nome_guerra,p.nome_completo,p.role,p.cargo,p.controle_total
    from private.mobile_sessions s
    join private.mobile_auth_accounts a on a.desktop_usuario_id=s.desktop_usuario_id and a.ativo=true
    join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true
    where s.token_sha256=${sha(t)} and s.revoked=false and s.expires_at>now() limit 1`;
  return r[0]||null;
}
async function profileName(id){
  const p=(await db`select nome_guerra,nome_completo from public.mobile_profiles where guarda_id=${Number(id)} and ativo=true limit 1`)[0];
  return norm(p?.nome_guerra||p?.nome_completo)||`GCM ${id}`;
}
async function activeProfile(id){
  const p=(await db`select guarda_id from public.mobile_profiles where guarda_id=${Number(id)} and ativo=true limit 1`)[0];
  return Boolean(p);
}
async function note(gid,tipo,titulo,msg,id,data,key){
  await db`insert into public.mobile_notifications(
    guarda_id,tipo,titulo,mensagem,referencia_tipo,referencia_id,data_evento,dedupe_key
  ) values(${gid},${tipo},${titulo},${msg},'PERMUTA_SOLICITADA',${id},${data||null},${key})
    on conflict(dedupe_key) do nothing`;
}
function tipoExtra(v){return norm(v).toUpperCase()==='EVENTO'?'EVENTO':'MANUAL'}
function minutos(a,b){
  const [ah,am]=norm(a).slice(0,5).split(':').map(Number),[bh,bm]=norm(b).slice(0,5).split(':').map(Number);
  let x=(bh*60+bm)-(ah*60+am);if(!Number.isFinite(x))return 0;if(x<=0)x+=1440;return x;
}
async function classe(data){
  const d=new Date(`${data}T12:00:00-03:00`);if(d.getDay()===0)return'100';
  const fer=await db`select 1 from public.mobile_entity_records
    where entity='feriados' and deleted=false
      and left(coalesce(data->>'data',data->>'data_feriado'),10)=${data} limit 1`;
  return fer.length?'100':'50';
}
async function extraRef(tipo,id,guardaId){
  const t=tipoExtra(tipo);
  if(t==='MANUAL'){
    const e=(await db`select data from public.mobile_entity_records
      where entity='escalas_extras_manuais' and deleted=false and (data->>'id')::bigint=${Number(id)} limit 1`)[0]?.data||null;
    if(!e||['CANCELADA','CANCELADO','EXCLUIDA','EXCLUÍDA','INATIVA'].includes(norm(e.status||'ATIVA').toUpperCase()))return null;
    if(Number(e.guarda_id)!==Number(guardaId))return null;
    const data=String(e.data||'').slice(0,10);
    return {...e,id:Number(e.id),servico_id:Number(e.id),extra_tipo:'MANUAL',descricao:norm(e.posto)||'Escala Extra Manual',
      minutos:minutos(e.horario_inicio,e.horario_fim),classe:await classe(data),data,
      horario_inicio:norm(e.horario_inicio).slice(0,5),horario_fim:norm(e.horario_fim).slice(0,5)};
  }
  const e=(await db`select data from public.mobile_entity_records
    where entity='eventos_extras' and deleted=false and (data->>'id')::bigint=${Number(id)} limit 1`)[0]?.data||null;
  if(!e||norm(e.status||'ATIVO').toUpperCase()!=='ATIVO')return null;
  const ps=(await db`select data from public.mobile_entity_records where entity='eventos_extras_participantes' and deleted=false`).map(x=>x.data||{})
    .filter(p=>Number(p.evento_id)===Number(id)&&Number(p.guarda_id)===Number(guardaId)&&
      norm(p.tipo_participacao||'EXTRA').toUpperCase()==='EXTRA'&&Number(p.minutos_extra||0)>0);
  if(!ps.length)return null;
  const data=String(e.data||'').slice(0,10);
  return {...e,id:Number(e.id),servico_id:Number(e.id),guarda_id:Number(guardaId),extra_tipo:'EVENTO',
    descricao:norm(e.nome||e.local)||'Serviço Extra por Evento',evento_nome:norm(e.nome),evento_local:norm(e.local),
    minutos:ps.reduce((a,p)=>a+Number(p.minutos_extra||0),0),classe:await classe(data),data,
    horario_inicio:norm(e.horario_inicio).slice(0,5),horario_fim:norm(e.horario_fim).slice(0,5)};
}
function turnoCompativel(valor,turno){
  const v=norm(valor).toUpperCase(),t=norm(turno).toUpperCase();
  if(t==='COMPLETO')return ['A','B','COMPLETO','24H','24'].includes(v);
  return v===t||v==='COMPLETO'||v==='24H'||v==='24';
}
async function ordinaryService(guardaId,data,turno){
  const rows=(await db`select data from public.mobile_entity_records where entity='escalas' and deleted=false`).map(x=>x.data||{});
  const eleg=rows.filter(x=>Number(x.guarda_id)===Number(guardaId)&&String(x.data||'').slice(0,10)===data&&
    !['CANCELADA','CANCELADO','EXCLUIDA','EXCLUÍDA','INATIVA'].includes(norm(x.status||'ATIVA').toUpperCase())&&
    norm(x.origem).toUpperCase()!=='GERADOR_AUTOMATICO_EXTRA'&&turnoCompativel(x.turno,turno));
  if(!eleg.length)return null;
  return eleg.sort((a,b)=>Number(a.id||0)-Number(b.id||0))[0];
}
async function temJustificativa(guardaId,data,tipo){
  const j=(await db`select data from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false`).map(x=>x.data||{});
  return j.some(x=>Number(x.guarda_id)===Number(guardaId)&&norm(x.status||'ATIVA').toUpperCase()!=='CANCELADA'&&
    norm(x.tipo_servico||'ORDINARIO').toUpperCase()===tipo&&String(x.data_inicial||'')<=data&&String(x.data_final||x.data_inicial||'')>=data);
}

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
  try{
    const u=await user(req);if(!u)return reply(401,{message:'Sessão não autenticada ou expirada.'});
    if(!(await can(u,'permutas','EDICAO')))return reply(403,{message:'Sem permissão para solicitar ou responder permuta.'});
    const body=await req.json().catch(()=>({})),action=norm(body.action).toLowerCase(),gid=Number(u.guarda_id);

    if(action==='request_mixed_swap'){
      const q=body.request||{},data=String(q.data||'').slice(0,10),turno=norm(q.turno).toUpperCase(),eid=Number(q.extra_id||0),tipo=tipoExtra(q.extra_tipo||q.extra_tipo_origem),donoExtra=Number(q.extra_guarda_id||0),extraDataInformada=String(q.extra_data||'').slice(0,10);
      if(!q.concordou_termo||!/^\d{4}-\d{2}-\d{2}$/.test(data)||!['A','B','COMPLETO'].includes(turno)||!eid||!donoExtra||donoExtra===gid)
        return reply(400,{message:'Informe seu serviço ordinário, o serviço extra de outro GCM e aceite o termo.'});
      const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
      if(data<hoje)return reply(400,{message:'Serviço ordinário já ocorrido não pode ser usado em nova troca.'});
      const ordin=await ordinaryService(gid,data,turno);
      if(!ordin)return reply(400,{message:'Você não possui serviço ordinário ativo nesse período. Apenas seu próprio serviço ordinário pode ser oferecido.'});
      const extra=await extraRef(tipo,eid,donoExtra);
      if(!extra)return reply(404,{message:'O serviço extra selecionado não está mais ativo para o GCM informado.'});
      if(String(extra.data||'')<hoje)return reply(400,{message:'Serviço extra já ocorrido não pode ser usado em nova troca.'});
      if(extraDataInformada&&String(extra.data)!==extraDataInformada)return reply(400,{message:'O serviço extra selecionado não corresponde à data informada.'});
      if(!(await activeProfile(donoExtra)))return reply(400,{message:'O GCM titular do serviço extra não está ativo.'});
      if(await temJustificativa(gid,String(extra.data),'EXTRA'))return reply(400,{message:'Você possui justificativa vigente para serviço extra na data que receberia.'});
      if(await temJustificativa(donoExtra,data,'ORDINARIO'))return reply(400,{message:'O outro GCM possui justificativa vigente na data do seu serviço ordinário.'});

      const dup=await db`select id from public.mobile_action_requests where tipo='PERMUTA' and guarda_id=${gid}
        and status in ('AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP','ACEITE_PENDENTE_DESKTOP')
        and upper(coalesce(payload->>'modalidade',''))='TROCA_ORDINARIO_EXTRA'
        and ((left(coalesce(payload->>'data',''),10)=${data} and upper(coalesce(payload->>'turno',''))=${turno})
          or (nullif(payload->>'extra_id','')::bigint=${eid} and upper(coalesce(payload->>'extra_tipo_origem',payload->>'extra_tipo','MANUAL'))=${tipo})) limit 1`;
      if(dup.length)return reply(409,{message:'Seu ordinário ou o extra selecionado já participa de uma troca pendente.'});

      const payload={modalidade:'TROCA_ORDINARIO_EXTRA',data,turno,servico_extra:1,
        substituido_id:gid,substituto_id:donoExtra,solicitante_id:gid,contraparte_id:donoExtra,
        escala_id:Number(ordin.id||0)||null,extra_id:eid,extra_tipo:tipo,extra_tipo_origem:tipo,extra_guarda_id:donoExtra,extra_data:String(extra.data),
        concordou_termo:true,observacao:norm(q.observacao),financeiro_neutro:1,aceite_contraparte:0,
        classe_extra_origem:String(extra.classe||'50'),minutos_extra_origem:Number(extra.minutos||0),competencia_origem:String(extra.data).slice(0,7),competencia_contrapartida:data.slice(0,7),
        extra_origem:{id:eid,tipo,guarda_id:donoExtra,descricao:extra.descricao,data:extra.data,horario_inicio:extra.horario_inicio,horario_fim:extra.horario_fim,classe:String(extra.classe||'50'),minutos:Number(extra.minutos||0)}};
      const r=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload,status,resposta)
        values(${gid},'PERMUTA',${db.json(payload)},'AGUARDANDO_ACEITE','Aguardando aceite do titular do serviço extra.') returning id,status,created_at`;
      const nome=norm(u.nome_guerra||u.nome_completo)||'GCM',rot=tipo==='EVENTO'?'Extra por Evento':'Extra Manual';
      const msg=`${nome} propôs uma troca operacional: ele executa [${rot}] ${norm(extra.descricao)} de ${extra.data} (${extra.horario_inicio}–${extra.horario_fim}) e você executa o ordinário dele em ${data}, turno ${turno}. O crédito financeiro do extra permanece com você; não há transferência ou compensação de horas/50%/100%. Autorize ou recuse.`;
      await note(donoExtra,'PERMUTA_TROCA_ORDINARIO_EXTRA','Troca ordinário por extra',msg,Number(r[0].id),data,`mixed-swap:${r[0].id}:${donoExtra}`);
      return reply(200,{success:true,request:r[0],message:'Troca enviada ao titular do extra para aceite antes da análise do Comando.',warning:'Operação financeiramente neutra: o crédito do extra permanece com o titular original.'});
    }

    if(action==='accept_mixed'){
      const id=Number(body.id||0),ok=Boolean(body.aceitou);
      const r=(await db`select * from public.mobile_action_requests where id=${id} and tipo='PERMUTA' limit 1`)[0];
      if(!r)return reply(404,{message:'Solicitação não encontrada.'});
      const p=r.payload||{},modalidade=norm(p.modalidade).toUpperCase();
      if(modalidade!=='TROCA_ORDINARIO_EXTRA'||Number(p.contraparte_id)!==gid)return reply(403,{message:'Esta troca não está aguardando seu aceite.'});
      if(!['AGUARDANDO_ACEITE','PENDENTE'].includes(norm(r.status).toUpperCase()))return reply(400,{message:'Esta solicitação já foi processada.'});
      if(!ok){
        const np={...p,aceite_contraparte:0,aceite_em:new Date().toISOString(),aceite_por:gid};
        await db`update public.mobile_action_requests set status='RECUSADA',resposta='Troca ordinário ↔ extra recusada pelo titular do extra.',processado_em=now(),payload=${db.json(np)} where id=${id}`;
        await note(Number(r.guarda_id),'PERMUTA_TROCA_MISTA_RECUSADA','Troca recusada',`${await profileName(gid)} recusou a troca ordinário ↔ extra.`,id,String(p.data||''),`mixed-reject:${id}:${r.guarda_id}`);
        return reply(200,{success:true,status:'RECUSADA'});
      }
      const np={...p,aceite_contraparte:1,aceite_por:gid,aceite_em:new Date().toISOString()};
      await db`update public.mobile_action_requests set status='PENDENTE_DESKTOP',resposta='Troca aceita pelo titular do extra. Aguardando análise do Comando.',processado_em=null,payload=${db.json(np)} where id=${id}`;
      await db`insert into public.mobile_action_requests(guarda_id,tipo,payload) values(${gid},'PERMUTA_ACEITE_EXTRA',${db.json({request_id:id,aceitou:true,modalidade:'TROCA_ORDINARIO_EXTRA',contraparte_id:gid})})`;
      await note(Number(r.guarda_id),'PERMUTA_TROCA_MISTA_ACEITA','Troca aceita',`${await profileName(gid)} aceitou a troca ordinário ↔ extra. A solicitação seguirá ao Comando. O crédito financeiro do extra permanece com o titular original.`,id,String(p.data||''),`mixed-accept:${id}:${r.guarda_id}`);
      return reply(200,{success:true,status:'PENDENTE_DESKTOP',message:'Aceite registrado. Aguardando análise do Comando.'});
    }

    return reply(404,{message:'Ação de troca ordinário ↔ extra 10.0.71 não encontrada.'});
  }catch(e){
    console.error('[gcmbs-mixed-permuta-v71]',e);
    return reply(500,{message:e instanceof Error?e.message:'Erro interno.'});
  }
});
