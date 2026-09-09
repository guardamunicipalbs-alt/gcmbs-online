import postgres from 'npm:postgres@3.4.7';
import { createHash, randomUUID } from 'node:crypto';

const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:1,max_lifetime:5,connect_timeout:5});
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};
const reply=(s:number,b:any)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const norm=(v:any)=>String(v??'').trim();
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const bearer=(r:Request)=>{const h=r.headers.get('authorization')||'';return h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():''};
const blocked=new Set(['CANCELADA','CANCELADO','EXCLUIDA','EXCLUÍDA','INATIVA','INATIVO']);
const MAX_FILE_BYTES=5*1024*1024;

async function auth(req:Request){
  const token=bearer(req);if(!token)return null;
  const rows=await db`select s.guarda_id,s.desktop_usuario_id,p.nome_guerra,p.nome_completo,p.cargo,p.role,p.controle_total
    from private.mobile_sessions s join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true
    where s.token_sha256=${sha(token)} and s.revoked=false and s.expires_at>now() limit 1`;
  return rows[0]||null;
}
function role(u:any){const r=norm(u?.role).toLowerCase(),c=norm(u?.cargo).toUpperCase();if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return'comandante';if(r==='subcomandante'||/\bSUBCOMANDANTE\b/.test(c))return'subcomandante';return r||'gcm'}
const gestor=(u:any)=>Boolean(u?.controle_total)||['comandante','subcomandante'].includes(role(u));
async function canEdit(u:any){
  if(Boolean(u?.controle_total)||role(u)==='comandante')return true;
  const rows=await db`select upper(nivel) nivel from public.mobile_permissions where guarda_id=${Number(u.guarda_id)} and ativo=true and modulo in ('justificativas_faltas','*')`;
  return rows.some((x:any)=>String(x.nivel).toUpperCase()==='EDICAO');
}

