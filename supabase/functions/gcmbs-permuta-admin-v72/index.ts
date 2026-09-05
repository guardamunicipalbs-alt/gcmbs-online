import postgres from 'npm:postgres@3.4.7';
import { createHash } from 'node:crypto';
const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:1,max_lifetime:5,connect_timeout:5});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const reply=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const norm=(v:unknown)=>String(v??'').trim();
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const bearer=(req:Request)=>{const h=req.headers.get('authorization')||'';return h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():''};
const rank:any={CONSULTA:1,EDICAO:2};
function roleOf(u:any){const r=norm(u?.role||u?.perfil).toLowerCase(),c=norm(u?.cargo).toUpperCase();if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return'comandante';if(r==='subcomandante'||/\bSUBCOMANDANTE\b/.test(c))return'subcomandante';return r||'gcm';}
function gestor(u:any){return ['comandante','subcomandante'].includes(roleOf(u));}
async function auth(req:Request){const token=bearer(req);if(!token)return null;const rows=await db`select s.guarda_id,s.desktop_usuario_id,a.role,p.nome_guerra,p.nome_completo,p.cargo,p.controle_total from private.mobile_sessions s join private.mobile_auth_accounts a on a.desktop_usuario_id=s.desktop_usuario_id and a.ativo=true join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true where s.token_sha256=${sha(token)} and s.revoked=false and s.expires_at>now() limit 1`;return rows[0]||null;}
async function canEdit(u:any){if(!u)return false;if(Boolean(u.controle_total)||roleOf(u)==='comandante')return true;const rows=await db`select upper(nivel) nivel from public.mobile_permissions where guarda_id=${Number(u.guarda_id)} and ativo=true and modulo in ('permutas','*')`;return rows.some((x:any)=>(rank[String(x.nivel).toUpperCase()]||0)>=rank.EDICAO);}
const hoje=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
function identidade(m:any){return{data:m.data||null,turno:m.turno||null,modalidade:m.modalidade||'ASSUNCAO',substituto_id:Number(m.substituto_id)||null,substituido_id:Number(m.substituido_id)||null,extra_id:Number(m.extra_id)||null,extra_contrapartida_id:Number(m.extra_contrapartida_id)||null,extra_tipo_origem:m.extra_tipo_origem||null,extra_tipo_contrapartida:m.extra_tipo_contrapartida||null};}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
 try{
  const u=await auth(req);if(!u)return reply(401,{message:'Sessão não autenticada ou expirada.'});if(!gestor(u)||!(await canEdit(u)))return reply(403,{message:'Somente o Comando autorizado em Permutas pode executar esta decisão.'});
  const b=await req.json().catch(()=>({})),action=norm(b.action).toLowerCase();if(action!=='decide_mirror')return reply(404,{message:'Ação não encontrada.'});
  const id=Number(b.desktop_id||0),dec=norm(b.decisao).toUpperCase(),motivo=norm(b.motivo);if(!id||!['APROVADA','NEGADA'].includes(dec))return reply(400,{message:'Permuta ou decisão inválida.'});if(dec==='NEGADA'&&!motivo)return reply(400,{message:'Informe o motivo da recusa.'});
  const row=(await db`select record_key,data from public.mobile_entity_records where entity='permutas' and deleted=false and coalesce(nullif(data->>'id',''),record_key)::bigint=${id} limit 1`)[0];if(!row)return reply(404,{message:'Permuta Desktop não localizada na réplica.'});const m=row.data||{};if(norm(m.status).toUpperCase()!=='PENDENTE')return reply(409,{message:`A permuta já está ${norm(m.status)||'fora da fila pendente'}.`});
  const data=norm(m.data).slice(0,10);if(dec==='APROVADA'&&data&&data<hoje())return reply(409,{message:'O serviço já ocorreu. A solicitação continua disponível para análise, mas não pode ser aprovada retroativamente porque a escala histórica é imutável.'});
  const mod=norm(m.modalidade).toUpperCase();if(dec==='APROVADA'&&['TROCA_EXTRA','CESSAO_EXTRA','TROCA_ORDINARIO_EXTRA'].includes(mod)&&Number(m.aceite_contraparte||0)!==1)return reply(409,{message:'A solicitação ainda depende do aceite/autorização do outro GCM.'});
  const pending=await db`select id from public.mobile_action_requests where tipo='PERMUTA_DECISAO_COMANDO' and status in ('PENDENTE','PENDENTE_DESKTOP','PROCESSADO') and nullif(payload->>'desktop_id','')::bigint=${id} order by id desc limit 1`;if(pending.length)return reply(409,{message:'Já existe uma decisão do Comando aguardando sincronização para esta permuta.'});
  const payload={request_id:null,desktop_id:id,decisao:dec,motivo_decisao:motivo,solicitante_guarda_id:Number(m.solicitante_id||m.substituto_id||0)||null,identidade:identidade(m),origem:'ONLINE_ESPELHO_V72'};
  const cmd=await db`insert into public.mobile_action_requests(guarda_id,tipo,payload,status) values(${Number(u.guarda_id)},'PERMUTA_DECISAO_COMANDO',${db.json(payload)},'PENDENTE_DESKTOP') returning id,status,created_at`;
  return reply(200,{success:true,command:cmd[0],message:dec==='APROVADA'?'Aprovação registrada e aguardando aplicação pelo Desktop.':'Recusa registrada e aguardando consolidação pelo Desktop.'});
 }catch(e){console.error(e);return reply(500,{message:e instanceof Error?e.message:'Erro interno.'});}
});
