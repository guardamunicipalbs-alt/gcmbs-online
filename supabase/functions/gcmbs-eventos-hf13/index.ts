import postgres from 'npm:postgres@3.4.7';
import { createHash } from 'node:crypto';

const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:1,max_lifetime:5,connect_timeout:5});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const reply=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const norm=(v:unknown)=>String(v??'').trim();
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const bearer=(req:Request)=>{const h=req.headers.get('authorization')||'';return h.toLowerCase().startsWith('bearer ')?h.slice(7).trim():''};
const rank:any={CONSULTA:1,EDICAO:2};

async function auth(req:Request){const t=bearer(req);if(!t)return null;const r=await db`select s.guarda_id,s.desktop_usuario_id,p.nome_guerra,p.nome_completo,p.cargo,p.role,p.controle_total from private.mobile_sessions s join public.mobile_profiles p on p.guarda_id=s.guarda_id and p.ativo=true where s.token_sha256=${sha(t)} and s.revoked=false and s.expires_at>now() limit 1`;return r[0]||null;}
function role(u:any){const r=norm(u?.role).toLowerCase(),c=norm(u?.cargo).toUpperCase();if(r==='comandante'||(/\bCOMANDANTE\b/.test(c)&&!/SUBCOMANDANTE/.test(c)))return'comandante';if(r==='subcomandante'||/\bSUBCOMANDANTE\b/.test(c))return'subcomandante';return r||'gcm';}
async function canEdit(u:any){if(Boolean(u?.controle_total)||role(u)==='comandante')return true;const p=await db`select modulo,upper(nivel) nivel,ativo from public.mobile_permissions where guarda_id=${Number(u.guarda_id)} and ativo=true`;return p.some((x:any)=>(x.modulo==='eventos_extra'||x.modulo==='*')&&(rank[String(x.nivel).toUpperCase()]||0)>=2);}
function mins(v:any){const m=norm(v).slice(0,5).match(/^(\d{2}):(\d{2})$/);return m?Number(m[1])*60+Number(m[2]):null;}
function overlap(ai:any,af:any,bi:any,bf:any){let a=mins(ai),b=mins(af),c=mins(bi),d=mins(bf);if(a==null||b==null||c==null||d==null)return false;if(b<=a)b+=1440;if(d<=c)d+=1440;return b>c&&a<d;}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
  try{
    const u=await auth(req);if(!u)return reply(401,{message:'Sessão não autenticada ou expirada.'});
    if(!(await canEdit(u)))return reply(403,{message:'Sem permissão de edição em Serviço Extra por Evento.'});
    const b=await req.json().catch(()=>({})),action=norm(b.action).toLowerCase();
    if(action!=='context')return reply(404,{message:'Ação não encontrada.'});
    const data=norm(b.data).slice(0,10),hi=norm(b.horario_inicio).slice(0,5),hf=norm(b.horario_fim).slice(0,5),eventKey=norm(b.record_key),eventId=Number(eventKey)||0;
    const profiles=await db`select guarda_id,nome_guerra,nome_completo,cargo from public.mobile_profiles where ativo=true order by nome_guerra,nome_completo`;
    let selected:number[]=[];
    if(eventId>0){const parts=await db`select data from public.mobile_entity_records where entity='eventos_extras_participantes' and deleted=false and nullif(data->>'evento_id','')::bigint=${eventId}`;selected=[...new Set(parts.map((x:any)=>Number(x.data?.guarda_id)).filter((x:number)=>x>0))];}
    if(!selected.length&&eventKey){const ev=(await db`select data from public.mobile_entity_records where entity='eventos_extras' and record_key=${eventKey} and deleted=false limit 1`)[0];const arr=ev?.data?.guarda_ids;if(Array.isArray(arr))selected=[...new Set(arr.map(Number).filter((x:number)=>x>0))];}
    const justRows=data?await db`select data from public.mobile_entity_records where entity='justificativas_faltas' and deleted=false and upper(coalesce(data->>'status','ATIVA'))='ATIVA' and upper(coalesce(data->>'tipo_servico','ORDINARIO'))='EXTRA' and (data->>'data_inicial')<=${data} and (data->>'data_final')>=${data}`:[];
    const just=new Set(justRows.map((x:any)=>Number(x.data?.guarda_id)).filter((x:number)=>x>0));
    const events=data?await db`select record_key,data from public.mobile_entity_records where entity='eventos_extras' and deleted=false and left(data->>'data',10)=${data} and upper(coalesce(data->>'status','ATIVO')) not in ('CANCELADO','CANCELADA','INATIVO','INATIVA')`:[];
    const eventMap=new Map(events.map((x:any)=>[Number(x.data?.id||x.record_key)||0,x.data||{}]));
    const partRows=data?await db`select data from public.mobile_entity_records where entity='eventos_extras_participantes' and deleted=false`:[];
    const conflict=new Map<number,string>();
    if(data&&hi&&hf){for(const p of partRows){const d=p.data||{},eid=Number(d.evento_id)||0,gid=Number(d.guarda_id)||0;if(!gid||!eid||eid===eventId)continue;const ev=eventMap.get(eid);if(!ev)continue;if(overlap(hi,hf,ev.horario_inicio,ev.horario_fim))conflict.set(gid,norm(ev.nome)||`Evento #${eid}`);}}
    const sel=new Set(selected);
    const guards=profiles.map((g:any)=>{const id=Number(g.guarda_id),reason=just.has(id)?'Possui justificativa ativa para serviço extra nesta data.':conflict.has(id)?`Já está designado para ${conflict.get(id)} no mesmo horário.`:'';return{guarda_id:id,nome_guerra:g.nome_guerra||g.nome_completo||`GCM ${id}`,cargo:g.cargo||'',selected:sel.has(id),eligible:!reason,reason};});
    return reply(200,{success:true,guards,selected});
  }catch(e){console.error('[gcmbs-eventos-hf13]',e);return reply(500,{message:e instanceof Error?e.message:'Erro interno.'});}
});