const dateNum=(s:string)=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return NaN;return Math.floor(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))/86400000)};
const addDays=(s:string,n:number)=>{const d=dateNum(s);return Number.isFinite(d)?new Date((d+n)*86400000).toISOString().slice(0,10):''};
function normalizePeriodo(dataInicial:any,qtd:any){
  const ini=norm(dataInicial).slice(0,10),dias=Math.trunc(Number(qtd||1));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(ini)||!Number.isFinite(dateNum(ini)))throw new Error('Informe uma data inicial válida.');
  if(!Number.isInteger(dias)||dias<1||dias>365)throw new Error('A quantidade de dias deve ficar entre 1 e 365.');
  return {data_inicial:ini,quantidade_dias:dias,data_final:addDays(ini,dias-1)};
}
function periodOverlap(a1:string,a2:string,b1:string,b2:string){return a1<=b2&&b1<=a2;}
async function existing(key:string){return (await db`select record_key,data from public.mobile_entity_records where entity='justificativas_faltas' and record_key=${key} and deleted=false limit 1`)[0]||null;}
async function pendingKey(key:string){const r=await db`select id from public.mobile_entity_changes where entity='justificativas_faltas' and record_key=${key} and status in ('PENDENTE','PROCESSANDO') limit 1`;return !!r.length;}
async function guardExists(id:number){const r=await db`select data from public.mobile_entity_records where entity='guardas' and deleted=false and nullif(data->>'id','') is not null and (data->>'id')::bigint=${id} limit 1`;return !!r.length;}
async function overlapping(gid:number,tipo:string,ini:string,fim:string,ignoreKey=''){
  const rows=await db`select record_key,data from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false and nullif(data->>'guarda_id','') is not null and (data->>'guarda_id')::bigint=${gid}`;
  for(const r of rows){if(String(r.record_key)===String(ignoreKey))continue;const d=r.data||{};if(blocked.has(norm(d.status||'ATIVA').toUpperCase()))continue;if(norm(d.tipo_servico||'ORDINARIO').toUpperCase()!==tipo)continue;const a=String(d.data_inicial||'').slice(0,10),b=String(d.data_final||d.data_inicial||'').slice(0,10);if(a&&b&&periodOverlap(ini,fim,a,b))return true;}
  const pend=await db`select record_key,data from public.mobile_entity_changes where entity='justificativas_faltas' and operation='UPSERT' and status in ('PENDENTE','PROCESSANDO') and nullif(data->>'guarda_id','') is not null and (data->>'guarda_id')::bigint=${gid}`;
  for(const r of pend){if(String(r.record_key)===String(ignoreKey))continue;const d=r.data||{};if(blocked.has(norm(d.status||'ATIVA').toUpperCase()))continue;if(norm(d.tipo_servico||'ORDINARIO').toUpperCase()!==tipo)continue;const a=String(d.data_inicial||'').slice(0,10),b=String(d.data_final||d.data_inicial||'').slice(0,10);if(a&&b&&periodOverlap(ini,fim,a,b))return true;}
  return false;
}
function safeFileName(v:any){return norm(v).split(/[\\/]/).pop()?.slice(0,180)||'';}
function base64Bytes(v:string){
  const s=v.replace(/\s+/g,'');
  if(!s||s.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw new Error('Conteúdo do documento está corrompido ou não está em Base64 válido.');
  const pad=s.endsWith('==')?2:s.endsWith('=')?1:0;
  return Math.floor(s.length*3/4)-pad;
}
function documentPatch(b:any,old:any={}){
  const hasNew=Boolean(b.arquivo_dados);
  if(!hasNew)return {arquivo_nome:old.arquivo_nome??null,arquivo_tipo:old.arquivo_tipo??null,arquivo_dados:old.arquivo_dados??null};

  const nome=safeFileName(b.arquivo_nome);
  if(!nome)throw new Error('Nome do documento inválido.');

  let tipo=norm(b.arquivo_tipo).toLowerCase();
  let raw=String(b.arquivo_dados||'').trim();
  let payload=raw;

  if(raw.startsWith('data:')){
    const comma=raw.indexOf(',');
    if(comma<0)throw new Error('Conteúdo do documento está em formato inválido.');
    const header=raw.slice(5,comma);
    if(!/;base64$/i.test(header))throw new Error('O documento deve ser enviado em Base64.');
    const headerMime=header.replace(/;base64$/i,'').trim().toLowerCase();
    if(!tipo&&headerMime)tipo=headerMime;
    payload=raw.slice(comma+1);
  }

  tipo=tipo||'application/octet-stream';
  payload=payload.replace(/\s+/g,'');
  const bytes=base64Bytes(payload);
  if(bytes>MAX_FILE_BYTES)throw new Error('O documento deve ter no máximo 5 MB.');

  // V134: qualquer formato é aceito. O MIME é apenas metadado de apresentação;
  // não há bloqueio por extensão/tipo e não exigimos que o prefixo recebido coincida.
  const dados=`data:${tipo};base64,${payload}`;
  return {arquivo_nome:nome,arquivo_tipo:tipo,arquivo_dados:dados};
}
async function enqueue(sql:any,u:any,key:string,data:any){
  await sql`select set_config('gcmbs.justificativa_protected','1',true)`;
  const client=`justificativa-protected:${randomUUID()}`;
  const rows=await sql`insert into public.mobile_entity_changes(client_change_id,entity,record_key,modulo,operation,data,guarda_id,desktop_usuario_id)
    values(${client},'justificativas_faltas',${key},'justificativas_faltas','UPSERT',${sql.json(data)},${Number(u.guarda_id)},${Number(u.desktop_usuario_id)})
    returning id,status,created_at`;
  return rows[0];
}
function tipoServico(v:any){const t=norm(v||'ORDINARIO').toUpperCase();if(!['ORDINARIO','EXTRA'].includes(t))throw new Error('Tipo de serviço inválido.');return t;}

async function createJust(u:any,b:any){
  let gid=Number(b.guarda_id||0);if(!gestor(u))gid=Number(u.guarda_id);if(!gid||!(await guardExists(gid)))return reply(400,{message:'GCM não localizado.'});
  const p=normalizePeriodo(b.data_inicial,b.quantidade_dias),tipo=tipoServico(b.tipo_servico),motivo=norm(b.motivo),observacao=norm(b.observacao);
  if(!motivo)return reply(400,{message:'Informe o motivo / justificativa.'});
  if(await overlapping(gid,tipo,p.data_inicial,p.data_final))return reply(409,{message:'Já existe justificativa ativa ou pendente para este GCM no mesmo período e tipo de serviço.'});
  let doc;try{doc=documentPatch(b,{})}catch(e){return reply(400,{message:e instanceof Error?e.message:'Documento inválido.'})}
  const key=`cloud:${randomUUID()}`,payload={guarda_id:gid,...p,tipo_servico:tipo,motivo,observacao,...doc,status:'ATIVA'};
  const change=await db.begin(sql=>enqueue(sql,u,key,payload));
  return reply(200,{success:true,record_key:key,change,message:'Justificativa enviada ao Desktop para aplicação segura.'});
}
async function updateJust(u:any,b:any){
  const key=norm(b.record_key);if(!key)return reply(400,{message:'Justificativa inválida.'});const row=await existing(key);if(!row)return reply(404,{message:'Justificativa não localizada na réplica do Desktop.'});if(await pendingKey(key))return reply(409,{message:'Já existe alteração pendente para esta justificativa.'});
  const old=row.data||{},oldGid=Number(old.guarda_id||0);if(!gestor(u)&&oldGid!==Number(u.guarda_id))return reply(403,{message:'Registro fora do seu escopo de acesso.'});if(blocked.has(norm(old.status||'ATIVA').toUpperCase()))return reply(409,{message:'Esta justificativa está cancelada/inativa e não pode ser editada.'});
  let gid=Number(b.guarda_id||oldGid);if(!gestor(u))gid=Number(u.guarda_id);if(!gid||!(await guardExists(gid)))return reply(400,{message:'GCM não localizado.'});
  const p=normalizePeriodo(b.data_inicial||old.data_inicial,b.quantidade_dias||old.quantidade_dias),tipo=tipoServico(b.tipo_servico||old.tipo_servico),motivo=norm(b.motivo??old.motivo),observacao=norm(b.observacao??old.observacao);
  if(!motivo)return reply(400,{message:'Informe o motivo / justificativa.'});if(await overlapping(gid,tipo,p.data_inicial,p.data_final,key))return reply(409,{message:'Já existe outra justificativa ativa ou pendente para este GCM no mesmo período e tipo de serviço.'});
  let doc;try{doc=documentPatch(b,old)}catch(e){return reply(400,{message:e instanceof Error?e.message:'Documento inválido.'})}
  const payload={...old,guarda_id:gid,...p,tipo_servico:tipo,motivo,observacao,...doc,status:'ATIVA'};const change=await db.begin(sql=>enqueue(sql,u,key,payload));
  return reply(200,{success:true,change,message:'Alteração da justificativa enviada ao Desktop.'});
}
async function cancelJust(u:any,b:any){
  const key=norm(b.record_key);if(!key)return reply(400,{message:'Justificativa inválida.'});const row=await existing(key);if(!row)return reply(404,{message:'Justificativa não localizada na réplica do Desktop.'});if(await pendingKey(key))return reply(409,{message:'Já existe alteração pendente para esta justificativa.'});const old=row.data||{};if(!gestor(u)&&Number(old.guarda_id)!==Number(u.guarda_id))return reply(403,{message:'Registro fora do seu escopo de acesso.'});if(blocked.has(norm(old.status||'ATIVA').toUpperCase()))return reply(409,{message:'Esta justificativa já está cancelada/inativa.'});
  const payload={...old,status:'CANCELADA'};const change=await db.begin(sql=>enqueue(sql,u,key,payload));return reply(200,{success:true,change,message:'Cancelamento enviado ao Desktop. O histórico da justificativa será preservado.'});
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
  try{const u=await auth(req);if(!u)return reply(401,{message:'Sessão não autenticada ou expirada.'});if(!(await canEdit(u)))return reply(403,{message:'Sem permissão de edição para Justificativa de Faltas.'});const b=await req.json().catch(()=>({})),a=norm(b.action).toLowerCase();if(a==='create')return await createJust(u,b);if(a==='update')return await updateJust(u,b);if(a==='cancel')return await cancelJust(u,b);return reply(404,{message:'Ação de Justificativa de Faltas não encontrada.'});}
  catch(e){console.error('[gcmbs-justificativas-v68]',e);return reply(500,{message:e instanceof Error?e.message:'Erro interno.'});}
});