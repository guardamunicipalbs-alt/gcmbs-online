import postgres from 'npm:postgres@3.4.7';
import {createHash} from 'node:crypto';
const VERSION='10.0.175-access-scope';
const CORE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6';
const V131='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';
const QUADRO='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-quadro-canonico-v173';
const EXTRA_PERMUTAS='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-extra-permutas-v68';
const MIXED_PERMUTA='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mixed-permuta-v71';
const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:2,max_lifetime:10,connect_timeout:5});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Max-Age':'86400'};
const reply=(s:number,b:any)=>new Response(JSON.stringify(b),{status:s,headers:{...cors,'Content-Type':'application/json; charset=utf-8','X-GCMBS-Api-Version':VERSION}});
const norm=(v:any)=>String(v??'').trim(),sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const bearer=(r:Request)=>{const h=r.headers.get('authorization')||'';return h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():''};
async function auth(req:Request){const t=bearer(req);if(!t)return null;return (await db`select s.guarda_id,s.desktop_usuario_id,a.role,p.cargo,p.nome_guerra,p.nome_completo,p.controle_total from private.mobile_sessions s join private.mobile_auth_accounts a on a.desktop_usuario_id=s.desktop_usuario_id and a.ativo=true join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true where s.token_sha256=${sha(t)} and s.revoked=false and s.expires_at>now() limit 1`)[0]||null;}
function role(u:any){const r=norm(u?.role).toLowerCase(),c=norm(u?.cargo).toUpperCase();if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return'comandante';if(r==='subcomandante'||/\bSUBCOMANDANTE/.test(c))return'subcomandante';return r||'gcm';}
const gestor=(u:any)=>['comandante','subcomandante'].includes(role(u));
async function canModule(u:any,modulo:string,nivel='CONSULTA'){if(!u)return false;if(Boolean(u.controle_total)||role(u)==='comandante')return true;const rank:any={CONSULTA:1,EDICAO:2},alvo=rank[nivel]||1;const rs=await db`select upper(nivel) nivel from public.mobile_permissions where guarda_id=${Number(u.guarda_id)} and ativo=true and modulo in (${modulo},'*')`;return rs.some((x:any)=>(rank[String(x.nivel).toUpperCase()]||0)>=alvo);}
async function canPermuta(u:any){return canModule(u,'permutas','EDICAO');}
async function call(url:string,req:Request,text:string){const h:any={'Content-Type':'application/json'};const a=req.headers.get('authorization');if(a)h.Authorization=a;const r=await fetch(url,{method:'POST',headers:h,body:text,cache:'no-store'});const raw=await r.arrayBuffer();const hh=new Headers(cors);hh.set('Content-Type',r.headers.get('content-type')||'application/json');hh.set('X-GCMBS-Api-Version',VERSION);return new Response(raw,{status:r.status,headers:hh});}
const final=(s:any)=>['APROVADA','REPROVADA','NEGADA','RECUSADA','CANCELADA'].includes(norm(s).toUpperCase());
async function justificativasList(req:Request,b:any){
 const u=await auth(req);if(!u)return reply(401,{message:'Sessão expirada.'});if(!(await canModule(u,'justificativas_faltas')))return reply(403,{message:'Sem permissão para consultar Justificativa de Faltas.'});
 const cat=(await db`select * from public.mobile_entity_catalog where entity='justificativas_faltas' limit 1`)[0];if(!cat)return reply(404,{message:'Entidade online não encontrada.'});
 const lim=Math.min(5000,Math.max(1,Number(b.limit||500))),off=Math.max(0,Number(b.offset||0));
 const base=gestor(u)?await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false order by updated_at desc`:await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false and ${Number(u.guarda_id)}=any(scope_guard_ids) order by updated_at desc`;
 const pend=gestor(u)?await db`select distinct on(record_key) record_key,data,guarda_id,status,created_at from public.mobile_entity_changes where entity='justificativas_faltas' and operation='UPSERT' and status in ('PENDENTE','PROCESSANDO') order by record_key,created_at desc`:await db`select distinct on(record_key) record_key,data,guarda_id,status,created_at from public.mobile_entity_changes where entity='justificativas_faltas' and operation='UPSERT' and status in ('PENDENTE','PROCESSANDO') and guarda_id=${Number(u.guarda_id)} order by record_key,created_at desc`;
 const map=new Map(base.map((r:any)=>[String(r.record_key),r]));
 for(const p of pend){const old:any=map.get(String(p.record_key));const merged={...(old?.data||{}),...(p.data||{})};delete merged.arquivo_dados;map.set(String(p.record_key),{entity:'justificativas_faltas',record_key:p.record_key,modulo:'justificativas_faltas',scope_guard_ids:[Number(merged.guarda_id||p.guarda_id)].filter(Boolean),data:merged,source:'cloud-pending',revision:old?.revision||0,updated_at:p.created_at});}
 const rows=[...map.values()].sort((a:any,b:any)=>String(b.updated_at||'').localeCompare(String(a.updated_at||''))).slice(off,off+lim).map((r:any)=>{const d={...(r.data||{})};delete d.arquivo_dados;return {...r,data:d};});
 return reply(200,{catalog:{...cat,can_edit:!!cat.writable&&(await canModule(u,'justificativas_faltas','EDICAO'))},records:rows});
}
async function justificativasGet(req:Request,b:any){
 const u=await auth(req);if(!u)return reply(401,{message:'Sessão expirada.'});if(!(await canModule(u,'justificativas_faltas')))return reply(403,{message:'Sem permissão para consultar Justificativa de Faltas.'});const key=norm(b.record_key);if(!key)return reply(400,{message:'Registro inválido.'});
 const cat=(await db`select * from public.mobile_entity_catalog where entity='justificativas_faltas' limit 1`)[0];const base=(await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity='justificativas_faltas' and record_key=${key} and deleted=false limit 1`)[0];
 const p=(await db`select record_key,data,guarda_id,status,created_at from public.mobile_entity_changes where entity='justificativas_faltas' and record_key=${key} and operation='UPSERT' and status in ('PENDENTE','PROCESSANDO') order by created_at desc limit 1`)[0];if(!base&&!p)return reply(404,{message:'Registro não encontrado.'});
 const data={...(base?.data||{}),...(p?.data||{})};if(!gestor(u)&&Number(data.guarda_id)!==Number(u.guarda_id))return reply(403,{message:'Registro fora do seu escopo de acesso.'});
 return reply(200,{catalog:{...cat,can_edit:!!cat?.writable&&(await canModule(u,'justificativas_faltas','EDICAO'))},record:base?{...base,data}:{entity:'justificativas_faltas',record_key:key,modulo:'justificativas_faltas',scope_guard_ids:[Number(data.guarda_id)].filter(Boolean),data,source:'cloud-pending',revision:0,updated_at:p.created_at}});
}

async function catalog(entity:string){return (await db`select * from public.mobile_entity_catalog where entity=${entity} limit 1`)[0]||null;}
async function ocorrenciasList(req:Request,b:any){
 const u=await auth(req);if(!u)return reply(401,{message:'Sessão expirada.'});
 if(!(await canModule(u,'ocorrencias')))return reply(403,{message:'Sem permissão para consultar ocorrências.'});
 const cat=await catalog('ocorrencias_operacionais');if(!cat)return reply(404,{message:'Entidade online não encontrada.'});
 const lim=Math.min(5000,Math.max(1,Number(b.limit||500))),off=Math.max(0,Number(b.offset||0));
 const rows=await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity='ocorrencias_operacionais' and deleted=false order by coalesce(data->>'data','') desc,coalesce(data->>'hora','') desc,updated_at desc limit ${lim} offset ${off}`;
 const canEdit=gestor(u)&&await canModule(u,'ocorrencias','EDICAO');
 return reply(200,{catalog:{...cat,can_edit:canEdit},records:rows});
}
async function ocorrenciasGet(req:Request,b:any){
 const u=await auth(req);if(!u)return reply(401,{message:'Sessão expirada.'});
 if(!(await canModule(u,'ocorrencias')))return reply(403,{message:'Sem permissão para consultar ocorrências.'});
 const key=norm(b.record_key);if(!key)return reply(400,{message:'Registro inválido.'});
 const cat=await catalog('ocorrencias_operacionais');
 const r=(await db`select entity,record_key,modulo,scope_guard_ids,data,source,revision,updated_at from public.mobile_entity_records where entity='ocorrencias_operacionais' and record_key=${key} and deleted=false limit 1`)[0];
 if(!r)return reply(404,{message:'Ocorrência não encontrada.'});
 const canEdit=gestor(u)&&await canModule(u,'ocorrencias','EDICAO');
 return reply(200,{catalog:{...cat,can_edit:canEdit},record:r});
}
async function eventosList(req:Request,b:any){
 const u=await auth(req);if(!u)return reply(401,{message:'Sessão expirada.'});
 if(!(await canModule(u,'eventos_extra')))return reply(403,{message:'Sem permissão para consultar eventos.'});
 if(gestor(u))return call(V131,req,JSON.stringify(b));
 const gid=Number(u.guarda_id),cat=await catalog('eventos_extras');if(!cat)return reply(404,{message:'Entidade online não encontrada.'});
 const lim=Math.min(5000,Math.max(1,Number(b.limit||500))),off=Math.max(0,Number(b.offset||0));
 const rows=await db`
   select e.entity,e.record_key,e.modulo,e.scope_guard_ids,e.data,e.source,e.revision,e.updated_at
   from public.mobile_entity_records e
   where e.entity='eventos_extras' and e.deleted=false
     and exists(
       select 1 from public.mobile_entity_records p
       where p.entity='eventos_extras_participantes' and p.deleted=false
         and nullif(p.data->>'guarda_id','')::bigint=${gid}
         and nullif(p.data->>'evento_id','')::bigint=nullif(e.data->>'id','')::bigint
     )
   order by coalesce(e.data->>'data','') desc,e.updated_at desc
   limit ${lim} offset ${off}`;
 return reply(200,{catalog:{...cat,can_edit:false,writable:false},records:rows});
}
async function eventosGet(req:Request,b:any){
 const u=await auth(req);if(!u)return reply(401,{message:'Sessão expirada.'});
 if(!(await canModule(u,'eventos_extra')))return reply(403,{message:'Sem permissão para consultar eventos.'});
 if(gestor(u))return call(V131,req,JSON.stringify(b));
 const gid=Number(u.guarda_id),key=norm(b.record_key);if(!key)return reply(400,{message:'Registro inválido.'});
 const cat=await catalog('eventos_extras');
 const r=(await db`
   select e.entity,e.record_key,e.modulo,e.scope_guard_ids,e.data,e.source,e.revision,e.updated_at
   from public.mobile_entity_records e
   where e.entity='eventos_extras' and e.record_key=${key} and e.deleted=false
     and exists(
       select 1 from public.mobile_entity_records p
       where p.entity='eventos_extras_participantes' and p.deleted=false
         and nullif(p.data->>'guarda_id','')::bigint=${gid}
         and nullif(p.data->>'evento_id','')::bigint=nullif(e.data->>'id','')::bigint
     )
   limit 1`)[0];
 if(!r)return reply(404,{message:'Evento não encontrado no seu escopo.'});
 return reply(200,{catalog:{...cat,can_edit:false,writable:false},record:r});
}
async function decide(req:Request,b:any){
 const u=await auth(req);if(!u)return reply(401,{message:'Sessão expirada.'});if(!['comandante','subcomandante'].includes(role(u))||!(await canPermuta(u)))return reply(403,{message:'Somente o Comando autorizado pode decidir permutas.'});
 const id=Number(b.id||0),dec=norm(b.decisao).toUpperCase(),mot=norm(b.motivo);if(!id||!['APROVADA','NEGADA'].includes(dec))return reply(400,{message:'Solicitação ou decisão inválida.'});if(dec==='NEGADA'&&!mot)return reply(400,{message:'Informe o motivo da recusa.'});
 const r=(await db`select * from public.mobile_action_requests where id=${id} and tipo='PERMUTA' limit 1`)[0];if(!r)return reply(404,{message:'Solicitação não encontrada.'});if(final(r.status))return reply(409,{message:'A solicitação já recebeu decisão final.'});const q=r.payload||{};
 const ex=await db`select id,status,payload from public.mobile_action_requests where tipo='PERMUTA_DECISAO_COMANDO' and nullif(payload->>'request_id','')::bigint=${id} order by id desc limit 1`;
 if(ex.length){if(!final(r.status))await db`update public.mobile_action_requests set status=${dec},resposta=${dec==='APROVADA'?'Permuta aprovada no Online; sincronização com Desktop pendente.':'Permuta recusada no Online; sincronização com Desktop pendente.'},processado_em=now() where id=${id}`;return reply(200,{success:true,idempotent:true,online_effective:true,desktop_sync_pending:true,command:ex[0],message:dec==='APROVADA'?'Permuta aprovada no Online. Sincronização com o Desktop pendente.':'Permuta recusada no Online. Sincronização com o Desktop pendente.'});}
 const payload={request_id:id,desktop_id:r.desktop_referencia_id||null,decisao:dec,motivo_decisao:mot,solicitante_guarda_id:Number(r.guarda_id),identidade:{data:q.data||null,turno:q.turno||null,modalidade:q.modalidade||'ASSUNCAO',substituto_id:Number(q.substituto_id||r.guarda_id)||null,substituido_id:Number(q.substituido_id)||null,posto_nome:q.posto_nome||null,servico_extra:Number(q.servico_extra||0)},origem:'ONLINE_AUTHORITATIVE_V160',online_effective:true,desktop_sync_pending:true};
 const cmd=await db.begin(async sql=>{const x=await sql`insert into public.mobile_action_requests(guarda_id,tipo,payload,status) values(${Number(u.guarda_id)},'PERMUTA_DECISAO_COMANDO',${sql.json(payload)},'PENDENTE_DESKTOP') returning id,status,created_at`;await sql`update public.mobile_action_requests set status=${dec},resposta=${dec==='APROVADA'?'Permuta aprovada no Online; sincronização com Desktop pendente.':'Permuta recusada no Online; sincronização com Desktop pendente.'},processado_em=now() where id=${id}`;return x[0];});
 return reply(200,{success:true,command:cmd,online_effective:true,desktop_sync_pending:true,message:dec==='APROVADA'?'Permuta aprovada e efetivada no Online. Sincronização com o Desktop pendente.':'Permuta recusada e efetivada no Online. Sincronização com o Desktop pendente.'});
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});try{const text=await req.text();let b:any={};try{b=JSON.parse(text||'{}')}catch{return reply(400,{message:'JSON inválido.'});}const a=norm(b.action).toLowerCase();if(a==='health')return reply(200,{success:true,version:VERSION});if(a==='quadro_operacional')return call(QUADRO,req,text);if(a==='entity_list'&&norm(b.entity)==='justificativas_faltas')return justificativasList(req,b);if(a==='entity_get'&&norm(b.entity)==='justificativas_faltas')return justificativasGet(req,b);if(a==='entity_list'&&norm(b.entity)==='ocorrencias_operacionais')return ocorrenciasList(req,b);if(a==='entity_get'&&norm(b.entity)==='ocorrencias_operacionais')return ocorrenciasGet(req,b);if(a==='entity_list'&&norm(b.entity)==='eventos_extras')return eventosList(req,b);if(a==='entity_get'&&norm(b.entity)==='eventos_extras')return eventosGet(req,b);if(a==='decide_permuta_request')return decide(req,b);if(a==='extra_permuta_candidates')return call(EXTRA_PERMUTAS,req,JSON.stringify({...b,action:'candidates'}));if(a==='extra_permuta_request_swap')return call(EXTRA_PERMUTAS,req,JSON.stringify({...b,action:'request_swap'}));if(a==='extra_permuta_request_assumption')return call(EXTRA_PERMUTAS,req,JSON.stringify({...b,action:'request_assumption'}));if(a==='extra_permuta_accept')return call(EXTRA_PERMUTAS,req,JSON.stringify({...b,action:'accept'}));if(a==='mixed_permuta_request')return call(MIXED_PERMUTA,req,JSON.stringify({...b,action:'request_mixed_swap'}));if(a==='mixed_permuta_accept')return call(MIXED_PERMUTA,req,JSON.stringify({...b,action:'accept_mixed'}));if(['login','session','logout','change_password','reset_password_admin','references','branding','relatorio_escalas','permuta_candidates','checklist_context','request_bank_correction','request_permuta','update_permuta_request','cancel_permuta_request','admin_delete_permuta_request','decide_bank_request','mark_notification_read'].includes(a))return call(CORE,req,text);return call(V131,req,text);}catch(e){console.error('[gcmbs-v173-gateway]',e);return reply(500,{message:e instanceof Error?e.message:'Erro interno.',version:VERSION});}});
