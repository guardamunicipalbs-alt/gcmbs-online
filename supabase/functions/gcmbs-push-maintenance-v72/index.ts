import postgres from 'npm:postgres@3.4.7';
import { createHash } from 'node:crypto';
const db=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:1,idle_timeout:1,max_lifetime:5,connect_timeout:5});
const sha=(v:string)=>createHash('sha256').update(v).digest('hex');
const reply=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json; charset=utf-8'}});
async function authorized(req:Request){const raw=req.headers.get('x-gcmbs-sync-key')||'';if(raw){const r=await db`select 1 from private.mobile_sync_clients where key_sha256=${sha(raw)} and ativo=true limit 1`;if(r.length)return true;}const cron=req.headers.get('x-gcmbs-cron-token')||'';if(cron){const v=await db`select decrypted_secret from vault.decrypted_secrets where name='gcmbs_cron_token' limit 1`;if(v.length&&String(v[0].decrypted_secret)===cron)return true;}return false;}
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
 try{if(!(await authorized(req)))return reply(401,{message:'Chave interna inválida ou ausente.'});
  const sem=await db`update public.mobile_notifications n set push_status='SEM_DISPOSITIVO',push_erro='Nenhum dispositivo push ativo para o GCM.' where n.push_status in ('PENDENTE','ERRO') and not exists(select 1 from private.mobile_push_devices d where d.guarda_id=n.guarda_id and d.ativo=true) returning id`;
  const final=await db`update public.mobile_notifications set push_status='FALHA_FINAL',push_erro=coalesce(push_erro,'Limite de tentativas de push atingido.') where push_status='ERRO' and push_tentativas>=5 returning id`;
  return reply(200,{success:true,sem_dispositivo:sem.length,falha_final:final.length});
 }catch(e){console.error(e);return reply(500,{success:false,message:e instanceof Error?e.message:'Erro interno.'});}
});
