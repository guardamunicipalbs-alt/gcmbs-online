import postgres from 'npm:postgres@3.4.7';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'content-type,authorization',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};
const reply=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1});
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const norm=(v:unknown)=>String(v??'').trim();
const rank:any={CONSULTA:1,EDICAO:2};

function roleOf(u:any){
  const r=norm(u?.role||u?.perfil).toLowerCase(),c=norm(u?.cargo).toUpperCase();
  if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return 'comandante';
  if(r==='subcomandante'||/\bSUBCOMANDANTE\b/.test(c))return 'subcomandante';
  return r||'gcm';
}
function total(u:any){return Boolean(u?.controle_total)||roleOf(u)==='comandante';}
function gestor(u:any){return ['comandante','subcomandante'].includes(roleOf(u));}

async function findAccount(id:string){
  const raw=norm(id),cpf=raw.replace(/\D/g,'');
  const r=await db`select * from private.mobile_auth_accounts
    where ativo=true and (identificador=${raw} or username=${raw} or (${cpf}<>'' and cpf=${cpf}))
    limit 1`;
  return r[0]||null;
}
async function sessionByToken(token:string){
  if(!token)return null;
  const h=sha(token);
  const r=await db`
    select s.token_sha256,s.desktop_usuario_id,s.guarda_id,
           a.identificador,a.username,a.role,a.senha_trocada,
           p.nome_guerra,p.nome_completo,p.cargo,p.ativo,p.controle_total
    from private.mobile_sessions s
    join private.mobile_auth_accounts a on a.desktop_usuario_id=s.desktop_usuario_id and a.ativo=true
    join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true
    where s.token_sha256=${h} and s.revoked=false and s.expires_at>now()
    limit 1`;
  if(!r.length)return null;
  await db`update private.mobile_sessions set last_seen_at=now() where token_sha256=${h}`;
  return r[0];
}
async function perms(gid:number){return await db`select modulo,upper(nivel) nivel,ativo from public.mobile_permissions where guarda_id=${gid} and ativo=true order by modulo`;}
function can(u:any,p:any[],m:string,n='CONSULTA'){
  if(m==='escalas'&&!gestor(u))return false;
  if(m==='relatorios_frota'&&!gestor(u))return false;
  if(total(u))return true;
  return p.some(x=>x?.ativo!==false&&(x.modulo===m||x.modulo==='*')&&(rank[String(x.nivel).toUpperCase()]||0)>=(rank[n]||1));
}
function bearer(req:Request){const h=req.headers.get('authorization')||'';return h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():'';}
async function pub(u:any,p:any[]){return{
  desktop_usuario_id:Number(u.desktop_usuario_id),guarda_id:Number(u.guarda_id),
  usuario:u.identificador,username:u.username,nome:u.nome_guerra||u.nome_completo||u.identificador,
  role:roleOf(u),perfil:roleOf(u),cargo:u.cargo||'',controle_total:total(u),
  permissoes:p,senha_trocada:Number(u.senha_trocada||0)
};}

async function entityCatalog(u:any,p:any[]){
  const rows=await db`select entity,modulo,titulo,writable,scope_fields,columns,pk,updated_at from public.mobile_entity_catalog order by modulo,titulo`;
  return rows.filter((x:any)=>can(u,p,x.modulo)).map((x:any)=>({...x,can_edit:!!x.writable&&can(u,p,x.modulo,'EDICAO')}));
}
async function entityList(u:any,p:any[],body:any){
  const entity=norm(body.entity);
  const cat=(await db`select * from public.mobile_entity_catalog where entity=${entity} limit 1`)[0];
  if(!cat) throw new Error('Entidade online não encontrada.');
  if(!can(u,p,cat.modulo)) throw new Error('Sem permissão para consultar este módulo.');
  const limit=Math.min(5000,Math.max(1,Number(body.limit||500)));
  const offset=Math.max(0,Number(body.offset||0));
  let rows;
  if(gestor(u) || !(Array.isArray(cat.scope_fields)&&cat.scope_fields.length)){
    rows=await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at
      from public.mobile_entity_records where entity=${entity} and deleted=false
      order by updated_at desc limit ${limit} offset ${offset}`;
  }else{
    rows=await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at
      from public.mobile_entity_records
      where entity=${entity} and deleted=false and (${Number(u.guarda_id)}=any(scope_guard_ids))
      order by updated_at desc limit ${limit} offset ${offset}`;
  }
  return {catalog:{...cat,can_edit:!!cat.writable&&can(u,p,cat.modulo,'EDICAO')},records:rows};
}
async function entityMutate(u:any,p:any[],body:any){
  const entity=norm(body.entity),operation=String(body.operation||'UPSERT').toUpperCase();
  const cat=(await db`select * from public.mobile_entity_catalog where entity=${entity} limit 1`)[0];
  if(!cat) throw new Error('Entidade online não encontrada.');
  if(!cat.writable || !can(u,p,cat.modulo,'EDICAO')) throw new Error('Sem permissão de edição online para este módulo.');
  if(!['UPSERT','DELETE'].includes(operation)) throw new Error('Operação inválida.');
  if(operation==='DELETE' && entity==='manutencao_viaturas' && !gestor(u)) throw new Error('Somente Comandante ou Subcomandante podem excluir manutenções de viaturas.');
  let key=norm(body.record_key);
  if(!key && operation==='UPSERT') key=`cloud:${randomUUID()}`;
  if(!key) throw new Error('Registro inválido.');
  const incoming=body.data&&typeof body.data==='object'?{...body.data}:{};
  const existing=key?(await db`select scope_guard_ids,data from public.mobile_entity_records where entity=${entity} and record_key=${key} and deleted=false limit 1`)[0]:null;
  // Campos de decisão/auditoria são controlados pelo Comando/Desktop.
  if(!gestor(u)){
    const protectedByEntity:any={
      banco_horas_solicitacoes:['status','analisado_por','analisado_em','motivo_recusa','movimentacao_id','criado_por','referencia'],
      justificativas_faltas:['status','criado_em','atualizado_em'],
      escalas_extras_manuais:['criado_por','criado_em'],
      cursos_habilitacoes:['criado_em'],
      frequencia_registros:['atualizado_em']
    };
    for(const f of protectedByEntity[entity]||[]) delete incoming[f];
  }
  // 10.0.59: merge defensivo. Um cliente Desktop/Online/Mobile que ainda não
  // conheça um campo nunca pode apagá-lo ao editar outro campo do mesmo registro.
  const data=operation==='UPSERT'&&existing?.data?{...existing.data,...incoming}:incoming;
  const scopeFields=Array.isArray(cat.scope_fields)?cat.scope_fields:[];
  const scope=[...new Set(scopeFields.map((f:string)=>Number(data[f])).filter((n:number)=>Number.isInteger(n)&&n>0))];
  const clientChangeId=norm(body.client_change_id)||randomUUID();
  const scoped=scopeFields.length>0&&!gestor(u);
  if(scoped){
    const gid=Number(u.guarda_id);
    if(existing && !(existing.scope_guard_ids||[]).map(Number).includes(gid)) throw new Error('Registro fora do seu escopo de acesso.');
    if(operation==='UPSERT'){
      if(scopeFields.includes('guarda_id') && !Number(data.guarda_id)) data.guarda_id=gid;
      const proposed=[...new Set(scopeFields.map((f:string)=>Number(data[f])).filter((n:number)=>Number.isInteger(n)&&n>0))];
      if(!proposed.includes(gid)) throw new Error('Não é permitido registrar dados em nome de outro GCM.');
      scope.splice(0,scope.length,...proposed);
    }
  }
  if(operation==='DELETE'){
    await db`update public.mobile_entity_records set deleted=true,source='cloud',revision=revision+1,updated_by_guard_id=${Number(u.guarda_id)},updated_at=now() where entity=${entity} and record_key=${key}`;
  }else{
    await db`insert into public.mobile_entity_records(entity,record_key,modulo,scope_guard_ids,data,source,revision,deleted,updated_by_guard_id,updated_at)
      values(${entity},${key},${cat.modulo},${scope},${db.json(data)},'cloud',1,false,${Number(u.guarda_id)},now())
      on conflict(entity,record_key) do update set scope_guard_ids=excluded.scope_guard_ids,data=excluded.data,source='cloud',revision=public.mobile_entity_records.revision+1,deleted=false,updated_by_guard_id=excluded.updated_by_guard_id,updated_at=now()`;
  }
  const c=await db`insert into public.mobile_entity_changes(client_change_id,entity,record_key,modulo,operation,data,guarda_id,desktop_usuario_id)
    values(${clientChangeId},${entity},${key},${cat.modulo},${operation},${db.json(data)},${Number(u.guarda_id)},${Number(u.desktop_usuario_id)})
    on conflict(client_change_id) do update set client_change_id=excluded.client_change_id returning id,status,created_at`;
  return {success:true,record_key:key,change:c[0]};
}

async function insertNotification(sql:any,{guardaId,tipo,titulo,mensagem,referenciaTipo=null,referenciaId=null,dataEvento=null,dedupeKey}:any){
  if(!Number(guardaId)||!norm(dedupeKey))return;
  await sql`insert into public.mobile_notifications(
      guarda_id,tipo,titulo,mensagem,referencia_tipo,referencia_id,data_evento,dedupe_key
    ) values(
      ${Number(guardaId)},${String(tipo)},${String(titulo)},${String(mensagem)},
      ${referenciaTipo?String(referenciaTipo):null},${referenciaId==null?null:Number(referenciaId)},
      ${dataEvento||null},${String(dedupeKey)}
    ) on conflict(dedupe_key) do nothing`;
}

async function ensureDecisionNotifications(rows:any[]){
  for(const r of rows){
    if(String(r.tipo||'').toUpperCase()!=='PERMUTA')continue;
    const st=String(r.status||'').toUpperCase();
    if(!['APROVADA','REPROVADA','RECUSADA','NEGADA','CANCELADA'].includes(st))continue;
    const finalStatus=['NEGADA','RECUSADA'].includes(st)?'REPROVADA':st;
    const msg=finalStatus==='APROVADA'
      ? 'Sua solicitação de permuta foi analisada e aprovada pelo Comando.'
      : finalStatus==='REPROVADA'
        ? `Sua solicitação de permuta foi analisada e reprovada pelo Comando.${r.resposta?' '+String(r.resposta):''}`
        : 'Sua solicitação de permuta foi cancelada.';
    await insertNotification(db,{
      guardaId:Number(r.guarda_id),tipo:'PERMUTA_ANALISADA',titulo:'Permuta analisada',
      mensagem:msg,referenciaTipo:'PERMUTA_DECISAO',referenciaId:Number(r.id),
      dataEvento:r?.payload?.data||null,
      dedupeKey:`permuta-decisao:${Number(r.id)}:${finalStatus}:${Number(r.guarda_id)}`
    });
  }
}


function dia(v:any){return norm(v).slice(0,10);}
function numeroIgual(a:any,b:any){const x=Number(a)||0,y=Number(b)||0;return x>0&&y>0&&x===y;}
function permutaCorrespondeRequest(request:any,mirror:any){
  const q=request?.payload||{},m=mirror?.data||mirror||{},modalidade=norm(q.modalidade||'ASSUNCAO').toUpperCase();
  const substituto=Number(q.substituto_id||request?.guarda_id)||0,substituido=Number(q.substituido_id)||0;
  if(!numeroIgual(m.substituto_id,substituto)||!numeroIgual(m.substituido_id,substituido))return false;
  if(modalidade==='TROCA_EXTRA'||modalidade==='CESSAO_EXTRA'){
    if(norm(m.modalidade).toUpperCase()!==modalidade||!numeroIgual(m.extra_id,q.extra_id))return false;
    if(q.extra_contrapartida_id&&!numeroIgual(m.extra_contrapartida_id,q.extra_contrapartida_id))return false;
    const tipoOrigem=norm(q.extra_tipo_origem||q.extra_tipo).toUpperCase();
    if(tipoOrigem&&norm(m.extra_tipo_origem).toUpperCase()!==tipoOrigem)return false;
    const tipoContra=norm(q.extra_tipo_contrapartida||q.extra_contrapartida_tipo).toUpperCase();
    if(tipoContra&&norm(m.extra_tipo_contrapartida).toUpperCase()!==tipoContra)return false;
    return !q.data||dia(m.data)===dia(q.data);
  }
  return !!dia(q.data)&&!!norm(q.turno)&&dia(m.data)===dia(q.data)&&
    norm(m.turno).toUpperCase()===norm(q.turno).toUpperCase();
}
function bancoCorrespondeRequest(request:any,mirror:any){
  const q=request?.payload||{},m=mirror?.data||mirror||{};
  return numeroIgual(m.guarda_id,request?.guarda_id)&&!!norm(q.competencia)&&
    norm(m.competencia)===norm(q.competencia)&&!!dia(q.data_servico)&&dia(m.data_servico)===dia(q.data_servico);
}

