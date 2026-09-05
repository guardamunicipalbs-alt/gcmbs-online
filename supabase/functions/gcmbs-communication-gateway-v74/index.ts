import postgres from 'npm:postgres@3.4.7';
import { createHash, randomUUID } from 'node:crypto';

const CORE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6';
const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:2,max_lifetime:10,connect_timeout:5});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400'};
const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-GCMBS-Api-Version':'10.0.75-domain-gateway'}});
const norm=(v:unknown)=>String(v??'').trim();
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const bearer=(req:Request)=>{const h=req.headers.get('authorization')||'';return h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():''};
const rank:any={CONSULTA:1,EDICAO:2};
const TECH_HIDE=new Set(['password','password_hash','token','token_sha256']);

async function auth(req:Request){
 const token=bearer(req);if(!token)return null;
 const rows=await db`select s.guarda_id,s.desktop_usuario_id,a.role,a.senha_trocada,p.nome_guerra,p.nome_completo,p.cargo,p.controle_total
   from private.mobile_sessions s
   join private.mobile_auth_accounts a on a.desktop_usuario_id=s.desktop_usuario_id and a.ativo=true
   join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true
   where s.token_sha256=${sha(token)} and s.revoked=false and s.expires_at>now() limit 1`;
 return rows[0]||null;
}
function role(u:any){const r=norm(u?.role).toLowerCase(),c=norm(u?.cargo).toUpperCase();if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return'comandante';if(r==='subcomandante'||/\bSUBCOMANDANTE\b/.test(c))return'subcomandante';return r||'gcm';}
const gestor=(u:any)=>['comandante','subcomandante'].includes(role(u));
async function permissions(gid:number){return db`select modulo,upper(nivel) nivel,ativo from public.mobile_permissions where guarda_id=${gid} and ativo=true`;}
function canFrom(u:any,p:any[],modulo:string,nivel='CONSULTA'){if(Boolean(u?.controle_total)||role(u)==='comandante')return true;const alvo=rank[String(nivel).toUpperCase()]||1;return p.some((x:any)=>x?.ativo!==false&&(x.modulo===modulo||x.modulo==='*')&&(rank[String(x.nivel).toUpperCase()]||0)>=alvo);}

