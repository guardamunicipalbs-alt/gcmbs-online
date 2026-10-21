import postgres from 'npm:postgres@3.4.7';
import { createHash } from 'node:crypto';

const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1});
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,authorization',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};
const reply=(s:number,b:any)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const norm=(v:any)=>String(v??'').trim();
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const rank:any={CONSULTA:1,EDICAO:2};

function roleOf(u:any){
  const r=norm(u?.role).toLowerCase(),c=norm(u?.cargo).toUpperCase();
  if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return'comandante';
  if(r==='subcomandante'||/\bSUBCOMANDANTE\b/.test(c))return'subcomandante';
  return r||'gcm';
}
function total(u:any){return Boolean(u?.controle_total)||roleOf(u)==='comandante'}
async function can(u:any,m:string,n='CONSULTA'){
  if(total(u))return true;
  const rows=await db`select upper(nivel) nivel from public.mobile_permissions where guarda_id=${Number(u.guarda_id)} and ativo=true and modulo in (${m},'*')`;
  return rows.some((x:any)=>(rank[String(x.nivel).toUpperCase()]||0)>=(rank[n]||1));
}
async function user(req:Request){
  const h=req.headers.get('authorization')||'',t=h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():'';
  if(!t)return null;
  const r=await db`select s.guarda_id,s.desktop_usuario_id,p.nome_guerra,p.nome_completo,p.role,p.cargo,p.controle_total
    from private.mobile_sessions s
    join private.mobile_auth_accounts a on a.desktop_usuario_id=s.desktop_usuario_id and a.ativo=true
    join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true
    where s.token_sha256=${sha(t)} and s.revoked=false and s.expires_at>now() limit 1`;
  return r[0]||null;
}
async function profileName(id:number){
  const p=(await db`select nome_guerra,nome_completo from public.mobile_profiles where guarda_id=${id} and ativo=true limit 1`)[0];
  return norm(p?.nome_guerra||p?.nome_completo)||`GCM ${id}`;
}
async function note(gid:number,tipo:string,titulo:string,msg:string,id:number,data:string,key:string){
  await db`insert into public.mobile_notifications(
    guarda_id,tipo,titulo,mensagem,referencia_tipo,referencia_id,data_evento,dedupe_key
  ) values(${gid},${tipo},${titulo},${msg},'PERMUTA_SOLICITADA',${id},${data||null},${key})
    on conflict(dedupe_key) do nothing`;
}
function tipoExtra(v:any){return norm(v).toUpperCase()==='EVENTO'?'EVENTO':'MANUAL'}
function minutos(a:any,b:any){
  const [ah,am]=norm(a).slice(0,5).split(':').map(Number),[bh,bm]=norm(b).slice(0,5).split(':').map(Number);
  let x=(bh*60+bm)-(ah*60+am);if(!Number.isFinite(x))return 0;if(x<=0)x+=1440;return x;
}
function turno(hi:any,hf:any){
  const k=`${norm(hi).slice(0,5)}|${norm(hf).slice(0,5)}`;
  const a=new Set(['07:00|13:00','13:00|19:00','07:00|19:00']);
  const b=new Set(['19:00|01:00','01:00|07:00','19:00|07:00']);
  const ab=new Set(['13:00|01:00','01:00|13:00','07:00|01:00','13:00|07:00','19:00|13:00','01:00|19:00','07:00|07:00']);
  if(ab.has(k))return'COMPLETO';if(a.has(k))return'A';if(b.has(k))return'B';return'COMPLETO';
}
async function classe(data:string){
  const d=new Date(`${data}T12:00:00-03:00`);if(d.getDay()===0)return'100';
  const fer=await db`select 1 from public.mobile_entity_records
    where entity='feriados' and deleted=false
      and left(coalesce(data->>'data',data->>'data_feriado'),10)=${data} limit 1`;
  return fer.length?'100':'50';
}
async function extrasPermutaveis(){
  const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
  const man=(await db`select data from public.mobile_entity_records where entity='escalas_extras_manuais' and deleted=false`)
    .map((x:any)=>x.data||{})
    .filter((x:any)=>!['CANCELADA','CANCELADO','EXCLUIDA','EXCLUÍDA','INATIVA'].includes(norm(x.status||'ATIVA').toUpperCase())&&String(x.data||'').slice(0,10)>=hoje);
  const evs=(await db`select data from public.mobile_entity_records where entity='eventos_extras' and deleted=false`)
    .map((x:any)=>x.data||{})
    .filter((e:any)=>norm(e.status||'ATIVO').toUpperCase()==='ATIVO'&&String(e.data||'').slice(0,10)>=hoje);
  const parts=(await db`select data from public.mobile_entity_records where entity='eventos_extras_participantes' and deleted=false`).map((x:any)=>x.data||{});
  const out:any[]=[];
  for(const x of man){
    const data=String(x.data||'').slice(0,10);
    out.push({...x,id:Number(x.id),servico_id:Number(x.id),extra_tipo:'MANUAL',tipo_rotulo:'Extra Manual',
      descricao:norm(x.posto)||'Escala Extra Manual',minutos:minutos(x.horario_inicio,x.horario_fim),
      classe:await classe(data),competencia:data.slice(0,7)});
  }
  for(const e of evs){
    const por=new Map<number,number>();
    for(const p of parts){
      if(Number(p.evento_id)!==Number(e.id)||norm(p.tipo_participacao||'EXTRA').toUpperCase()!=='EXTRA'||Number(p.minutos_extra||0)<=0)continue;
      const g=Number(p.guarda_id);if(g)por.set(g,(por.get(g)||0)+Number(p.minutos_extra||0));
    }
    for(const [g,m] of por){
      const data=String(e.data||'').slice(0,10);
      out.push({...e,id:Number(e.id),servico_id:Number(e.id),guarda_id:g,extra_tipo:'EVENTO',tipo_rotulo:'Extra por Evento',
        descricao:norm(e.nome||e.local)||'Serviço Extra por Evento',evento_nome:norm(e.nome),evento_local:norm(e.local),
        minutos:m,classe:await classe(data),competencia:data.slice(0,7)});
    }
  }
  return out.sort((x:any,y:any)=>String(x.data||'').localeCompare(String(y.data||''))||
    norm(x.horario_inicio).localeCompare(norm(y.horario_inicio))||
    norm(x.extra_tipo).localeCompare(norm(y.extra_tipo))||Number(x.id)-Number(y.id));
}
async function extraRef(tipo:any,id:number,guardaId=0){
  const t=tipoExtra(tipo);
  if(t==='MANUAL'){
    const e=(await db`select data from public.mobile_entity_records
      where entity='escalas_extras_manuais' and deleted=false and (data->>'id')::bigint=${id} limit 1`)[0]?.data||null;
    if(!e||['CANCELADA','CANCELADO','EXCLUIDA','EXCLUÍDA','INATIVA'].includes(norm(e.status||'ATIVA').toUpperCase()))return null;
    if(guardaId&&Number(e.guarda_id)!==guardaId)return null;
    const data=String(e.data||'').slice(0,10);
    return {...e,id:Number(e.id),servico_id:Number(e.id),extra_tipo:'MANUAL',descricao:norm(e.posto)||'Escala Extra Manual',
      minutos:minutos(e.horario_inicio,e.horario_fim),classe:await classe(data),data};
  }
  if(!guardaId)return null;
  const e=(await db`select data from public.mobile_entity_records
    where entity='eventos_extras' and deleted=false and (data->>'id')::bigint=${id} limit 1`)[0]?.data||null;
  if(!e||norm(e.status||'ATIVO').toUpperCase()!=='ATIVO')return null;
  const ps=(await db`select data from public.mobile_entity_records where entity='eventos_extras_participantes' and deleted=false`)
    .map((x:any)=>x.data||{})
    .filter((p:any)=>Number(p.evento_id)===id&&Number(p.guarda_id)===guardaId&&
      norm(p.tipo_participacao||'EXTRA').toUpperCase()==='EXTRA'&&Number(p.minutos_extra||0)>0);
  if(!ps.length)return null;
  const data=String(e.data||'').slice(0,10);
  return {...e,id:Number(e.id),servico_id:Number(e.id),guarda_id:guardaId,extra_tipo:'EVENTO',
    descricao:norm(e.nome||e.local)||'Serviço Extra por Evento',evento_nome:norm(e.nome),evento_local:norm(e.local),
    minutos:ps.reduce((a:number,p:any)=>a+Number(p.minutos_extra||0),0),classe:await classe(data),data,
    horario_inicio:norm(e.horario_inicio).slice(0,5),horario_fim:norm(e.horario_fim).slice(0,5)};
}
async function temJustificativaExtra(guardaId:number,data:string){
  const j=(await db`select data from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false`).map((x:any)=>x.data||{});
  return j.some((x:any)=>Number(x.guarda_id)===guardaId&&norm(x.status||'ATIVA').toUpperCase()!=='CANCELADA'&&
    norm(x.tipo_servico||'ORDINARIO').toUpperCase()==='EXTRA'&&String(x.data_inicial||'')<=data&&String(x.data_final||x.data_inicial||'')>=data);
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
  try{
    const u=await user(req);if(!u)return reply(401,{message:'Sessão não autenticada ou expirada.'});
    if(!(await can(u,'permutas','CONSULTA')))return reply(403,{message:'Sem permissão para utilizar permutas.'});
    const b=await req.json().catch(()=>({})),action=norm(b.action).toLowerCase(),gid=Number(u.guarda_id);

    if(action==='candidates'){
      const rows=await extrasPermutaveis();
      const prof=await db`select guarda_id,nome_guerra,nome_completo from public.mobile_profiles where ativo=true`;
      const nomes=new Map(prof.map((x:any)=>[Number(x.guarda_id),norm(x.nome_guerra||x.nome_completo)]));
      const map=(x:any)=>({...x,nome_guerra:nomes.get(Number(x.guarda_id))||`GCM ${x.guarda_id}`});
      return reply(200,{mine:rows.filter((x:any)=>Number(x.guarda_id)===gid).map(map),others:rows.filter((x:any)=>Number(x.guarda_id)!==gid).map(map)});
    }

    if(action==='request_swap'){
      const q=b.request||{},id1=Number(q.extra_id),id2=Number(q.extra_contrapartida_id),
        t1=tipoExtra(q.extra_tipo||q.extra_tipo_origem),t2=tipoExtra(q.extra_contrapartida_tipo||q.extra_tipo_contrapartida),
        g1=Number(q.extra_guarda_id)||gid,g2=Number(q.extra_contrapartida_guarda_id)||0;
      if(!id1||!id2||!g2||!q.concordou_termo)return reply(400,{message:'Selecione os dois serviços extras e aceite o termo.'});
      const e1=await extraRef(t1,id1,g1),e2=await extraRef(t2,id2,g2);
      if(!e1||!e2)return reply(404,{message:'Um dos serviços extras não foi localizado ou não está mais ativo.'});
      if(Number(e1.guarda_id)!==gid)return reply(403,{message:'O primeiro serviço extra deve pertencer ao GCM solicitante.'});
      if(Number(e2.guarda_id)===gid)return reply(400,{message:'Selecione um serviço extra de outro GCM.'});
      if(t1==='EVENTO'&&t2==='EVENTO'&&id1===id2)return reply(400,{message:'Não é necessário trocar participantes do mesmo evento entre si.'});
      if(await temJustificativaExtra(gid,String(e2.data).slice(0,10)))return reply(400,{message:'Você possui justificativa vigente para serviço extra na data do serviço que receberia.'});
      if(await temJustificativaExtra(Number(e2.guarda_id),String(e1.data).slice(0,10)))return reply(400,{message:'O outro GCM possui justificativa vigente para serviço extra na data do serviço que receberia.'});
      const hojeTroca=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
      if(String(e1.data).slice(0,10)<hojeTroca||String(e2.data).slice(0,10)<hojeTroca)return reply(409,{message:'Não é possível solicitar troca de extras já ocorridos.'});
      const c1=String(e1.classe),c2=String(e2.classe),m1=Number(e1.minutos||0),m2=Number(e2.minutos||0),contra=Number(e2.guarda_id);
      if(!m1||m1!==m2)return reply(409,{message:'Troca Extra x Extra exige dois serviços com a mesma duração; as classes financeiras originais são preservadas.'});
      const payload={modalidade:'TROCA_EXTRA',extra_id:id1,extra_tipo:t1,extra_tipo_origem:t1,extra_guarda_id:gid,
        extra_contrapartida_id:id2,extra_contrapartida_tipo:t2,extra_tipo_contrapartida:t2,extra_contrapartida_guarda_id:contra,
        solicitante_id:gid,contraparte_id:contra,substituto_id:gid,substituido_id:contra,data:String(e1.data),turno:'EXTRA',servico_extra:1,
        concordou_termo:true,observacao:norm(q.observacao),classe_extra_origem:c1,classe_extra_contrapartida:c2,
        minutos_extra_origem:m1,minutos_extra_contrapartida:m2,competencia_origem:String(e1.data).slice(0,7),
        competencia_contrapartida:String(e2.data).slice(0,7),financeiro_neutro:1,aceite_contraparte:0,
        extra_origem:{id:id1,tipo:t1,guarda_id:gid,descricao:e1.descricao,data:e1.data,horario_inicio:e1.horario_inicio,horario_fim:e1.horario_fim,classe:c1,minutos:m1},
        extra_contrapartida:{id:id2,tipo:t2,guarda_id:contra,descricao:e2.descricao,data:e2.data,horario_inicio:e2.horario_inicio,horario_fim:e2.horario_fim,classe:c2,minutos:m2}};
      const dup=await db`select id from public.mobile_action_requests where tipo='PERMUTA'
        and status in ('AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP','ACEITE_PENDENTE_DESKTOP')
        and (
          (upper(coalesce(payload->>'extra_tipo_origem',payload->>'extra_tipo','MANUAL'))=${t1} and nullif(payload->>'extra_id','')::bigint=${id1})
          or (upper(coalesce(payload->>'extra_tipo_contrapartida',payload->>'extra_contrapartida_tipo','MANUAL'))=${t1} and nullif(payload->>'extra_contrapartida_id','')::bigint=${id1})
          or (upper(coalesce(payload->>'extra_tipo_origem',payload->>'extra_tipo','MANUAL'))=${t2} and nullif(payload->>'extra_id','')::bigint=${id2})
          or (upper(coalesce(payload->>'extra_tipo_contrapartida',payload->>'extra_contrapartida_tipo','MANUAL'))=${t2} and nullif(payload->>'extra_contrapartida_id','')::bigint=${id2})
        ) limit 1`;
      if(dup.length)return reply(409,{message:'Já existe uma solicitação pendente envolvendo o serviço extra oferecido.'});
      const r=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload,status,resposta)
        values(${gid},'PERMUTA',${db.json(payload)},'AGUARDANDO_ACEITE','Aguardando aceite do outro GCM.')
        returning id,status,created_at`;
      const n1=await profileName(gid),rot1=t1==='EVENTO'?'Extra por Evento':'Extra Manual',rot2=t2==='EVENTO'?'Extra por Evento':'Extra Manual';
      const recalc=t1==='EVENTO'||t2==='EVENTO'
        ?' Extra por Evento será recalculado para o novo participante conforme escala ordinária, permutas e demais serviços.':'';
      const warn=`${n1} propôs trocar [${rot1}] ${norm(e1.descricao)} de ${e1.data} (${e1.horario_inicio}–${e1.horario_fim}, ${m1/60}h atuais, ${c1}%) por [${rot2}] ${norm(e2.descricao)} de ${e2.data} (${e2.horario_inicio}–${e2.horario_fim}, ${m2/60}h atuais, ${c2}%).${recalc} Após seu aceite, o Comando ainda deverá aprovar.`;
      await note(contra,'PERMUTA_TROCA_EXTRA','Troca de serviço extra',warn,Number(r[0].id),String(e2.data),`swap-extra:${r[0].id}:${contra}`);
      return reply(200,{success:true,request:r[0],warning:warn});
    }

    if(action==='request_assumption'){
      const q=b.request||{},eid=Number(q.extra_id||0),tipo=tipoExtra(q.extra_tipo||q.extra_tipo_origem),
        origemInformada=Number(q.extra_guarda_id||q.substituido_id||0);
      if(!eid||!origemInformada||!q.concordou_termo)return reply(400,{message:'Selecione o serviço extra que deseja assumir e aceite o termo.'});
      const e=await extraRef(tipo,eid,origemInformada);
      if(!e)return reply(404,{message:'Serviço extra não localizado ou não está ativo para o GCM informado.'});
      const origem=Number(e.guarda_id||0);if(!origem||origem===gid)return reply(400,{message:'Selecione um serviço extra atualmente atribuído a outro GCM.'});
      const data=String(e.data||'').slice(0,10),hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
      if(data<hoje)return reply(400,{message:'Serviços extras passados não podem ser selecionados para nova permuta.'});
      if(await temJustificativaExtra(gid,data))return reply(400,{message:'Você possui justificativa vigente para serviço extra nessa data.'});
      const c=String(e.classe),m=Number(e.minutos||0);
      const payload={modalidade:'CESSAO_EXTRA',data,turno:turno(e.horario_inicio,e.horario_fim),servico_extra:1,
        extra_id:eid,extra_tipo:tipo,extra_tipo_origem:tipo,extra_guarda_id:origem,
        substituido_id:origem,substituto_id:gid,solicitante_id:gid,contraparte_id:origem,concordou_termo:true,
        observacao:norm(q.observacao),classe_extra_origem:c,minutos_extra_origem:m,competencia_origem:data.slice(0,7),
        financeiro_neutro:0,aceite_contraparte:0,
        extra_origem:{id:eid,tipo,guarda_id:origem,descricao:e.descricao,data,horario_inicio:e.horario_inicio,horario_fim:e.horario_fim,classe:c,minutos:m}};
      const conflitoGlobal=await db`select id from public.mobile_action_requests where tipo='PERMUTA'
        and status in ('AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO','ACEITE_PENDENTE_DESKTOP','DECISAO_PENDENTE_DESKTOP')
        and (
          (upper(coalesce(payload->>'extra_tipo_origem',payload->>'extra_tipo','MANUAL'))=${tipo} and nullif(payload->>'extra_id','')::bigint=${eid})
          or (upper(coalesce(payload->>'extra_tipo_contrapartida',payload->>'extra_contrapartida_tipo','MANUAL'))=${tipo} and nullif(payload->>'extra_contrapartida_id','')::bigint=${eid})
        ) limit 1`;
      if(conflitoGlobal.length)return reply(409,{message:'Este extra já participa de outra cessão ou troca pendente.',request_id:Number(conflitoGlobal[0].id)});
      const dup=await db`select id from public.mobile_action_requests where tipo='PERMUTA' and guarda_id=${gid}
        and status in ('AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP')
        and upper(coalesce(payload->>'modalidade',''))='CESSAO_EXTRA'
        and coalesce(payload->>'extra_tipo_origem',payload->>'extra_tipo','MANUAL')=${tipo}
        and nullif(payload->>'extra_id','')::bigint=${eid}
        and nullif(coalesce(payload->>'extra_guarda_id',payload->>'substituido_id'),'')::bigint=${origem} limit 1`;
      if(dup.length)return reply(409,{message:'Já existe uma solicitação pendente para esse serviço extra.'});
      const r=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload,status,resposta)
        values(${gid},'PERMUTA',${db.json(payload)},'AGUARDANDO_ACEITE','Aguardando autorização do GCM originalmente escalado.')
        returning id,status,created_at`;
      const nome=norm(u.nome_guerra||u.nome_completo)||'GCM',rot=tipo==='EVENTO'?'Extra por Evento':'Extra Manual',
        recalc=tipo==='EVENTO'?' Se aprovado, o período efetivamente extra será recalculado para o novo participante.':'';
      const msg=`${nome} solicitou assumir [${rot}] ${norm(e.descricao)} de ${data} (${norm(e.horario_inicio)}–${norm(e.horario_fim)}, ${m/60}h atuais, ${c}%).${recalc} Autorize ou recuse. Somente após sua autorização seguirá ao Comando.`;
      await note(origem,'PERMUTA_ASSUNCAO_EXTRA','Pedido para assumir seu serviço extra',msg,Number(r[0].id),data,`assuncao-extra:${r[0].id}:${origem}`);
      return reply(200,{success:true,request:r[0],message:'Solicitação enviada ao GCM originalmente escalado para autorização.',warning:recalc.trim()});
    }

    if(action==='accept'){
      const id=Number(b.id),ok=Boolean(b.aceitou);
      const r=(await db`select * from public.mobile_action_requests where id=${id} and tipo='PERMUTA' limit 1`)[0];
      if(!r)return reply(404,{message:'Solicitação não encontrada.'});
      const p=r.payload||{},modalidade=norm(p.modalidade).toUpperCase();
      if(!['TROCA_EXTRA','CESSAO_EXTRA'].includes(modalidade)||Number(p.contraparte_id)!==gid)
        return reply(403,{message:'Esta solicitação não está aguardando sua autorização.'});
      if(!['AGUARDANDO_ACEITE','PENDENTE'].includes(norm(r.status).toUpperCase()))
        return reply(400,{message:'Esta solicitação já foi processada.'});
      if(!ok){
        const resposta=modalidade==='CESSAO_EXTRA'?'Assunção recusada pelo GCM originalmente escalado.':'Troca recusada pelo GCM destinatário.';
        await db`update public.mobile_action_requests set status='RECUSADA',resposta=${resposta},processado_em=now(),
          payload=${db.json({...p,aceite_contraparte:0,aceite_em:new Date().toISOString(),aceite_por:gid})} where id=${id}`;
        await note(Number(r.guarda_id),modalidade==='CESSAO_EXTRA'?'PERMUTA_ASSUNCAO_RECUSADA':'PERMUTA_TROCA_RECUSADA',
          modalidade==='CESSAO_EXTRA'?'Assunção de extra recusada':'Troca de extra recusada',
          modalidade==='CESSAO_EXTRA'?`${await profileName(gid)} não autorizou que você assumisse o serviço extra.`:`${await profileName(gid)} recusou a troca proposta.`,
          id,String(p.data||''),`extra-recusada:${id}:${r.guarda_id}`);
        return reply(200,{success:true,status:'RECUSADA'});
      }
      const hojeAceite=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
      if([p.data,p.extra_origem?.data,p.extra_contrapartida?.data].filter(Boolean).some((x:any)=>String(x).slice(0,10)<hojeAceite))return reply(409,{message:'Não é possível aceitar serviços extras já ocorridos.'});
      if(modalidade==='TROCA_EXTRA'&&Number(p.minutos_extra_origem||0)!==Number(p.minutos_extra_contrapartida||0))return reply(409,{message:'Extras de duração diferente não podem ser trocados.'});
      const np={...p,aceite_contraparte:1,aceite_por:gid,aceite_em:new Date().toISOString()};
      const resposta=modalidade==='CESSAO_EXTRA'
        ?'Assunção autorizada pelo GCM originalmente escalado. Aguardando análise do Comando.'
        :'Troca aceita pelo outro GCM. Aguardando análise do Comando.';
      await db.begin(async sql=>{
        const upd=await sql`update public.mobile_action_requests set status='PENDENTE_DESKTOP',resposta=${resposta},processado_em=null,payload=${sql.json(np)}
          where id=${id} and status in ('AGUARDANDO_ACEITE','PENDENTE') returning id`;
        if(!upd.length)throw new Error('Solicitação já respondida. Atualize a página.');
        await sql`insert into public.mobile_action_requests(guarda_id,tipo,payload,status)
          values(${gid},'PERMUTA_ACEITE_EXTRA',${sql.json({request_id:id,aceitou:true,modalidade,contraparte_id:gid})},'PENDENTE_DESKTOP')`;
      });
      await note(Number(r.guarda_id),modalidade==='CESSAO_EXTRA'?'PERMUTA_ASSUNCAO_AUTORIZADA':'PERMUTA_TROCA_ACEITA',
        modalidade==='CESSAO_EXTRA'?'Assunção de extra autorizada':'Troca de extra aceita',
        modalidade==='CESSAO_EXTRA'?`${await profileName(gid)} autorizou a assunção. A solicitação seguirá ao Comando.`:`${await profileName(gid)} aceitou a troca. A solicitação seguirá ao Comando.`,
        id,String(p.data||''),`extra-aceita:${id}:${r.guarda_id}`);
      return reply(200,{success:true,status:'PENDENTE_DESKTOP'});
    }

    return reply(404,{message:'Ação de permuta extra 10.0.68 não encontrada.'});
  }catch(e){
    console.error('[gcmbs-extra-permutas-v68]',e);
    return reply(500,{message:e instanceof Error?e.message:'Erro interno.'});
  }
});