async function enrichActionRequests(rows:any[]){
  const bankRows=await db`select record_key,data,updated_at from public.mobile_entity_records where entity='banco_horas_solicitacoes' and deleted=false`;
  const permRows=await db`select record_key,data,updated_at from public.mobile_entity_records where entity='permutas' and deleted=false`;

  /* GCMBS_V276_DECISION_TRACE */
  const bankDecisionRows=await db`
    select
      c.id,
      c.guarda_id,
      c.payload,
      c.status,
      c.resposta,
      c.created_at,
      c.processado_em,
      p.nome_guerra as decisor_nome
    from public.mobile_action_requests c
    left join public.mobile_profiles p
      on p.guarda_id=c.guarda_id
    where c.tipo='BANCO_HORAS_DECISAO_COMANDO'
    order by c.id desc
    limit 500
  `;

  const bankDecisionByRequest=new Map<number,any>();
  for(const d of bankDecisionRows){
    const rid=Number(d?.payload?.request_id||0);
    if(rid && !bankDecisionByRequest.has(rid))
      bankDecisionByRequest.set(rid,d);
  }
  const bank=new Map(bankRows.map((x:any)=>[String(x.record_key),x]));
  const perm=new Map(permRows.map((x:any)=>[String(x.record_key),x]));
  return rows.map((r:any)=>{
    const ref=r.desktop_referencia_id?String(r.desktop_referencia_id):'';
    const candidateByTag=r.tipo==='BANCO_HORAS_CORRECAO'
      ? bankRows.find((x:any)=>norm(x?.data?.referencia)===`MOBILE#${Number(r.id)}`)
      : r.tipo==='PERMUTA'
        ? permRows.find((x:any)=>norm(x?.data?.observacao).includes(`[MOBILE#${Number(r.id)}]`))
        : null;
    const candidate=candidateByTag||(r.tipo==='BANCO_HORAS_CORRECAO'?bank.get(ref):r.tipo==='PERMUTA'?perm.get(ref):null);
    const mirror=r.tipo==='BANCO_HORAS_CORRECAO'
      ? (bancoCorrespondeRequest(r,candidate)?candidate:null)
      : r.tipo==='PERMUTA'
        ? (permutaCorrespondeRequest(r,candidate)?candidate:null)
        : null;
    let finalStatus=String(r.status||'PENDENTE_DESKTOP').toUpperCase(),finalResponse=r.resposta||'';
    if(mirror?.data){
      const st=String(mirror.data.status||'').toUpperCase();
      if(st) finalStatus=st==='NEGADA'?'REPROVADA':st;
      if(r.tipo==='BANCO_HORAS_CORRECAO'){
        if(finalStatus==='RECUSADA') finalResponse=mirror.data.motivo_recusa||'Solicitação recusada pelo Comando.';
        else if(finalStatus==='APROVADA') finalResponse='Solicitação aprovada pelo Comando.';
        else if(finalStatus==='PENDENTE') finalResponse='Aguardando decisão do Comando.';
      }else if(r.tipo==='PERMUTA'){
        if(finalStatus==='REPROVADA') finalResponse=mirror.data.motivo_decisao||'Permuta reprovada pelo Comando.';
        else if(finalStatus==='APROVADA') finalResponse=mirror.data.motivo_decisao||'Permuta aprovada pelo Comando.';
        else if(finalStatus==='CANCELADA') finalResponse='Solicitação cancelada pelo GCM.';
        else if(finalStatus==='PENDENTE') finalResponse='Aguardando decisão do Comando.';
      }
    }else if(finalStatus==='PROCESSADO'){
      // PROCESSADO significa apenas que o Desktop recebeu. A decisão ainda é pendente.
      finalStatus='PENDENTE';finalResponse='Recebida pelo Desktop e aguardando decisão do Comando.';
    }else if(finalStatus==='PENDENTE_DESKTOP'){
      finalStatus='PENDENTE';finalResponse='Enviada e aguardando recebimento pelo Desktop.';
    }else if(finalStatus==='CANCELAMENTO_PENDENTE_DESKTOP'){
      finalStatus='CANCELAMENTO_PENDENTE';finalResponse=finalResponse||'Cancelamento enviado ao Desktop e aguardando sincronização.';
    }
    // V299 R3: decisão ainda não aplicada não pode reaparecer como solicitação aguardando análise.
    if(r.tipo==='PERMUTA'&&finalStatus==='PENDENTE'){
      const raw=String(r.status||'').toUpperCase();
      if(raw==='DECISAO_PENDENTE_DESKTOP'){
        finalStatus='DECISAO_PENDENTE_DESKTOP';
        finalResponse='Decisão do Comando registrada; aguardando aplicação e conciliação pelo Desktop.';
      }else if(['CANCELAMENTO_COMANDO_PENDENTE','CANCELAMENTO_PENDENTE_DESKTOP'].includes(raw)){
        finalStatus=raw;
        finalResponse='Cancelamento registrado; aguardando confirmação do Desktop.';
      }
    }
    const bankDecision=
      r.tipo==='BANCO_HORAS_CORRECAO'
        ? bankDecisionByRequest.get(Number(r.id))
        : null;

    const finalBanco=
      r.tipo==='BANCO_HORAS_CORRECAO' &&
      ['APROVADA','RECUSADA'].includes(finalStatus);

    const decisaoOrigem=
      bankDecision
        ? 'ONLINE'
        : finalBanco && mirror?.data
          ? 'DESKTOP'
          : '';

    return {
      ...r,
      status_original:r.status,
      status:finalStatus,
      resposta:finalResponse,
      editable:r.tipo==='PERMUTA'&&finalStatus==='PENDENTE',
      decisao_origem:decisaoOrigem,
      decisao_por_guarda_id:bankDecision?Number(bankDecision.guarda_id||0)||null:null,
      decisao_por_nome:bankDecision?norm(bankDecision.decisor_nome)||null:null,
      decisao_registrada_em:bankDecision?.created_at||null,
      decisao_aplicada_em:bankDecision?.processado_em||mirror?.updated_at||null,
      decisao_comando_status:bankDecision?norm(bankDecision.status).toUpperCase():null
    };
  });
}
async function permutaMutable(req:any,gid:number){
  if(!req||Number(req.guarda_id)!==gid||req.tipo!=='PERMUTA')throw new Error('Solicitação de permuta não encontrada.');
  let m=(await db`select data from public.mobile_entity_records where entity='permutas' and deleted=false and coalesce(data->>'observacao','') like ${`%[MOBILE#${Number(req.id)}]%`} order by updated_at desc limit 1`)[0];
  if(!m&&req.desktop_referencia_id){
    m=(await db`select data from public.mobile_entity_records where entity='permutas' and record_key=${String(req.desktop_referencia_id)} and deleted=false limit 1`)[0];
  }
  if(permutaCorrespondeRequest(req,m)){
    const st=String(m?.data?.status||'PENDENTE').toUpperCase();
    if(st && st!=='PENDENTE')throw new Error('A permuta já recebeu decisão do Comando e não pode mais ser alterada.');
  }
  const st=String(req.status||'').toUpperCase();
  if(['APROVADA','RECUSADA','REPROVADA','NEGADA','CANCELADA'].includes(st))throw new Error('A permuta já recebeu decisão e não pode mais ser alterada.');
  return true;
}

function brMes(m:string){const a:any={'01':'JANEIRO','02':'FEVEREIRO','03':'MARÇO','04':'ABRIL','05':'MAIO','06':'JUNHO','07':'JULHO','08':'AGOSTO','09':'SETEMBRO','10':'OUTUBRO','11':'NOVEMBRO','12':'DEZEMBRO'};return a[m]||''}
function nm(v:any){return norm(v?.nome_guerra||v?.nome_completo||v?.guarda_nome||v?.guarda||'-')}
function turnoHorario(t:any){const x=norm(t).toUpperCase();return x==='A'?'07:00–19:00':x==='B'?'19:00–07:00':x||'-'}
async function quadroOperacional(data:string){
  const dia=/^\d{4}-\d{2}-\d{2}$/.test(data)?data:new Date().toISOString().slice(0,10),mes=brMes(dia.slice(5,7));
  const gr=(await db`select data from public.mobile_entity_records where entity='guardas' and deleted=false`).map((x:any)=>x.data||{});
  const ativos=gr.filter((g:any)=>norm(g.status).toUpperCase()==='ATIVO'),afastados=gr.filter((g:any)=>norm(g.status).toUpperCase()==='AFASTADO'),feristas=ativos.filter((g:any)=>{const f=norm(g.mes_ferias).toUpperCase();return f===mes||f===dia.slice(5,7)});
  const escRows=await db`select data from public.mobile_entity_records where entity='escalas' and deleted=false and left(data->>'data',10)=${dia}`;
  const escs=escRows.map((x:any)=>x.data||{}).filter((e:any)=>!['SIMULADA','CANCELADA','EXCLUIDA','INATIVA'].includes(String(e.status||'ATIVA').toUpperCase())).sort((a:any,b:any)=>String(a.turno||'').localeCompare(String(b.turno||''))||Number(a.guarda_id||0)-Number(b.guarda_id||0));
  const escsOrdinarias=escs.filter((e:any)=>norm(e.origem).toUpperCase()!=='GERADOR_AUTOMATICO_EXTRA');
  const serv=(t:string)=>{const mp=new Map<number,any>();for(const e of escsOrdinarias){if(norm(e.turno).toUpperCase()!==t)continue;const id=Number(e.guarda_id)||0;if(!id)continue;const x=mp.get(id)||{nome:nm(e),postos:new Set<string>()};const po=norm(e.posto_nome||e.hist_posto_nome||e.posto);if(po)x.postos.add(po);mp.set(id,x)}return [...mp.values()]};
  const a=serv('A'),b=serv('B');
  // Frota: mesma regra operacional do Desktop, inclusive substituição por
  // configuração e, na falta dela, por veículo operacional do mesmo tipo.
  const vr=(await db`select data from public.mobile_entity_records where entity='viaturas' and deleted=false`).map((x:any)=>x.data||{});
  const mr=(await db`select data from public.mobile_entity_records where entity='manutencao_viaturas' and deleted=false`).map((x:any)=>x.data||{});
  const manutIds=new Set<number>();
  for(const m of mr){
    const ini=String(m.data_manutencao||m.data||'').slice(0,10),ret=String(m.data_retorno||'').slice(0,10),consertado=Number(m.consertado||0)===1;
    const st=norm(m.status||'ATIVA').toUpperCase(),statusAberto=['ATIVA','ABERTA','EM ANDAMENTO','EM MANUTENCAO','EM MANUTENÇÃO'].includes(st);
    const estavaAberta=(!ini||ini<=dia)&&(!ret||ret>dia)&&(!consertado||!!ret&&ret>dia);
    if(statusAberto&&estavaAberta)manutIds.add(Number(m.viatura_id)||0);
  }
  const statusIndisponivel=(v:any)=>['INDISPONIVEL','INDISPONÍVEL','BAIXADA','INATIVA','FORA DE SERVICO','FORA DE SERVIÇO'].includes(norm(v.status).toUpperCase());
  const indisponivelIds=new Set<number>(vr.filter((v:any)=>!manutIds.has(Number(v.id)||0)&&statusIndisponivel(v)).map((v:any)=>Number(v.id)||0));
  const porId=new Map<number,any>(vr.map((v:any)=>[Number(v.id),v]));
  const porNome=new Map<string,any>();for(const v of vr){for(const n of [v.prefixo,v.placa])if(norm(n))porNome.set(norm(n).toUpperCase(),v)}
  const subRows=(await db`select data from public.mobile_entity_records where entity='viatura_substituicoes' and deleted=false`).map((x:any)=>x.data||{}).filter((x:any)=>Number(x.ativa??1)!==0).sort((x:any,y:any)=>Number(x.ordem||0)-Number(y.ordem||0));
  const subsMap=new Map<number,number[]>();for(const r of subRows){const id=Number(r.viatura_principal_id)||0;if(!id)continue;if(!subsMap.has(id))subsMap.set(id,[]);subsMap.get(id)!.push(Number(r.viatura_substituta_id)||0)}
  const gruposV=new Map<number,any[]>();for(const e of escs){const v=porNome.get(norm(e.viatura).toUpperCase());if(!v)continue;const id=Number(v.id);if(!gruposV.has(id))gruposV.set(id,[]);gruposV.get(id)!.push(e)}
  const reservadosOriginais=new Set<number>([...gruposV.keys()].filter(id=>!manutIds.has(id)&&!indisponivelIds.has(id)));
  const usados=new Set<number>(),uso=new Map<number,any>(),substituicoes:any[]=[];const efetivaPorOriginal=new Map<number,any>();
  const tipoCanon=(v:any)=>/MOTO/i.test(norm(v?.tipo))?'MOTO':'VIATURA';
  const disponivelId=(id:number)=>{id=Number(id);const v=porId.get(id);return !!v&&!manutIds.has(id)&&!indisponivelIds.has(id)&&!usados.has(id)&&!reservadosOriginais.has(id)};
  for(const [origId,es] of gruposV){const orig=porId.get(origId);if(!orig)continue;let alvo=orig,substitui:any=null;if(manutIds.has(origId)||indisponivelIds.has(origId)){let sid=(subsMap.get(origId)||[]).find(disponivelId)||0;/* Sem substituta configurada e disponivel, nao realiza substituicao automatica. */if(sid){alvo=porId.get(sid);substitui=orig;substituicoes.push({original:norm(orig.prefixo||orig.placa),substituta:norm(alvo.prefixo||alvo.placa)})}else continue}usados.add(Number(alvo.id));uso.set(Number(alvo.id),{v:alvo,es,substitui});efetivaPorOriginal.set(origId,alvo)}
  const bas=(v:any,extra='')=>({nome:norm(v.prefixo||v.placa||`Veículo ${v.id}`),complemento:[v.tipo&&`Tipo: ${v.tipo}`,v.placa&&`Placa: ${v.placa}`,v.modelo,v.status&&`Status: ${v.status}`,extra].filter(Boolean).join(' · ')});
  const usoDet=[...uso.values()].map(({v,es,substitui}:any)=>bas(v,[substitui&&`Substitui: ${norm(substitui.prefixo||substitui.placa)}`,`Posto(s): ${[...new Set(es.map((e:any)=>norm(e.posto_nome||e.hist_posto_nome||e.posto)).filter(Boolean))].join(', ')}`,`Turno(s): ${[...new Set(es.map((e:any)=>norm(e.turno).toUpperCase()).filter(Boolean))].join(', ')}`,`GCM(s): ${[...new Set(es.map((e:any)=>nm(e)).filter(Boolean))].join(', ')}`].filter(Boolean).join(' · ')));
  const manut=vr.filter((v:any)=>manutIds.has(Number(v.id)||0)),indisp=vr.filter((v:any)=>indisponivelIds.has(Number(v.id)||0)),usoIds=new Set<number>([...uso.keys()]);
  const disp=vr.filter((v:any)=>{const id=Number(v.id)||0;return !usoIds.has(id)&&!manutIds.has(id)&&!indisponivelIds.has(id)}),baix=indisp;
  const manutDet=manut.map((v:any)=>{const sub=substituicoes.find((x:any)=>x.original===norm(v.prefixo||v.placa));return bas(v,sub?`Substituída operacionalmente por ${sub.substituta}`:'Sem substituta operacional alocada')});

  const grupos=new Map<string,any>();const add=(k:string,n:string,e:any)=>{const g=grupos.get(k)||{nome:n,turnos:new Set<string>(),gcms:new Set<string>()};if(e.turno)g.turnos.add(norm(e.turno).toUpperCase());g.gcms.add(nm(e));grupos.set(k,g)};
  for(const e of escs){const po=norm(e.posto_nome||e.hist_posto_nome||e.posto),orig=porNome.get(norm(e.viatura).toUpperCase()),ev=orig?efetivaPorOriginal.get(Number(orig.id)):null,v=norm(ev?.prefixo||ev?.placa||e.viatura),txt=`${po} ${v}`.toUpperCase();if(!po&&!v)continue;if(/MOTO|MOTOPATRULHAMENTO|\bMT\s?\d+/.test(txt)){add('MOTO_PATRULHAMENTO','Moto patrulhamento',e);continue}if(po&&!/VTR|VIATURA|PATRULHAMENTO/.test(po.toUpperCase())){add(`POSTO:${po.toUpperCase()}`,po,e);continue}if(v){add(`VTR:${v.toUpperCase()}`,v,e);continue}add(`POSTO:${po.toUpperCase()}`,po,e)}
  const cnh=gr.filter((g:any)=>{const dt=norm(g.categoria_cnh_validade);return dt&&dt<dia}).map((g:any)=>({nome_guerra:nm(g),categoria:g.categoria_cnh||'',validade:g.categoria_cnh_validade}));
  const faltFreq=(await db`select data from public.mobile_entity_records where entity='frequencia_registros' and deleted=false and left(data->>'data',10)=${dia}`).map((x:any)=>x.data||{}).filter((x:any)=>String(x.situacao||'').toUpperCase().includes('FALTA'));
  const faltJust=(await db`select data from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false and (data->>'data_inicial')<=${dia} and (data->>'data_final')>=${dia}`).map((x:any)=>x.data||{}).filter((x:any)=>String(x.status||'ATIVA').toUpperCase()!=='CANCELADA');
  const faltMap=new Map<number,any>();for(const x of faltFreq){const id=Number(x.guarda_id)||0,g=gr.find((q:any)=>Number(q.id)===id)||{};faltMap.set(id,{nome:nm(g),complemento:`${x.situacao||'FALTA'} · ${x.tipo_servico||'Serviço'}${x.observacao?' · '+x.observacao:''}`})}for(const x of faltJust){const id=Number(x.guarda_id)||0,g=gr.find((q:any)=>Number(q.id)===id)||{},tx=`Justificada · ${x.tipo_servico||'Serviço'} · ${x.motivo||'Sem motivo informado'}${x.observacao?' · '+x.observacao:''}`;if(faltMap.has(id))faltMap.get(id).complemento+=` · ${tx}`;else faltMap.set(id,{nome:nm(g),complemento:tx})}const faltas=[...faltMap.values()];
  return {data:dia,efetivo:{ativos:ativos.length,afastados:afastados.length,feristas:feristas.length,servicoA:a.length,servicoB:b.length,detalhes:{ativos:ativos.map((g:any)=>({nome:nm(g),complemento:g.cargo||'GCM'})),afastados:afastados.map((g:any)=>({nome:nm(g),complemento:g.cargo||'Afastado'})),feristas:feristas.map((g:any)=>({nome:nm(g),complemento:`Férias: ${g.mes_ferias||'-'}`})),servicoA:a.map((g:any)=>({nome:g.nome,complemento:`${[...g.postos].join(', ')||'-'} · ${turnoHorario('A')}`})),servicoB:b.map((g:any)=>({nome:g.nome,complemento:`${[...g.postos].join(', ')||'-'} · ${turnoHorario('B')}`}))}},viaturas:{total:vr.length,disponivel:disp.length,emUso:uso.size,baixadas:baix.length,indisponivel:indisp.length,manutencao:manut.length,substituicoes,detalhes:{total:vr.map((v:any)=>bas(v)),disponivel:disp.map((v:any)=>bas(v)),emUso:usoDet,baixadas:baix.map((v:any)=>bas(v)),indisponivel:indisp.map((v:any)=>bas(v)),manutencao:manutDet}},postos:{cobertos:grupos.size,detalhamento:[...grupos.values()].map((g:any)=>({nome:g.nome,complemento:[g.turnos.size&&`Turno(s): ${[...g.turnos].join(', ')}`,g.gcms.size&&`GCM(s): ${[...g.gcms].join(', ')}`].filter(Boolean).join(' · ')}))},cnhVencidas:cnh,faltas:{total:faltas.length,registros:faltas}};
}

async function branding(){
  const rows=await db`select finalidade,nome,arquivo_nome,arquivo_tipo,principal,data_base64,updated_at from public.mobile_branding order by principal desc,finalidade`;
  return rows.map((x:any)=>({...x,data_url:x.data_base64?`data:${x.arquivo_tipo||'image/png'};base64,${x.data_base64}`:null}));
}


function escalaTurno(d:any){
  const t=String(d?.turno||'').toUpperCase();
  if(['A','B','COMPLETO'].includes(t))return t;
  const hi=String(d?.horario_inicio||d?.hist_horario_inicio||'').slice(0,5),hf=String(d?.horario_fim||d?.hist_horario_fim||'').slice(0,5);
  if(hi==='19:00'&&hf==='07:00')return 'B';
  if(hi==='07:00'&&hf==='19:00')return 'A';
  return t||'A';
}
function turnoConflita(a:string,b:string){
  const x=String(a||'').toUpperCase(),y=String(b||'').toUpperCase();
  if(x==='COMPLETO'||y==='COMPLETO')return true;
  return x===y;
}
function guardaCobreTurno(rows:any[],turno:string){
  const alvo=String(turno||'').toUpperCase();
  const ts=new Set(rows.map(x=>escalaTurno(x)));
  if(alvo==='COMPLETO')return ts.has('COMPLETO')||(ts.has('A')&&ts.has('B'));
  return ts.has(alvo)||ts.has('COMPLETO');
}
async function escalasPublicadasDia(data:string){
  const rows=await db`select data from public.mobile_entity_records where entity='escalas' and deleted=false and left(data->>'data',10)=${data}`;
  return rows.map((r:any)=>r.data||{}).filter((d:any)=>!['CANCELADA','EXCLUIDA','INATIVA'].includes(String(d.status||'ATIVA').toUpperCase()));
}
async function validarDisponibilidadePermuta(gid:number,data:string,turno:string,substituidoId:number){
  const dia=await escalasPublicadasDia(data);
  const proprias=dia.filter((d:any)=>Number(d.guarda_id)===gid);
  const conflito=proprias.some((d:any)=>turnoConflita(escalaTurno(d),turno));
  if(conflito)throw new Error('Você já está escalado nesse mesmo período e não pode solicitar esta permuta.');
  const alvo=dia.filter((d:any)=>Number(d.guarda_id)===substituidoId);
  if(!alvo.length)throw new Error('O GCM selecionado não possui serviço publicado nessa data.');
  if(!guardaCobreTurno(alvo,turno))throw new Error('O GCM selecionado não está escalado no período escolhido.');
  const svc=alvo.find((d:any)=>turnoConflita(escalaTurno(d),turno))||alvo[0];
  return svc;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
  try{
    const body=await req.json().catch(()=>({})),action=norm(body.action||'').toLowerCase();
    if(action==='login'){
      const id=norm(body.identificador),senha=String(body.senha||''),remember=Boolean(body.remember);
      if(!id||!senha)return reply(400,{message:'Informe usuário e senha.'});
      const a=await findAccount(id);
      if(!a||!bcrypt.compareSync(senha,String(a.password_hash||'')))return reply(401,{message:'Usuário ou senha inválidos, ou cadastro inativo.'});
      const prof=(await db`select * from public.mobile_profiles where guarda_id=${a.guarda_id} and ativo=true limit 1`)[0];
      if(!prof)return reply(401,{message:'Perfil móvel não disponível.'});
      const token=randomBytes(32).toString('hex'),th=sha(token);
      await db`delete from private.mobile_sessions where expires_at<=now() or revoked=true`;
      await db`insert into private.mobile_sessions(token_sha256,desktop_usuario_id,guarda_id,expires_at)
        values(${th},${a.desktop_usuario_id},${a.guarda_id},now()+case when ${remember} then interval '30 days' else interval '8 hours' end)`;
      const u={...a,...prof},p=await perms(Number(a.guarda_id));
      return reply(200,{token,session:await pub(u,p)});
    }

    const token=bearer(req),u=await sessionByToken(token);
    if(!u)return reply(401,{message:'Sessão não autenticada ou expirada.'});
    const p=await perms(Number(u.guarda_id)),gid=Number(u.guarda_id);

    if(Number(u.senha_trocada||0)===0 && !['session','logout','change_password'].includes(action))
      return reply(428,{message:'Sua senha foi redefinida pelo Comando. Altere a senha temporária antes de continuar.',code:'PASSWORD_CHANGE_REQUIRED'});

    if(action==='session')return reply(200,{session:await pub(u,p)});
    if(action==='logout'){await db`update private.mobile_sessions set revoked=true where token_sha256=${sha(token)}`;return reply(200,{success:true});}
    if(action==='change_password'){
      const atual=String(body.senha_atual||''),nova=String(body.nova_senha||'');
      if(nova.length<6)return reply(400,{message:'A nova senha deve possuir pelo menos 6 caracteres.'});
      const acc=(await db`select * from private.mobile_auth_accounts where desktop_usuario_id=${Number(u.desktop_usuario_id)} and ativo=true limit 1`)[0];
      if(!acc||!bcrypt.compareSync(atual,String(acc.password_hash||'')))return reply(401,{message:'Senha atual inválida.'});
      const hash=bcrypt.hashSync(nova,10);await db`update private.mobile_auth_accounts set password_hash=${hash},senha_trocada=1,updated_at=now() where desktop_usuario_id=${Number(u.desktop_usuario_id)}`;
      await db`insert into public.mobile_action_requests(guarda_id,tipo,payload,status) values(${gid},'SENHA_ALTERADA',${db.json({desktop_usuario_id:Number(u.desktop_usuario_id),guarda_id:gid,password_hash:hash,senha_trocada:1})},'PENDENTE_DESKTOP')`;
      return reply(200,{success:true,message:'Senha alterada. A alteração será sincronizada com o Desktop.'});
    }
    if(action==='reset_password_admin'){
      if(!gestor(u))return reply(403,{message:'Somente o Comando pode redefinir senhas.'});
      const alvo=Number(body.guarda_id||0);if(!alvo)return reply(400,{message:'Selecione o GCM.'});
      const acc=(await db`select * from private.mobile_auth_accounts where guarda_id=${alvo} and ativo=true limit 1`)[0];if(!acc)return reply(404,{message:'Conta do GCM não localizada.'});
      const cpf=norm(acc.cpf).replace(/\D/g,'');if(!cpf)return reply(400,{message:'CPF não cadastrado para este usuário.'});
      const hash=bcrypt.hashSync(cpf,10);await db`update private.mobile_auth_accounts set password_hash=${hash},senha_trocada=0,updated_at=now() where desktop_usuario_id=${Number(acc.desktop_usuario_id)}`;
      await db`insert into public.mobile_action_requests(guarda_id,tipo,payload,status) values(${gid},'SENHA_RESET_COMANDO',${db.json({desktop_usuario_id:Number(acc.desktop_usuario_id),guarda_id:alvo,password_hash:hash,senha_trocada:0,reset_por:gid})},'PENDENTE_DESKTOP')`;
      await insertNotification(db,{guardaId:alvo,tipo:'SENHA_RESET',titulo:'Senha redefinida',mensagem:'Sua senha foi redefinida pelo Comando para a senha padrão (CPF). Altere-a após o próximo acesso.',referenciaTipo:'USUARIO',referenciaId:Number(acc.desktop_usuario_id),dedupeKey:`senha-reset:${acc.desktop_usuario_id}:${Date.now()}`});
      return reply(200,{success:true,message:'Senha redefinida para o CPF do usuário.'});
    }
    if(action==='branding')return reply(200,{branding:await branding()});
    if(action==='entity_catalog')return reply(200,{entities:await entityCatalog(u,p)});
    if(action==='entity_list')return reply(200,await entityList(u,p,body));
    if(action==='entity_mutate')return reply(200,await entityMutate(u,p,body));
    if(action==='references'){
      const fleetAllowed=['viaturas','manutencao_viaturas','abastecimento_viaturas','checklist_viaturas','relatorios_frota'].some(m=>can(u,p,m));
      const peopleAllowed=gestor(u)||['relatorios','permutas','justificativas_faltas','manutencao_viaturas','abastecimento_viaturas','checklist_viaturas','ocorrencias','cautelas','cursos','frequencia'].some(m=>can(u,p,m));
      const viaturas=fleetAllowed?await db`select data->>'id' id,data->>'prefixo' prefixo,data->>'placa' placa,data->>'modelo' modelo,data->>'status' status,data->>'intervalo_troca_oleo_km' intervalo_troca_oleo_km,data->>'km_ultima_troca_oleo' km_ultima_troca_oleo from public.mobile_entity_records where entity='viaturas' and deleted=false order by data->>'prefixo'`:[];
      const guardas=peopleAllowed?await db`select data->>'id' id,data->>'nome_guerra' nome_guerra,data->>'nome_completo' nome_completo from public.mobile_entity_records where entity='guardas' and deleted=false order by data->>'nome_guerra'`:[];
      const equipes=peopleAllowed?await db`select data->>'id' id,data->>'nome' nome from public.mobile_entity_records where entity='equipes' and deleted=false order by data->>'nome'`:[];
      const postos=peopleAllowed?await db`select data->>'id' id,data->>'nome' nome,data->>'tipo' tipo from public.mobile_entity_records where entity='postos' and deleted=false order by data->>'nome'`:[];
      const tipos_escalas=peopleAllowed?await db`select data->>'id' id,data->>'nome' nome,data->>'descricao' descricao from public.mobile_entity_records where entity='tipos_escalas' and deleted=false order by data->>'nome'`:[];
      const eventos=peopleAllowed?await db`select data->>'id' id,data->>'nome' nome,data->>'data' data,data->>'local' local from public.mobile_entity_records where entity='eventos_extras' and deleted=false order by data->>'data' desc`:[];
      const oficios=peopleAllowed?await db`select data->>'id' id,data->>'numero_oficio' numero_oficio,data->>'data_demanda' data_demanda,data->>'local_demanda' local_demanda from public.mobile_entity_records where entity='oficios' and deleted=false order by data->>'data_demanda' desc`:[];
      const grupos_ativacao=can(u,p,'postos')?await db`select data->>'id' id,data->>'nome' nome,data->>'ativo' ativo from public.mobile_entity_records where entity='grupos_ativacao_conjunta' and deleted=false order by data->>'nome'`:[];
      const justificativas=can(u,p,'frequencia')||can(u,p,'justificativas_faltas')?await db`select data->>'id' id,data->>'guarda_id' guarda_id,data->>'data_inicial' data_inicial,data->>'data_final' data_final,data->>'motivo' motivo from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false order by data->>'data_inicial' desc`:[];
      return reply(200,{viaturas,guardas,equipes,postos,tipos_escalas,eventos,oficios,grupos_ativacao,justificativas});
    }
    if(action==='quadro_operacional')return reply(200,await quadroOperacional(norm(body.data)));

    if(action==='relatorio_escalas'){
      if(!(can(u,p,'relatorios')||can(u,p,'escalas')))return reply(403,{message:'Sem permissão para consultar o relatório de escalas.'});
      const rows=await db`select data from public.mobile_entity_records where entity='escalas' and deleted=false order by data->>'data',data->>'turno',data->>'posto_nome',data->>'guarda_id'`;
      const escalas=rows.map((r:any)=>r.data||{}).filter((d:any)=>!['CANCELADA','EXCLUIDA','INATIVA'].includes(String(d.status||'ATIVA').toUpperCase()));
      return reply(200,{escalas});
    }

    if(action==='admin_scale_adjust'){
      if(!gestor(u)||!can(u,p,'escalas','EDICAO'))return reply(403,{message:'Somente o Comando autorizado pode alterar a escala.'});
      const q=body.adjustment||{},escalaId=Number(q.escala_id||0),novoPostoId=Number(q.novo_posto_id||0),novoGuardaId=Number(q.novo_guarda_id||0),motivo=norm(q.motivo);
      if(!escalaId||(!novoPostoId&&!novoGuardaId)||!motivo)return reply(400,{message:'Informe a escala, a alteração desejada e o motivo.'});
      const row=(await db`select record_key,data from public.mobile_entity_records where entity='escalas' and deleted=false and (data->>'id')::bigint=${escalaId} limit 1`)[0];
      if(!row)return reply(404,{message:'Registro da escala não localizado na réplica online.'});
      const atual=row.data||{},data=String(atual.data||q.data||'').slice(0,10),hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
      if(data<hoje)return reply(400,{message:'Escalas anteriores são históricas e não podem ser alteradas.'});
      let posto:any=null,gcm:any=null;
      if(novoPostoId){
        posto=(await db`select data from public.mobile_entity_records where entity='postos' and deleted=false and (data->>'id')::bigint=${novoPostoId} limit 1`)[0]?.data;
        if(!posto)return reply(400,{message:'Novo posto não localizado.'});
        const turno=String(atual.turno||'').toUpperCase(),origemId=Number(atual.posto_id||0);
        const rowsDia=(await db`select data from public.mobile_entity_records where entity='escalas' and deleted=false and left(data->>'data',10)=${data}`).map((x:any)=>x.data||{}).filter((x:any)=>!['CANCELADA','EXCLUIDA','INATIVA','SIMULADA'].includes(String(x.status||'ATIVA').toUpperCase()));
        const destinoMesmoTurno=rowsDia.some((x:any)=>Number(x.posto_id||0)===novoPostoId&&String(x.turno||'').toUpperCase()===turno);
        if(!destinoMesmoTurno&&!Number(posto.funcionamento_24h||0)){
          const origem=(await db`select data from public.mobile_entity_records where entity='postos' and deleted=false and (data->>'id')::bigint=${origemId} limit 1`)[0]?.data||{};
          const hi=String(atual.hist_horario_inicio||origem.horario_inicio||turno).slice(0,5),hf=String(atual.hist_horario_fim||origem.horario_fim||turno).slice(0,5),dhi=String(posto.horario_inicio||'-').slice(0,5),dhf=String(posto.horario_fim||'-').slice(0,5);
          return reply(400,{message:`Alteração não permitida: o serviço atual (${hi} às ${hf}) não é compatível com o horário do destino (${dhi} às ${dhf}). Selecione um posto no mesmo turno.`});
        }
        if(origemId&&origemId!==novoPostoId){
          const origem=(await db`select data from public.mobile_entity_records where entity='postos' and deleted=false and (data->>'id')::bigint=${origemId} limit 1`)[0]?.data||{};
          const idsOrig=new Set(rowsDia.filter((x:any)=>Number(x.posto_id||0)===origemId&&String(x.turno||'').toUpperCase()===turno).map((x:any)=>Number(x.guarda_id||0)).filter(Boolean));
          const idsDest=new Set(rowsDia.filter((x:any)=>Number(x.posto_id||0)===novoPostoId&&String(x.turno||'').toUpperCase()===turno).map((x:any)=>Number(x.guarda_id||0)).filter(Boolean));
          const minO=Number(origem.quantidade_minima||0),maxD=Number(posto.quantidade_maxima||9999);
          if(idsOrig.size-1<minO)return reply(400,{message:`Alteração não permitida: ${norm(origem.nome||atual.posto_nome||atual.posto)} ficaria com ${Math.max(0,idsOrig.size-1)} GCM(s), abaixo do mínimo de ${minO}.`});
          if(idsDest.size+1>maxD)return reply(400,{message:`Alteração não permitida: ${norm(posto.nome)} ficaria com ${idsDest.size+1} GCM(s), acima do máximo de ${maxD}.`});
        }
      }
      if(novoGuardaId){gcm=(await db`select data from public.mobile_entity_records where entity='guardas' and deleted=false and (data->>'id')::bigint=${novoGuardaId} limit 1`)[0]?.data;if(!gcm||String(gcm.status||'ATIVO').toUpperCase()!=='ATIVO')return reply(400,{message:'GCM substituto não está ativo ou não foi localizado.'});}
      const payload={escala_id:escalaId,data,turno:String(atual.turno||''),novo_posto_id:novoPostoId||null,novo_guarda_id:novoGuardaId||null,motivo,antes:{guarda_id:Number(atual.guarda_id||0),guarda_nome:norm(atual.nome_guerra||atual.guarda||atual.guarda_nome),posto_id:Number(atual.posto_id||0),posto_nome:norm(atual.posto_nome||atual.hist_posto_nome||atual.posto)},depois:{guarda_id:novoGuardaId||Number(atual.guarda_id||0),guarda_nome:gcm?norm(gcm.nome_guerra||gcm.nome_completo):norm(atual.nome_guerra||atual.guarda||atual.guarda_nome),posto_id:novoPostoId||Number(atual.posto_id||0),posto_nome:posto?norm(posto.nome):norm(atual.posto_nome||atual.hist_posto_nome||atual.posto)}};
      const cmd=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload) values(${gid},'ESCALA_AJUSTE_COMANDO',${db.json(payload)}) returning id,status,created_at`;
      return reply(200,{success:true,request:cmd[0],message:'Alteração registrada. O Desktop aplicará o ajuste na próxima sincronização e manterá a auditoria.'});
    }

    if(action==='permuta_candidates'){
      if(!can(u,p,'permutas','CONSULTA'))return reply(403,{message:'Sem permissão para utilizar permutas.'});
      const data=norm(body.data),turno=String(body.turno||'').toUpperCase();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||!['A','B','COMPLETO'].includes(turno))return reply(400,{message:'Informe data e período da permuta.'});
      const dia=await escalasPublicadasDia(data);
      const proprias=dia.filter((d:any)=>Number(d.guarda_id)===gid);
      const bloqueado=proprias.some((d:any)=>turnoConflita(escalaTurno(d),turno));
      if(bloqueado)return reply(200,{bloqueado:true,message:'Você já está escalado nesse mesmo período e não pode solicitar permuta.',candidates:[]});
      const porGuarda=new Map<number,any[]>();
      for(const d of dia){const id=Number(d.guarda_id);if(!id||id===gid)continue;if(!porGuarda.has(id))porGuarda.set(id,[]);porGuarda.get(id)!.push(d)}
      const ids=[...porGuarda.entries()].filter(([,rows])=>guardaCobreTurno(rows,turno)).map(([id])=>id);
      if(!ids.length)return reply(200,{bloqueado:false,candidates:[]});
      const allProfiles=await db`select guarda_id,nome_guerra,cargo from public.mobile_profiles where ativo=true order by nome_guerra`;
      const idSet=new Set(ids);const profiles=allProfiles.filter((x:any)=>idSet.has(Number(x.guarda_id)));
      return reply(200,{bloqueado:false,candidates:profiles});
    }

    if(action==='checklist_context'){
      if(!can(u,p,'checklist_viaturas'))return reply(403,{message:'Sem permissão para consultar check-list.'});
      const vid=Number(body.viatura_id||0);if(!vid)return reply(400,{message:'Selecione a viatura.'});
      const vr=(await db`select data from public.mobile_entity_records where entity='viaturas' and deleted=false and (data->>'id')::bigint=${vid} limit 1`)[0];
      const rows=await db`select data from public.mobile_entity_records where entity='checklist_viaturas' and deleted=false and (data->>'viatura_id')::bigint=${vid} order by coalesce(data->>'data','') desc,coalesce(data->>'hora','') desc,updated_at desc limit 10`;
      const items=['pneus','luzes','sirene','giroflex','freios','oleo','agua','combustivel','limpeza','avarias','equipamentos'];
      let previous:any=null,pending:any[]=[],resolvedSeen=new Set<string>();
      for(const r of rows){const d=r.data||{};const problems=items.filter(i=>['ATENÇÃO','NÃO CONFORME'].includes(String(d[i]||'').toUpperCase())).map(i=>({item:i,status:d[i]}));const unresolved=problems.filter(x=>!resolvedSeen.has(x.item));if(unresolved.length){previous=d;pending=unresolved;break;}let resolved:any[]=[];try{resolved=JSON.parse(d.pendencias_resolvidas||'[]')}catch{}for(const x of resolved)resolvedSeen.add(String(x));}
      return reply(200,{vehicle:vr?.data||null,previous,pending});
    }
    if(action==='occurrence_context'){
      if(!can(u,p,'ocorrencias'))return reply(403,{message:'Sem permissão para registrar ocorrência.'});
      const data=norm(body.data)||new Date().toISOString().slice(0,10),hora=norm(body.hora)||'12:00';
      if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return reply(400,{message:'Data inválida.'});
      const rows=await db`select data from public.mobile_entity_records where entity='escalas' and deleted=false and left(data->>'data',10)=${data}`;
      const hh=Number(String(hora).slice(0,2)||0),turno=hh>=19||hh<7?'B':'A';
      const valid=rows.map((r:any)=>r.data||{}).filter((d:any)=>!['CANCELADA','EXCLUIDA','INATIVA'].includes(String(d.status||'ATIVA').toUpperCase())).filter((d:any)=>{const tr=String(d.turno||'').toUpperCase(),is24=Number(d.jornada_24h||0)===1||String(d.tipo_jornada||'').includes('24');return is24||tr===turno});
      const own=valid.find((d:any)=>Number(d.guarda_id)===gid);const ownPost=Number(own?.posto_id||0),ownName=norm(own?.posto_nome||own?.hist_posto_nome||own?.posto);
      const ids=new Set<number>();for(const d of valid){const samePost=ownPost?Number(d.posto_id||0)===ownPost:ownName?norm(d.posto_nome||d.hist_posto_nome||d.posto)===ownName:true;if(samePost)ids.add(Number(d.guarda_id));}
      ids.add(gid);const profiles=await db`select guarda_id,nome_guerra,cargo from public.mobile_profiles where ativo=true order by nome_guerra`;return reply(200,{data,hora,turno,posto:ownName||null,team:profiles.filter((x:any)=>ids.has(Number(x.guarda_id)))});
    }

    if(action==='mark_notification_read'){
      const id=Number(body.id||0);if(!id)return reply(400,{message:'Notificação inválida.'});
      await db`update public.mobile_notifications set lida_em=coalesce(lida_em,now()) where id=${id} and guarda_id=${gid}`;
      return reply(200,{success:true});
    }

    if(action==='request_bank_correction'){
      if(!can(u,p,'banco_horas','EDICAO'))return reply(403,{message:'Sem permissão para solicitar correção do banco de horas.'});
      const q=body.request||{};
      if(!/^\d{4}-\d{2}$/.test(String(q.competencia||''))||!/^\d{4}-\d{2}-\d{2}$/.test(String(q.data_servico||''))||!norm(q.descricao)||Number(q.minutos_solicitados||0)<30||Number(q.minutos_solicitados||0)%30!==0)
        return reply(400,{message:'Informe competência, data, descrição e uma quantidade em blocos de 30 minutos (mínimo 30).'});
      const rows=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload)
        values(${gid},'BANCO_HORAS_CORRECAO',${db.json(q)}) returning id,status,created_at`;
      return reply(200,{success:true,request:rows[0]});
    }

    if(action==='extra_swap_candidates'){
      if(!can(u,p,'permutas','CONSULTA'))return reply(403,{message:'Sem permissão para consultar serviços extras para troca.'});
      const rows=await db`select data from public.mobile_entity_records where entity='escalas_extras_manuais' and deleted=false and upper(coalesce(data->>'status','ATIVA'))='ATIVA' order by data->>'data',data->>'horario_inicio'`;
      const prof=await db`select guarda_id,nome_guerra from public.mobile_profiles where ativo=true`;const nomes=new Map(prof.map((x:any)=>[Number(x.guarda_id),x.nome_guerra]));
      const extras=rows.map((r:any)=>r.data||{}).map((x:any)=>({...x,nome_guerra:nomes.get(Number(x.guarda_id))||'GCM'}));
      return reply(200,{mine:extras.filter((x:any)=>Number(x.guarda_id)===gid),others:extras.filter((x:any)=>Number(x.guarda_id)!==gid)});
    }

    if(action==='request_permuta'){
      if(!can(u,p,'permutas','CONSULTA'))return reply(403,{message:'Sem permissão para utilizar permutas.'});
      const q=body.request||{},modalidade=String(q.modalidade||'ASSUNCAO').toUpperCase();
      if(!q.concordou_termo)return reply(400,{message:'Leia e aceite o termo de responsabilidade.'});
      if(!['ASSUNCAO','TROCA_ORDINARIO'].includes(modalidade))return reply(400,{message:'Modalidade não suportada nesta rota.'});
      if(modalidade==='TROCA_ORDINARIO'){
        const data1=String(q.data||''),turno1=String(q.turno||'').toUpperCase(),data2=String(q.data_contrapartida||''),turno2=String(q.turno_contrapartida||'').toUpperCase(),outro=Number(q.contraparte_id||q.substituido_id||0);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(data1)||!['A','B','COMPLETO'].includes(turno1)||!/^\d{4}-\d{2}-\d{2}$/.test(data2)||!['A','B','COMPLETO'].includes(turno2)||!outro||outro===gid)
          return reply(400,{message:'Na troca ordinário x ordinário, identifique os dois serviços: data, turno e GCM da contraparte.'});
        const hojePermuta=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
        if(data1<hojePermuta||data2<hojePermuta)return reply(409,{message:'Troca de serviços já ocorridos não é permitida.'});
        if((turno1==='COMPLETO'?1440:720)!==(turno2==='COMPLETO'?1440:720))return reply(409,{message:'Troca de serviços ordinários exige duração equivalente.'});
        const d1=await escalasPublicadasDia(data1),d2=await escalasPublicadasDia(data2);
        const alvo1=d1.filter((x:any)=>Number(x.guarda_id)===outro);
        const alvo2=d2.filter((x:any)=>Number(x.guarda_id)===gid);
        if(!alvo1.length||!guardaCobreTurno(alvo1,turno1))return reply(400,{message:'O primeiro serviço não pertence ao GCM da contraparte no período informado.'});
        if(!alvo2.length||!guardaCobreTurno(alvo2,turno2))return reply(400,{message:'O segundo serviço não pertence ao solicitante no período informado.'});
        q.modalidade='TROCA_ORDINARIO';q.servico_extra=0;q.substituto_id=gid;q.substituido_id=outro;q.contraparte_id=outro;q.turno=turno1;q.turno_contrapartida=turno2;
        const conflitoOutros=await db`select id from public.mobile_action_requests where tipo='PERMUTA'
          and status in ('AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO','ACEITE_PENDENTE_DESKTOP','DECISAO_PENDENTE_DESKTOP')
          and upper(coalesce(payload->>'modalidade','ASSUNCAO')) not in ('TROCA_EXTRA','CESSAO_EXTRA')
          and coalesce(payload->>'cancelar','false')<>'true'
          and (
            (
              payload->>'data'=${data1} and nullif(payload->>'substituido_id','')::bigint=${outro}
              and (upper(coalesce(payload->>'turno','')) in (${turno1},'COMPLETO') or ${turno1}='COMPLETO')
            ) or (
              payload->>'data_contrapartida'=${data1} and nullif(payload->>'substituto_id','')::bigint=${outro}
              and (upper(coalesce(payload->>'turno_contrapartida','')) in (${turno1},'COMPLETO') or ${turno1}='COMPLETO')
            ) or (
              payload->>'data'=${data2} and nullif(payload->>'substituido_id','')::bigint=${gid}
              and (upper(coalesce(payload->>'turno','')) in (${turno2},'COMPLETO') or ${turno2}='COMPLETO')
            ) or (
              payload->>'data_contrapartida'=${data2} and nullif(payload->>'substituto_id','')::bigint=${gid}
              and (upper(coalesce(payload->>'turno_contrapartida','')) in (${turno2},'COMPLETO') or ${turno2}='COMPLETO')
            )
          ) limit 1`;
        if(conflitoOutros.length)return reply(409,{message:'Um dos serviços ordinários já integra outra permuta pendente.',request_id:Number(conflitoOutros[0].id)});
        const dup=await db`select id from public.mobile_action_requests where tipo='PERMUTA' and status in ('AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO') and coalesce(payload->>'cancelar','false')<>'true' and (
          (payload->>'data'=${data1} and upper(coalesce(payload->>'turno',''))=${turno1} and nullif(payload->>'substituido_id','')::bigint=${outro})
          or (payload->>'data_contrapartida'=${data2} and upper(coalesce(payload->>'turno_contrapartida',''))=${turno2} and nullif(payload->>'substituto_id','')::bigint=${gid})
        ) order by id desc limit 1`;
        if(dup.length)return reply(409,{message:'Um dos serviços já participa de uma permuta pendente.',request_id:Number(dup[0].id)});
        const solicitanteNome=norm(u.nome_guerra||u.nome_completo)||'GCM';
        const created=await db.begin(async sql=>{
          const rows=await sql`insert into public.mobile_action_requests(guarda_id,tipo,payload,status) values(${gid},'PERMUTA',${sql.json(q)},'AGUARDANDO_ACEITE') returning id,status,created_at`;
          await insertNotification(sql,{guardaId:outro,tipo:'PERMUTA_SOLICITADA',titulo:'Troca ordinário x ordinário',mensagem:`${solicitanteNome} propôs troca: você cede ${data1} · ${turno1} e cumprirá ${data2} · ${turno2}. Confira os dois serviços antes de aceitar.`,referenciaTipo:'PERMUTA_SOLICITADA',referenciaId:Number(rows[0].id),dataEvento:data1,dedupeKey:`permuta-ord-ord:${Number(rows[0].id)}:${outro}`});
          return rows[0];
        });
        return reply(200,{success:true,request:created,message:'Troca ordinário x ordinário enviada ao outro GCM para aceite.'});
      }
      if(q.assuncao_sem_troca_confirmada!==true)return reply(400,{message:'Confirme que esta é uma assunção simples, sem serviço de retorno em negociação. Se houver troca, os dois serviços devem ser identificados no ato; se o retorno ainda não estiver definido, use Permuta Agendada da mesma natureza e duração.'});
      q.assuncao_sem_troca_confirmada=true;
      q.servico_extra=0;
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(q.data||''))||!['A','B','COMPLETO'].includes(String(q.turno||'').toUpperCase())||!Number(q.substituido_id))return reply(400,{message:'Preencha data, turno e GCM substituído.'});
      if(Number(q.substituido_id)===gid)return reply(400,{message:'Selecione outro GCM como substituído.'});
      if(String(q.data)<new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}))return reply(409,{message:'Não é permitido solicitar assunção de serviço já ocorrido.'});
      const svc=await validarDisponibilidadePermuta(gid,String(q.data),String(q.turno).toUpperCase(),Number(q.substituido_id));
      q.modalidade='ASSUNCAO';q.servico_extra=0;q.substituto_id=gid;q.posto_nome=q.posto_nome||svc.posto_nome||svc.hist_posto_nome||svc.posto;q.turno=String(q.turno).toUpperCase();
      const conflitoAlvo=await db`select id from public.mobile_action_requests where tipo='PERMUTA'
        and status in ('AGUARDANDO_ACEITE','PENDENTE','PENDENTE_DESKTOP','PROCESSADO','ACEITE_PENDENTE_DESKTOP','DECISAO_PENDENTE_DESKTOP')
        and upper(coalesce(payload->>'modalidade','ASSUNCAO')) not in ('TROCA_EXTRA','CESSAO_EXTRA')
        and coalesce(payload->>'cancelar','false')<>'true'
        and (
          (payload->>'data'=${String(q.data)} and nullif(payload->>'substituido_id','')::bigint=${Number(q.substituido_id)}
            and (upper(coalesce(payload->>'turno','')) in (${String(q.turno).toUpperCase()},'COMPLETO') or ${String(q.turno).toUpperCase()}='COMPLETO'))
          or (payload->>'data_contrapartida'=${String(q.data)} and nullif(payload->>'substituto_id','')::bigint=${Number(q.substituido_id)}
            and (upper(coalesce(payload->>'turno_contrapartida','')) in (${String(q.turno).toUpperCase()},'COMPLETO') or ${String(q.turno).toUpperCase()}='COMPLETO'))
        ) limit 1`;
      if(conflitoAlvo.length)return reply(409,{message:'O serviço já está reservado em outra permuta pendente.',request_id:Number(conflitoAlvo[0].id)});
      const dup=await db`select id,status from public.mobile_action_requests where guarda_id=${gid} and tipo='PERMUTA' and status in ('PENDENTE','PENDENTE_DESKTOP','PROCESSADO','DECISAO_PENDENTE_DESKTOP') and coalesce(payload->>'cancelar','false')<>'true' and payload->>'data'=${String(q.data)} and upper(coalesce(payload->>'turno',''))=${String(q.turno).toUpperCase()} and nullif(payload->>'substituido_id','')::bigint=${Number(q.substituido_id)} order by id desc limit 1`;
      if(dup.length)return reply(409,{message:'Já existe uma solicitação pendente para esse mesmo serviço.',request_id:Number(dup[0].id)});
      const substitutoNome=norm(u.nome_guerra||u.nome_completo)||'GCM',detalhes=`${substitutoNome} registrou que assumirá seu serviço em ${String(q.data)} · turno ${String(q.turno||svc.turno||'-')}${q.posto_nome?' · '+String(q.posto_nome):''}. A solicitação aguarda análise do Comando.`;
      const created=await db.begin(async sql=>{const rows=await sql`insert into public.mobile_action_requests(guarda_id,tipo,payload) values(${gid},'PERMUTA',${sql.json(q)}) returning id,status,created_at`;await insertNotification(sql,{guardaId:Number(q.substituido_id),tipo:'PERMUTA_SOLICITADA',titulo:'Permuta de serviço',mensagem:detalhes,referenciaTipo:'PERMUTA_SOLICITADA',referenciaId:Number(rows[0].id),dataEvento:String(q.data),dedupeKey:`permuta-solicitada:${Number(rows[0].id)}:${Number(q.substituido_id)}`});return rows[0]});
      return reply(200,{success:true,request:created});
    }

    // Trocas/assunções de serviço extra usam exclusivamente gcmbs-actions-v58 / gcmbs-extra-cession-v58.

    if(action==='update_permuta_request'){
      if(!can(u,p,'permutas','CONSULTA'))return reply(403,{message:'Sem permissão para editar sua permuta.'});
      const id=Number(body.id||0),q=body.request||{};
      q.modalidade='ASSUNCAO';
      if(q.assuncao_sem_troca_confirmada!==true)return reply(400,{message:'Confirme que esta é uma assunção simples, sem serviço de retorno em negociação. Trocas devem identificar os dois serviços; se o retorno ainda não estiver definido, use Permuta Agendada.'});
      q.assuncao_sem_troca_confirmada=true;q.servico_extra=0;
      const req=(await db`select * from public.mobile_action_requests where id=${id} limit 1`)[0];
      await permutaMutable(req,gid);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(String(q.data||''))||!['A','B','COMPLETO'].includes(String(q.turno||'').toUpperCase())||!Number(q.substituido_id)||!q.concordou_termo)
        return reply(400,{message:'Preencha data, turno, GCM substituído e aceite o termo.'});
      if(Number(q.substituido_id)===gid)return reply(400,{message:'Selecione outro GCM como substituído.'});
      if(String(q.data)<new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}))return reply(409,{message:'Não é permitido editar permuta para serviço passado.'});
      const svc=await validarDisponibilidadePermuta(gid,String(q.data),String(q.turno).toUpperCase(),Number(q.substituido_id));
      q.substituto_id=gid;q.posto_nome=q.posto_nome||svc.posto_nome||svc.hist_posto_nome||svc.posto;q.turno=String(q.turno).toUpperCase();
      const substitutoNome=norm(u.nome_guerra||u.nome_completo)||'GCM';
      const detalhes=`${substitutoNome} atualizou a solicitação para assumir seu serviço em ${String(q.data)} · turno ${String(q.turno||svc.turno||'-')}${q.posto_nome?' · '+String(q.posto_nome):''}. A solicitação aguarda análise do Comando.`;
      const revisao=Date.now();
      await db.begin(async sql=>{
        await sql`update public.mobile_action_requests set payload=${sql.json({...q,editar:true})},status='PENDENTE_DESKTOP',resposta='Alteração enviada ao Desktop.',processado_em=null where id=${id} and guarda_id=${gid}`;
        await insertNotification(sql,{
          guardaId:Number(q.substituido_id),tipo:'PERMUTA_ATUALIZADA',titulo:'Permuta de serviço atualizada',
          mensagem:detalhes,referenciaTipo:'PERMUTA_SOLICITADA',referenciaId:id,dataEvento:String(q.data),
          dedupeKey:`permuta-atualizada:${id}:${Number(q.substituido_id)}:${revisao}`
        });
      });
      return reply(200,{success:true,id});
    }

    // GCMBS V298: consentimento e identidade do ordinario gravados atomicamente.
    if(action==='accept_ordinary_swap'){
      if(!can(u,p,'permutas','CONSULTA'))return reply(403,{message:'Sem permissão para responder permutas.'});
      const id=Number(body.id||0),aceitou=body.aceitou===true;
      const req=(await db`select * from public.mobile_action_requests where id=${id} and tipo='PERMUTA' limit 1`)[0];
      if(!req||String(req.payload?.modalidade||'').toUpperCase()!=='TROCA_ORDINARIO')return reply(404,{message:'Troca ordinário x ordinário não encontrada.'});
      const q=req.payload||{},outro=Number(q.contraparte_id||q.substituido_id||0);
      if(outro!==gid)return reply(403,{message:'Somente o GCM da contraparte pode responder esta troca.'});
      if(String(req.status||'').toUpperCase()!=='AGUARDANDO_ACEITE')return reply(409,{message:'Esta troca não está aguardando aceite.'});
      const hojeAceite=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
      if(aceitou&&(String(q.data||'').slice(0,10)<hojeAceite||String(q.data_contrapartida||'').slice(0,10)<hojeAceite))return reply(409,{message:'Não é permitido aceitar troca de serviço passado.'});
      if(aceitou&&((String(q.turno).toUpperCase()==='COMPLETO'?1440:720)!==(String(q.turno_contrapartida).toUpperCase()==='COMPLETO'?1440:720)))return reply(409,{message:'Os serviços não têm duração equivalente.'});
      const aceiteEm=new Date().toISOString();
      const novaPayload={...q,aceite_contraparte:aceitou?1:0,aceite_por:gid,aceite_em:aceiteEm};
      if(!aceitou){
        const atualizados=await db`update public.mobile_action_requests
          set status='RECUSADA',resposta='Troca recusada pela contraparte.',processado_em=now(),payload=${db.json(novaPayload)}
          where id=${id} and status='AGUARDANDO_ACEITE' returning id`;
        if(!atualizados.length)return reply(409,{message:'Esta solicitação já foi respondida.'});
        return reply(200,{success:true,id,message:'Troca recusada.'});
      }
      // Dados do ACK devem identificar exatamente os dois serviços e as partes;
      // nunca reenviar uma permuta aprovada ou duplicar seu efeito operacional.
      const identidade={
        modalidade:'TROCA_ORDINARIO',
        solicitante_id:Number(req.guarda_id||0),
        substituto_id:Number(q.substituto_id||req.guarda_id||0),
        substituido_id:Number(q.substituido_id||0),
        contraparte_id:gid,
        data:String(q.data||''),turno:String(q.turno||''),
        data_contrapartida:String(q.data_contrapartida||''),
        turno_contrapartida:String(q.turno_contrapartida||'')
      };
      await db.begin(async sql=>{
        const atualizados=await sql`update public.mobile_action_requests
          set status='PENDENTE_DESKTOP',resposta='Aceita pela contraparte e aguardando recebimento pelo Desktop.',
              processado_em=null,payload=${sql.json(novaPayload)}
          where id=${id} and status='AGUARDANDO_ACEITE' returning id`;
        if(!atualizados.length)throw new Error('Esta solicitação já foi respondida. Atualize a página.');
        await sql`insert into public.mobile_action_requests(guarda_id,tipo,payload,status)
          values(${gid},'PERMUTA_ACEITE_EXTRA',
            ${sql.json({...identidade,identidade,request_id:id,aceitou:true,aceite_em:aceiteEm})},'PENDENTE_DESKTOP')`;
      });
      return reply(200,{success:true,id,message:'Troca aceita e enviada ao Desktop.'});
    }

    if(action==='cancel_permuta_request'){
      if(!can(u,p,'permutas','CONSULTA'))return reply(403,{message:'Sem permissão para cancelar sua permuta.'});
      const id=Number(body.id||0),req=(await db`select * from public.mobile_action_requests where id=${id} limit 1`)[0];
      await permutaMutable(req,gid);
      const q={...(req.payload||{}),cancelar:true};
      await db`update public.mobile_action_requests set payload=${db.json(q)},status='CANCELAMENTO_PENDENTE_DESKTOP',resposta='Cancelamento enviado ao Desktop. A solicitação não pode mais ser editada enquanto aguarda sincronização.',processado_em=null where id=${id} and guarda_id=${gid}`;
      return reply(200,{success:true,id});
    }
    if(action==='decide_permuta_request'){
      if(!gestor(u)||!can(u,p,'permutas','EDICAO'))return reply(403,{message:'Somente Comandante ou Subcomandante autorizados podem decidir permutas.'});
      const id=Number(body.id||0),dec=String(body.decisao||'').toUpperCase(),motivo=norm(body.motivo);
      if(!id||!['APROVADA','NEGADA'].includes(dec))return reply(400,{message:'Solicitação ou decisão inválida.'});
      if(dec==='NEGADA'&&!motivo)return reply(400,{message:'Informe o motivo da recusa.'});
      const req=(await db`select * from public.mobile_action_requests where id=${id} and tipo='PERMUTA' limit 1`)[0];
      if(!req)return reply(404,{message:'Solicitação de permuta não encontrada.'});
      const estado=(await enrichActionRequests([req]))[0],estadoAtual=String(estado?.status||'').toUpperCase();
      if(['APROVADA','REPROVADA','RECUSADA','NEGADA','CANCELADA'].includes(estadoAtual))return reply(409,{message:'A solicitação já recebeu uma decisão final.'});
      if(dec==='APROVADA'){
        const p=req.payload||{},mod=String(p.modalidade||'ASSUNCAO').toUpperCase();
        const bilateral=['TROCA_ORDINARIO','TROCA_EXTRA','CESSAO_EXTRA','TROCA_ORDINARIO_EXTRA'].includes(mod);
        const contra=Number(p.contraparte_id||p.substituido_id||0);
        if(bilateral&&(Number(p.aceite_contraparte||0)!==1||Number(p.aceite_por||0)!==contra||!p.aceite_em))return reply(409,{message:'Aceite identificado da contraparte é obrigatório.'});
        const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
        if([p.data,p.data_contrapartida,p.extra_data,p.extra_origem?.data,p.extra_contrapartida?.data].filter(Boolean).some((data:any)=>String(data).slice(0,10)<hoje))return reply(409,{message:'Serviço passado não pode ser aprovado.'});
        if(mod==='TROCA_ORDINARIO'&&((String(p.turno).toUpperCase()==='COMPLETO'?1440:720)!==(String(p.turno_contrapartida).toUpperCase()==='COMPLETO'?1440:720)))return reply(409,{message:'Os dois serviços ordinários devem ter duração equivalente.'});
        if(mod==='TROCA_EXTRA'&&Number(p.minutos_extra_origem||0)!==Number(p.minutos_extra_contrapartida||0))return reply(409,{message:'Os extras devem ter duração equivalente.'});
        if(!Number(req.desktop_referencia_id||0))return reply(409,{message:'Aguardando o recebimento pelo Desktop.'});
        const espelho=(await db`select data from public.mobile_entity_records where entity='permutas' and record_key=${String(req.desktop_referencia_id)} and deleted=false limit 1`)[0]?.data;
        if(!espelho||['APROVADA','CANCELADA','NEGADA','REPROVADA','REJEITADA'].includes(String(espelho.status||'').toUpperCase()))return reply(409,{message:'Desktop não validou ou a permuta já recebeu decisão.'});
        if(Number(espelho.substituto_id)!==Number(p.substituto_id||req.guarda_id)||Number(espelho.substituido_id)!==Number(p.substituido_id))return reply(409,{message:'Participantes divergem do Desktop.'});
      }
      const q=req.payload||{};
      const identidade={data:q.data||null,turno:q.turno||null,data_contrapartida:q.data_contrapartida||null,turno_contrapartida:q.turno_contrapartida||null,modalidade:q.modalidade||'ASSUNCAO',substituto_id:Number(q.substituto_id||req.guarda_id)||null,substituido_id:Number(q.substituido_id)||null,contraparte_id:Number(q.contraparte_id)||null,extra_id:Number(q.extra_id)||null,extra_contrapartida_id:Number(q.extra_contrapartida_id)||null,extra_tipo_origem:q.extra_tipo_origem||q.extra_tipo||null,extra_tipo_contrapartida:q.extra_tipo_contrapartida||q.extra_contrapartida_tipo||null};
      const payload={request_id:id,desktop_id:req.desktop_referencia_id||null,decisao:dec,motivo_decisao:motivo,solicitante_guarda_id:Number(req.guarda_id),identidade};
      const cmd=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload) values(${gid},'PERMUTA_DECISAO_COMANDO',${db.json(payload)}) returning id,status,created_at`;
      await db`update public.mobile_action_requests set status='DECISAO_PENDENTE_DESKTOP',resposta=${dec==='APROVADA'?'Aprovação registrada pelo Comando e aguardando sincronização.':'Recusa registrada pelo Comando e aguardando sincronização.'},processado_em=null where id=${id}`;
      return reply(200,{success:true,command:cmd[0]});
    }
    if(action==='admin_delete_permuta_request'){
      if(!gestor(u)||!can(u,p,'permutas','EDICAO'))return reply(403,{message:'Somente Comandante ou Subcomandante autorizados podem excluir solicitações de permuta.'});
      const id=Number(body.id||0),motivo=norm(body.motivo);if(!id||!motivo)return reply(400,{message:'Informe a solicitação e o motivo da exclusão.'});
      const req=(await db`select * from public.mobile_action_requests where id=${id} and tipo='PERMUTA' limit 1`)[0];if(!req)return reply(404,{message:'Solicitação de permuta não encontrada.'});
      const estado=(await enrichActionRequests([req]))[0],estadoAtual=String(estado?.status||'').toUpperCase();
      if(['APROVADA','REPROVADA','RECUSADA','NEGADA','CANCELADA'].includes(estadoAtual))return reply(409,{message:'A solicitação já recebeu uma decisão final.'});
      const q=req.payload||{};
      const identidade={data:q.data||null,turno:q.turno||null,data_contrapartida:q.data_contrapartida||null,turno_contrapartida:q.turno_contrapartida||null,modalidade:q.modalidade||'ASSUNCAO',substituto_id:Number(q.substituto_id||req.guarda_id)||null,substituido_id:Number(q.substituido_id)||null,contraparte_id:Number(q.contraparte_id)||null,extra_id:Number(q.extra_id)||null,extra_contrapartida_id:Number(q.extra_contrapartida_id)||null,extra_tipo_origem:q.extra_tipo_origem||q.extra_tipo||null,extra_tipo_contrapartida:q.extra_tipo_contrapartida||q.extra_contrapartida_tipo||null};
      const payload={request_id:id,desktop_id:req.desktop_referencia_id||null,motivo,solicitante_guarda_id:Number(req.guarda_id),identidade};
      const cmd=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload) values(${gid},'PERMUTA_EXCLUSAO_COMANDO',${db.json(payload)}) returning id,status,created_at`;
      await db`update public.mobile_action_requests set status='CANCELAMENTO_COMANDO_PENDENTE',resposta='Exclusão administrativa registrada e aguardando sincronização.',processado_em=null where id=${id}`;
      return reply(200,{success:true,command:cmd[0]});
    }
    if(action==='decide_bank_request'){
      if(!gestor(u)||!can(u,p,'banco_horas','EDICAO'))return reply(403,{message:'Somente Comandante ou Subcomandante autorizados podem analisar o Banco de Horas.'});
      const id=Number(body.id||0),dec=String(body.decisao||'').toUpperCase(),aj=body.ajustes||{},motivo=norm(aj.motivo);
      if(!id||!['APROVADA','RECUSADA'].includes(dec))return reply(400,{message:'Solicitação ou decisão inválida.'});
      if(dec==='RECUSADA'&&!motivo)return reply(400,{message:'Informe o motivo da recusa.'});
      const req=(await db`select * from public.mobile_action_requests where id=${id} and tipo='BANCO_HORAS_CORRECAO' limit 1`)[0];if(!req)return reply(404,{message:'Solicitação de Banco de Horas não encontrada.'});
      const estado=(await enrichActionRequests([req]))[0],estadoAtual=String(estado?.status||'').toUpperCase();
      if(['APROVADA','RECUSADA','REPROVADA','NEGADA','CANCELADA'].includes(estadoAtual))return reply(409,{message:'A solicitação já recebeu uma decisão final.'});
      const original=req.payload||{},min=Math.round(Number(aj.minutos_solicitados||original.minutos_solicitados||0));if(dec==='APROVADA'&&(min<30||min%30!==0))return reply(400,{message:'A quantidade aprovada deve usar blocos de 30 minutos, com mínimo de 30.'});
      const identidade={guarda_id:Number(req.guarda_id),competencia:original.competencia||null,data_servico:original.data_servico||null};
      const payload={request_id:id,desktop_id:req.desktop_referencia_id||null,decisao:dec,minutos_solicitados:min,classe:String(aj.classe||original.classe||'50'),motivo_recusa:dec==='RECUSADA'?motivo:'',observacao_comando:motivo,solicitante_guarda_id:Number(req.guarda_id),identidade};
      const cmd=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload) values(${gid},'BANCO_HORAS_DECISAO_COMANDO',${db.json(payload)}) returning id,status,created_at`;
      await db`update public.mobile_action_requests set status='DECISAO_PENDENTE_DESKTOP',resposta=${dec==='APROVADA'?'Análise do Comando registrada e aguardando sincronização.':'Recusa do Comando registrada e aguardando sincronização.'},processado_em=null where id=${id}`;
      return reply(200,{success:true,command:cmd[0]});
    }

    if(action==='send_message'){
      if(!gestor(u)||!can(u,p,'central_pendencias','EDICAO'))return reply(403,{message:'Somente Comandante ou Subcomandante autorizados em Pendências podem enviar mensagens institucionais.'});
      const m=body.message||{},titulo=norm(m.titulo)||'Comunicado do Comando',texto=norm(m.mensagem),nivel=['NORMAL','IMPORTANTE','URGENTE'].includes(String(m.nivel||'NORMAL').toUpperCase())?String(m.nivel||'NORMAL').toUpperCase():'NORMAL';
      if(!texto)return reply(400,{message:'Informe o conteúdo da mensagem.'});
      let ids:number[]=[];const dest=String(m.destino||'TODOS').toUpperCase();
      if(dest==='TODOS') ids=(await db`select guarda_id from public.mobile_profiles where ativo=true`).map((x:any)=>Number(x.guarda_id));
      else if(dest==='ATIVOS'){
        const hoje=new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
        const profiles=await db`select guarda_id from public.mobile_profiles where ativo=true`;
        const indisponiveis=await db`select distinct nullif(data->>'guarda_id','')::bigint guarda_id from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false and upper(coalesce(data->>'status','ATIVA'))='ATIVA' and ${hoje} between data->>'data_inicial' and data->>'data_final'`;
        const off=new Set(indisponiveis.map((x:any)=>Number(x.guarda_id)));ids=profiles.map((x:any)=>Number(x.guarda_id)).filter((id:number)=>!off.has(id));
      }else if(dest==='SERVICO_DATA'){
        const data=String(m.data_servico||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return reply(400,{message:'Informe a data do serviço para selecionar os destinatários.'});
        const esc=await escalasPublicadasDia(data);ids=[...new Set(esc.map((x:any)=>Number(x.guarda_id)).filter((x:number)=>x>0))];
      }else ids=(Array.isArray(m.guarda_ids)?m.guarda_ids:[]).map(Number).filter((x:number)=>x>0);
      ids=[...new Set(ids)];if(!ids.length)return reply(400,{message:'Selecione ao menos um destinatário.'});
      const remetente=norm(u.nome_guerra||u.nome_completo)||'Comando';
      const fim=m.fim_em?new Date(String(m.fim_em)).toISOString():null;
      const destinoFinal=String(m.destino||'TODOS').toUpperCase()==='TODOS'?'TODOS':'SELECIONADOS';
      const noticeId=await db.begin(async sql=>{
        const noticeRows=await sql`insert into public.mobile_institutional_notices(titulo,mensagem,nivel,destino,destinatarios,fim_em,criado_por_guarda_id,criado_por_nome) values(${titulo},${texto},${nivel},${destinoFinal},${ids},${fim},${gid},${remetente}) returning id`;
        const nid=Number(noticeRows[0]?.id||0);
        for(const id of ids)await insertNotification(sql,{
          guardaId:id,tipo:'AVISO_INSTITUCIONAL',titulo,mensagem:`${remetente}: ${texto}`,
          referenciaTipo:'AVISO_INSTITUCIONAL',referenciaId:nid,dedupeKey:`aviso:${nid}:${id}`
        });
        return nid;
      });
      return reply(200,{success:true,enviadas:ids.length,notice_id:noticeId});
    }

    if(action==='data'){
      const management=gestor(u);
      const escalaInstitucional=can(u,p,'escalas')||can(u,p,'relatorios');
      // Escalas/Relatórios são uma visão institucional publicada: todo usuário autorizado
      // enxerga a composição completa, com nome de guerra, posto, turno e horário.
      const escalas=escalaInstitucional
        ? await db`select e.*,pr.nome_guerra,pr.cargo from public.mobile_escalas e left join public.mobile_profiles pr on pr.guarda_id=e.guarda_id order by e.data,e.turno,e.guarda_id`
        : [];
      // Extras só aparecem quando o próprio módulo foi autorizado. Gestão vê todos; GCM comum, apenas os próprios.
      // GCMBS V282-L - Extras usam a replica canonica por registro.
      // mobile_extras permanece apenas como legado; nao e fonte de verdade.
      let extras:any[]=[];
      if(can(u,p,'escala_extra_manual')){
        const extraRows=await db`
          select record_key,data
          from public.mobile_entity_records
          where entity='escalas_extras_manuais'
            and deleted=false
          order by coalesce(data->>'data',''),
                   coalesce(data->>'horario_inicio',''),
                   record_key
        `;

        const extraData=extraRows
          .map((r:any)=>{
            const d=r.data||{};
            return {
              ...d,
              desktop_id:Number(d.id||r.record_key)||null,
              guarda_id:Number(d.guarda_id)||null
            };
          })
          .filter((x:any)=>x.guarda_id>0);

        const visiveis=management
          ? extraData
          : extraData.filter((x:any)=>Number(x.guarda_id)===gid);

        const extraGuardaIds=[
          ...new Set(
            visiveis
              .map((x:any)=>Number(x.guarda_id))
              .filter((x:number)=>x>0)
          )
        ];

        const extraProfiles=extraGuardaIds.length
          ? await db`
              select guarda_id,nome_guerra,cargo
              from public.mobile_profiles
              where guarda_id=any(${extraGuardaIds})
            `
          : [];

        const extraProfileMap=new Map(
          extraProfiles.map((x:any)=>[
            Number(x.guarda_id),
            x
          ])
        );

        extras=visiveis.map((x:any)=>{
          const pr=extraProfileMap.get(Number(x.guarda_id))||{};
          return {
            ...x,
            nome_guerra:pr.nome_guerra||null,
            cargo:pr.cargo||null
          };
        });
      }
      let permutas:any[]=[];
      if(can(u,p,'permutas')){
        const mirrorRows=await db`select data from public.mobile_entity_records where entity='permutas' and deleted=false order by coalesce(data->>'data','') desc, record_key desc`;
        permutas=mirrorRows.map((x:any)=>x.data||{});
        if(!management) permutas=permutas.filter((x:any)=>Number(x.substituido_id)===gid||Number(x.substituto_id)===gid||Number(x.solicitante_guarda_id)===gid);
        const ids=[...new Set(permutas.flatMap((x:any)=>[Number(x.substituido_id),Number(x.substituto_id),Number(x.solicitante_guarda_id)]).filter((x:number)=>x>0))];
        const names=ids.length?await db`select guarda_id,nome_guerra from public.mobile_profiles where guarda_id=any(${ids})`:[];
        const nmMap=new Map(names.map((x:any)=>[Number(x.guarda_id),x.nome_guerra]));
        permutas=permutas.map((x:any)=>({...x,substituido_nome:nmMap.get(Number(x.substituido_id))||x.substituido_nome||null,substituto_nome:nmMap.get(Number(x.substituto_id))||x.substituto_nome||null}));
      }
      const banco=can(u,p,'banco_horas')
        ? management
          ? await db`select b.*,pr.nome_guerra,pr.cargo from public.mobile_banco_horas b left join public.mobile_profiles pr on pr.guarda_id=b.guarda_id order by b.competencia desc,b.data_fato desc,b.desktop_id desc`
          : await db`select b.*,pr.nome_guerra,pr.cargo from public.mobile_banco_horas b left join public.mobile_profiles pr on pr.guarda_id=b.guarda_id where b.guarda_id=${gid} order by b.competencia desc,b.data_fato desc,b.desktop_id desc`
        : [];
      const institutionalNotices=await db`select id,titulo,mensagem,nivel,destino,destinatarios,inicio_em,fim_em,ativo,criado_por_nome,created_at from public.mobile_institutional_notices where ativo=true and inicio_em<=now() and (fim_em is null or fim_em>=now()) and (destino='TODOS' or ${gid}=any(destinatarios)) order by case upper(nivel) when 'URGENTE' then 1 when 'IMPORTANTE' then 2 else 3 end, created_at desc limit 50`;
      const visibleActionTypes:string[]=[];
      if(can(u,p,'permutas')) visibleActionTypes.push('PERMUTA');
      if(can(u,p,'banco_horas')) visibleActionTypes.push('BANCO_HORAS_CORRECAO');
      const actionRaw=management
        ? visibleActionTypes.length
          ? await db`select r.*,pr.nome_guerra from public.mobile_action_requests r left join public.mobile_profiles pr on pr.guarda_id=r.guarda_id where r.tipo=any(${visibleActionTypes}) order by r.created_at desc limit 200`
          : []
        : visibleActionTypes.length
          ? await db`select r.id,r.guarda_id,r.tipo,r.payload,r.status,r.resposta,r.desktop_referencia_id,r.created_at,r.processado_em,pr.nome_guerra
              from public.mobile_action_requests r
              left join public.mobile_profiles pr on pr.guarda_id=r.guarda_id
             where r.tipo=any(${visibleActionTypes})
               and (
                 r.guarda_id=${gid}
                 or (
                   r.tipo='PERMUTA'
                   and (
                     nullif(r.payload->>'contraparte_id','')::bigint=${gid}
                     or nullif(r.payload->>'substituido_id','')::bigint=${gid}
                     or nullif(r.payload->>'substituto_id','')::bigint=${gid}
                     or nullif(r.payload->>'solicitante_id','')::bigint=${gid}
                     or nullif(r.payload->>'solicitante_guarda_id','')::bigint=${gid}
                   )
                 )
               )
             order by r.created_at desc limit 150`
          : [];
      const actionRequests=await enrichActionRequests(actionRaw as any[]);
      await ensureDecisionNotifications(actionRequests);
      const notificationsOriginais=await db`select id,tipo,titulo,mensagem,referencia_tipo,referencia_id,data_evento,lida_em,created_at from public.mobile_notifications where guarda_id=${gid} order by created_at desc limit 100`;
      // V298: a propria resposta sincronizada prevalece sobre o antigo alerta de atraso.
      // Sem marcacao artificial de leitura e sem nova consulta ao banco.
      const statusFinalPorPedido=new Map(
        actionRequests.filter((x:any)=>x.tipo==='PERMUTA'
          &&['APROVADA','REPROVADA','NEGADA','RECUSADA','REJEITADA','CANCELADA'].includes(String(x.status||'').toUpperCase()))
          .map((x:any)=>[Number(x.id),String(x.status).toUpperCase()])
      );
      const notifications=notificationsOriginais.map((n:any)=>{
        const encerramento=n.tipo==='FLUXO_DESKTOP_ATRASADO'?statusFinalPorPedido.get(Number(n.referencia_id||0)):null;
        return encerramento
          ? {...n,tipo:'FLUXO_DESKTOP_CONCLUIDO',titulo:'Permuta concluída no Desktop',
             mensagem:`Atualização: a permuta #${n.referencia_id} foi concluída (${encerramento}). Aviso anterior superado. Mensagem original: ${n.mensagem||''}`}
          : n;
      });
      const candidates=can(u,p,'permutas','EDICAO')?await db`select guarda_id,nome_guerra,cargo from public.mobile_profiles where ativo=true and guarda_id<>${gid} order by nome_guerra`:[];
      const profiles=management&&can(u,p,'cadastro_guardas')
        ? await db`select guarda_id,nome_guerra,nome_completo,cargo,role,ativo,controle_total from public.mobile_profiles where ativo=true order by nome_guerra`
        : await db`select guarda_id,nome_guerra,nome_completo,cargo,role,ativo,controle_total from public.mobile_profiles where guarda_id=${gid} limit 1`;
      return reply(200,{meta:{formato:'GCMBS_MOBILE_CLOUD_V6',gerado_em:new Date().toISOString(),somente_leitura:false,escopo:management?'GESTAO':(escalaInstitucional?'ESCALA_INSTITUCIONAL':'PESSOAL'),online:true},
        guardas:profiles,escalas,extras,permutas,banco_horas:banco,notifications,institutional_notices:institutionalNotices,action_requests:actionRequests,permutation_candidates:candidates});
    }

    return reply(404,{message:'Ação não encontrada.'});
  }catch(e){
    console.error(e);
    return reply(500,{message:e instanceof Error?e.message:'Erro interno.'});
  }
});