async function catalogFor(entityRaw:string){
 const e=norm(entityRaw);
 return (await db`select * from public.mobile_entity_catalog where entity=${e} or ${e}=any(coalesce(aliases,'{}'::text[])) limit 1`)[0]||null;
}
function selectedData(data:any,fields:Set<string>|null,heavy:Set<string>,includeHeavy=false){
 const out:any={};for(const [k,v] of Object.entries(data||{})){if(TECH_HIDE.has(k))continue;if(!includeHeavy&&heavy.has(k))continue;if(fields&&fields.size&&!fields.has(k)&&k!=='id')continue;out[k]=v;}return out;
}
function publicCatalog(cat:any,u:any,p:any[]){
 const heavy=new Set<string>((cat.heavy_fields||[]).map(String));
 const edit=!!cat.writable&&canFrom(u,p,String(cat.modulo||''),'EDICAO');
 const columns=(Array.isArray(cat.columns)?cat.columns:[]).filter((c:any)=>!TECH_HIDE.has(String(c?.name||''))&&!heavy.has(String(c?.name||'')));
 return {entity:cat.entity,modulo:cat.modulo,titulo:cat.titulo,writable:!!cat.writable,protected_write:!!cat.writable||!!cat.protected_write,aliases:cat.aliases||[],scope_fields:cat.scope_fields||[],columns,pk:cat.pk||[],write_fields:cat.write_fields||[],heavy_fields:cat.heavy_fields||[],can_edit:edit,communication_contract:'v74'};
}
async function entityCatalog(req:Request){
 const u=await auth(req);if(!u)return json(401,{message:'Sessão não autenticada ou expirada.'});const p=await permissions(Number(u.guarda_id));
 const rows=await db`select * from public.mobile_entity_catalog order by modulo,titulo`;
 return json(200,{entities:rows.filter((x:any)=>canFrom(u,p,x.modulo)).map((x:any)=>publicCatalog(x,u,p))});
}
async function entityList(req:Request,b:any){
 const u=await auth(req);if(!u)return json(401,{message:'Sessão não autenticada ou expirada.'});const p=await permissions(Number(u.guarda_id)),cat=await catalogFor(b.entity);if(!cat)return json(404,{message:'Entidade online não encontrada.'});if(!canFrom(u,p,cat.modulo))return json(403,{message:'Sem permissão para consultar este módulo.'});
 const limit=Math.min(5000,Math.max(1,Number(b.limit||500))),offset=Math.max(0,Number(b.offset||0));let rows:any[];
 if(gestor(u)||!(Array.isArray(cat.scope_fields)&&cat.scope_fields.length))rows=await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity=${cat.entity} and deleted=false order by updated_at desc limit ${limit} offset ${offset}`;
 else rows=await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity=${cat.entity} and deleted=false and (${Number(u.guarda_id)}=any(scope_guard_ids)) order by updated_at desc limit ${limit} offset ${offset}`;
 const heavy=new Set<string>((cat.heavy_fields||[]).map(String));rows=rows.map((r:any)=>({...r,data:selectedData(r.data,null,heavy,false)}));
 return json(200,{catalog:publicCatalog(cat,u,p),records:rows});
}
async function entityGet(req:Request,b:any){
 const u=await auth(req);if(!u)return json(401,{message:'Sessão não autenticada ou expirada.'});const p=await permissions(Number(u.guarda_id)),cat=await catalogFor(b.entity);if(!cat)return json(404,{message:'Entidade online não encontrada.'});if(!canFrom(u,p,cat.modulo))return json(403,{message:'Sem permissão para consultar este módulo.'});
 const key=norm(b.record_key);if(!key)return json(400,{message:'Registro inválido.'});const rows=await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity=${cat.entity} and record_key=${key} and deleted=false limit 1`;if(!rows.length)return json(404,{message:'Registro não encontrado.'});const r:any=rows[0];if(!gestor(u)&&Array.isArray(cat.scope_fields)&&cat.scope_fields.length&&!((r.scope_guard_ids||[]).map(Number).includes(Number(u.guarda_id))))return json(403,{message:'Registro fora do seu escopo de acesso.'});
 return json(200,{catalog:publicCatalog(cat,u,p),record:{...r,data:selectedData(r.data,null,new Set(),true)}});
}
async function entityMutate(req:Request,b:any){
 const u=await auth(req);if(!u)return json(401,{message:'Sessão não autenticada ou expirada.'});
 const p=await permissions(Number(u.guarda_id)),cat=await catalogFor(b.entity);if(!cat)return json(404,{message:'Entidade online não encontrada.'});
 if(!cat.writable||!canFrom(u,p,cat.modulo,'EDICAO'))return json(403,{message:'Sem permissão de edição online para este módulo.'});
 const op=String(b.operation||'UPSERT').toUpperCase();if(!['UPSERT','DELETE'].includes(op))return json(400,{message:'Operação inválida.'});
 let key=norm(b.record_key);if(!key&&op==='UPSERT')key=`cloud:${randomUUID()}`;if(!key)return json(400,{message:'Registro inválido.'});
 const existing=key?(await db`select scope_guard_ids,data from public.mobile_entity_records where entity=${cat.entity} and record_key=${key} and deleted=false limit 1`)[0]:null;
 const allowed=new Set<string>((cat.write_fields||[]).map(String)),incoming:any={};for(const [k,v] of Object.entries(b.data&&typeof b.data==='object'?b.data:{}))if(allowed.has(k))incoming[k]=v;
 const data=op==='UPSERT'&&existing?.data?{...existing.data,...incoming}:incoming;
 const scopeFields=Array.isArray(cat.scope_fields)?cat.scope_fields:[];let scope=[...new Set(scopeFields.map((f:string)=>Number(data[f])).filter((n:number)=>Number.isInteger(n)&&n>0))];
 if(scopeFields.length&&!gestor(u)){const gid=Number(u.guarda_id);if(existing&&!(existing.scope_guard_ids||[]).map(Number).includes(gid))return json(403,{message:'Registro fora do seu escopo de acesso.'});if(op==='UPSERT'){if(scopeFields.includes('guarda_id')&&!Number(data.guarda_id))data.guarda_id=gid;scope=[...new Set(scopeFields.map((f:string)=>Number(data[f])).filter((n:number)=>Number.isInteger(n)&&n>0))];if(!scope.includes(gid))return json(403,{message:'Não é permitido registrar dados em nome de outro GCM.'});}}
 const clientId=norm(b.client_change_id)||randomUUID();
 const dup=await db`select id,status,response from public.mobile_entity_changes where client_change_id=${clientId} limit 1`;if(dup.length)return json(200,{success:true,queued:true,record_key:key,change_id:dup[0].id,status:dup[0].status,response:dup[0].response||null,communication_contract:'v74'});
 const r=await db`insert into public.mobile_entity_changes(client_change_id,entity,record_key,modulo,operation,data,guarda_id,desktop_usuario_id) values(${clientId},${cat.entity},${key},${cat.modulo},${op},${db.json(data)},${Number(u.guarda_id)},${Number(u.desktop_usuario_id)}) returning id,status`;
 return json(202,{success:true,queued:true,record_key:key,change_id:r[0].id,status:r[0].status||'PENDENTE',message:'Alteração enviada ao Desktop para validação pelas regras canônicas do módulo.',communication_contract:'v74'});
}

function badScale(d:any){return ['CANCELADA','CANCELADO','EXCLUIDA','EXCLUIDO','INATIVA','INATIVO','SIMULADA','SIMULADO'].includes(norm(d?.status||'ATIVA').toUpperCase());}
function escalaTurno(d:any){const t=norm(d?.turno).toUpperCase();if(t)return t;const hi=norm(d?.horario_inicio||d?.hist_horario_inicio).slice(0,5),hf=norm(d?.horario_fim||d?.hist_horario_fim).slice(0,5);if(hi==='19:00'&&hf==='07:00')return'B';if(hi==='07:00'&&hf==='19:00')return'A';return'';}
function escalaNoHorario(d:any,turno:string,hora:string){if(badScale(d))return false;const t=escalaTurno(d);if(t)return t===turno||t==='COMPLETO';const hi=norm(d?.horario_inicio||d?.hist_horario_inicio).slice(0,5),hf=norm(d?.horario_fim||d?.hist_horario_fim).slice(0,5);if(!hi||!hf)return false;if(hi===hf)return true;const mins=(x:string)=>{const [h,m]=x.split(':').map(Number);return h*60+(m||0)};const ag=mins(String(hora||'12:00').slice(0,5)),a=mins(hi),b=mins(hf);return a<b?(ag>=a&&ag<b):(ag>=a||ag<b);}
async function frequencyServices(req:Request,b:any){
 const u=await auth(req);if(!u)return json(401,{message:'Sessão não autenticada ou expirada.'});const p=await permissions(Number(u.guarda_id));if(!canFrom(u,p,'frequencia'))return json(403,{message:'Sem permissão para consultar frequência.'});const data=norm(b.data).slice(0,10);let gid=Number(b.guarda_id||0);if(!/^\d{4}-\d{2}-\d{2}$/.test(data))return json(400,{message:'Informe uma data válida.'});if(!gestor(u))gid=Number(u.guarda_id);if(!gid)return json(400,{message:'Informe o GCM.'});
 const escalas=await db`select record_key,data from public.mobile_entity_records where entity='escalas' and deleted=false and left(data->>'data',10)=${data} and nullif(data->>'guarda_id','') is not null and (data->>'guarda_id')::bigint=${gid}`;const extras=await db`select record_key,data from public.mobile_entity_records where entity='escalas_extras_manuais' and deleted=false and left(data->>'data',10)=${data} and nullif(data->>'guarda_id','') is not null and (data->>'guarda_id')::bigint=${gid}`;const services:any[]=[];for(const r of escalas){const d=r.data||{};if(badScale(d)||norm(d.origem).toUpperCase()==='GERADOR_AUTOMATICO_EXTRA')continue;const ref=Number(d.id||r.record_key||0);if(!ref)continue;const turno=escalaTurno(d),posto=norm(d.posto_nome||d.hist_posto_nome||d.posto||'Serviço ordinário'),hi=norm(d.horario_inicio||d.hist_horario_inicio).slice(0,5),hf=norm(d.horario_fim||d.hist_horario_fim).slice(0,5);services.push({tipo_servico:'ORDINARIO',referencia_id:ref,turno,referencia:[posto,(hi&&hf)?`${hi}–${hf}`:''].filter(Boolean).join(' · ')});}for(const r of extras){const d=r.data||{};if(badScale(d))continue;const ref=Number(d.id||r.record_key||0);if(!ref)continue;const hi=norm(d.horario_inicio).slice(0,5),hf=norm(d.horario_fim).slice(0,5);services.push({tipo_servico:'EXTRA',referencia_id:ref,turno:'EXTRA',referencia:[norm(d.posto||d.funcao||'Serviço extra'),(hi&&hf)?`${hi}–${hf}`:''].filter(Boolean).join(' · ')});}services.sort((a,b)=>String(a.tipo_servico).localeCompare(String(b.tipo_servico))||String(a.turno).localeCompare(String(b.turno))||Number(a.referencia_id)-Number(b.referencia_id));return json(200,{services,communication_contract:'v74'});
}
async function occurrenceContext(req:Request,b:any){
 const u=await auth(req);if(!u)return json(401,{message:'Sessão não autenticada ou expirada.'});const p=await permissions(Number(u.guarda_id));if(!canFrom(u,p,'ocorrencias'))return json(403,{message:'Sem permissão para registrar ocorrência.'});const data=norm(b.data).slice(0,10)||new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'}),hora=norm(b.hora).slice(0,5)||'12:00';if(!/^\d{4}-\d{2}-\d{2}$/.test(data)||!/^\d{2}:\d{2}$/.test(hora))return json(400,{message:'Data ou hora inválida.'});const hh=Number(hora.slice(0,2)),turno=hh>=19||hh<7?'B':'A';const rows=await db`select data from public.mobile_entity_records where entity='escalas' and deleted=false and left(data->>'data',10)=${data}`;const valid=rows.map((r:any)=>r.data||{}).filter((d:any)=>escalaNoHorario(d,turno,hora)&&norm(d.origem).toUpperCase()!=='GERADOR_AUTOMATICO_EXTRA');const ids=new Set<number>();for(const d of valid){const id=Number(d.guarda_id||0);if(id>0)ids.add(id);}const gid=Number(u.guarda_id),own=valid.find((d:any)=>Number(d.guarda_id||0)===gid),ownName=norm(own?.posto_nome||own?.hist_posto_nome||own?.posto)||null;const profiles=await db`select guarda_id,nome_guerra,cargo from public.mobile_profiles where ativo=true order by nome_guerra`;return json(200,{data,hora,turno,posto:ownName,team:profiles.filter((x:any)=>ids.has(Number(x.guarda_id))),communication_contract:'v74'});
}

async function records(entity:string){const rs=await db`select record_key,data from public.mobile_entity_records where entity=${entity} and deleted=false`;return rs.map((r:any)=>({...r.data,id:r.data?.id??(Number.isFinite(Number(r.record_key))?Number(r.record_key):r.record_key)}));}
async function canonicalData(req:Request,bodyText:string){
 const upstream=await fetch(CORE,{method:'POST',headers:{'Content-Type':'application/json',...(req.headers.get('authorization')?{Authorization:req.headers.get('authorization')!}:{})},body:bodyText});let base:any={};try{base=await upstream.json()}catch{return json(502,{message:'Resposta inválida da API base.'})}if(!upstream.ok)return json(upstream.status,base);
 const u=await auth(req);if(!u)return json(401,{message:'Sessão não autenticada ou expirada.'});const p=await permissions(Number(u.guarda_id)),management=gestor(u),gid=Number(u.guarda_id);
 if(canFrom(u,p,'escalas')||canFrom(u,p,'relatorios'))base.escalas=(await records('escalas')).filter((x:any)=>!['CANCELADA','EXCLUIDA','INATIVA'].includes(norm(x.status||'ATIVA').toUpperCase()));
 if(canFrom(u,p,'escala_extra_manual')){let xs=(await records('escalas_extras_manuais'));if(!management)xs=xs.filter((x:any)=>Number(x.guarda_id)===gid);base.extras=xs;}
 if(canFrom(u,p,'permutas')){let xs=await records('permutas');if(!management)xs=xs.filter((x:any)=>[x.substituido_id,x.substituto_id,x.solicitante_id].some((v:any)=>Number(v)===gid));base.permutas=xs;}
 if(canFrom(u,p,'banco_horas')){let mov=await records('banco_horas_movimentacoes');const trans=(await records('folha_pagamento_banco_horas')).filter((x:any)=>norm(x.motivo).toUpperCase().startsWith('LIMITE_84'));const virt:any[]=[];for(const x of trans)for(const classe of ['50','100']){const h=Number(classe==='50'?x.horas_50:x.horas_100)||0;if(h<=0)continue;virt.push({desktop_id:-(Number(x.id)*10+(classe==='50'?1:2)),id:-(Number(x.id)*10+(classe==='50'?1:2)),guarda_id:Number(x.guarda_id),competencia:x.destino_competencia,data_fato:`${x.origem_competencia}-01`,tipo:'Excedente da competência anterior',natureza:'CREDITO',classe,minutos:Math.round(h*60),origem:'FOLHA_PAGAMENTO_LIMITE_84',motivo:`Excedente da competência anterior (${String(x.origem_competencia).slice(5,7)}/${String(x.origem_competencia).slice(0,4)})`,status:'ATIVO'});}mov=mov.map((x:any)=>({...x,desktop_id:Number(x.id),tipo:norm(x.tipo).toUpperCase()==='EXCEDENTE_COMPETENCIA_ANTERIOR'?'Excedente da competência anterior':x.tipo})).concat(virt);if(!management)mov=mov.filter((x:any)=>Number(x.guarda_id)===gid);base.banco_horas=mov;}
 base.meta={...(base.meta||{}),desktop_full_canonical:true,communication_contract:'v74'};return json(200,base);
}

const DOMAIN_TARGETS:Record<string,{url:string,action?:string}>={
 'frequency_list':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-frequency-v62',action:'list'},
 'frequency_save':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-frequency-v62',action:'save'},
 'fleet_state':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-fleet-state-v68',action:'fleet_state'},
 'request_sync':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-request-sync-v62',action:'request_sync'},
 'extras_evento':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-extras-v68',action:'extras_evento'},
 'event_context':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-eventos-hf13',action:'context'},
 'quadro_operacional':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-v62'},
 'sync_status':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-v62'},
 'escala_admin_adjust':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-actions-v62',action:'admin_scale_adjust_v58'},
 'institutional_message_send':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-actions-v62',action:'send_message_v58'},
 'extra_permuta_candidates':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68',action:'candidates'},
 'extra_permuta_request_swap':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68',action:'request_swap'},
 'extra_permuta_request_assumption':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68',action:'request_assumption'},
 'extra_permuta_accept':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68',action:'accept'},
 'mixed_permuta_request':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mixed-permuta-v71',action:'request_mixed_swap'},
 'mixed_permuta_accept':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mixed-permuta-v71',action:'accept_mixed'},
 'permuta_admin_decide_mirror':{url:'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-permuta-admin-v72',action:'decide_mirror'}
};
async function domainDispatch(req:Request,b:any,action:string){
 const cfg=DOMAIN_TARGETS[action];if(!cfg)return null;const h:any={'Content-Type':'application/json'};const a=req.headers.get('authorization');if(a)h.Authorization=a;
 const payload={...b,action:cfg.action||action};delete (payload as any).route;
 const r=await fetch(cfg.url,{method:'POST',headers:h,body:JSON.stringify(payload)});const raw=await r.arrayBuffer();const headers=new Headers(cors);headers.set('Content-Type',r.headers.get('content-type')||'application/json');headers.set('X-GCMBS-Api-Version','10.0.75-domain-gateway');return new Response(raw,{status:r.status,headers});
}

const CORE_ACTIONS=new Set([
 'login','session','logout','change_password','reset_password_admin','references','branding','relatorio_escalas','permuta_candidates','checklist_context',
 'request_bank_correction','request_permuta','update_permuta_request','cancel_permuta_request','decide_permuta_request','admin_delete_permuta_request','decide_bank_request','mark_notification_read'
]);

async function proxy(req:Request,bodyText:string){const h:any={'Content-Type':'application/json'};const a=req.headers.get('authorization');if(a)h.Authorization=a;const r=await fetch(CORE,{method:'POST',headers:h,body:bodyText});const raw=await r.arrayBuffer();const headers=new Headers(cors);headers.set('Content-Type',r.headers.get('content-type')||'application/json');headers.set('X-GCMBS-Api-Version','10.0.75-legacy-compat');return new Response(raw,{status:r.status,headers});}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return json(405,{message:'Método não permitido.'});try{const bodyText=await req.text();let b:any={};try{b=JSON.parse(bodyText||'{}')}catch{return json(400,{message:'JSON inválido.'})}const action=norm(b.action).toLowerCase();if(action==='entity_catalog')return entityCatalog(req);if(action==='entity_list')return entityList(req,b);if(action==='entity_get')return entityGet(req,b);if(action==='entity_mutate')return entityMutate(req,b);if(action==='data')return canonicalData(req,bodyText);if(action==='frequency_services')return frequencyServices(req,b);if(action==='occurrence_context')return occurrenceContext(req,b);const routed=await domainDispatch(req,b,action);if(routed)return routed;if(CORE_ACTIONS.has(action))return proxy(req,bodyText);return json(404,{message:'Ação não registrada no contrato canônico v74.'});}catch(e){console.error('[gcmbs-v74-gateway]',e);return json(500,{message:e instanceof Error?e.message:'Erro interno.'});}});
