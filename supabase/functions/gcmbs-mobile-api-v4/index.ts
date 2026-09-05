const TARGET='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type,authorization,apikey,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Max-Age':'86400'};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return new Response(JSON.stringify({message:'Método não permitido.'}),{status:405,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});
 const headers=new Headers({'Content-Type':'application/json'});const auth=req.headers.get('authorization');if(auth)headers.set('Authorization',auth);
 try{const body=await req.text();const r=await fetch(TARGET,{method:'POST',headers,body});const out=await r.arrayBuffer();const h=new Headers(cors);h.set('Content-Type',r.headers.get('content-type')||'application/json; charset=utf-8');h.set('X-GCMBS-Legacy-Proxy','10.0.72->v6');h.set('Deprecation','true');return new Response(out,{status:r.status,statusText:r.statusText,headers:h});}
 catch(e){return new Response(JSON.stringify({message:'Rota antiga encaminhada para a API atual, mas a operação falhou.',detail:e instanceof Error?e.message:String(e)}),{status:502,headers:{...cors,'Content-Type':'application/json; charset=utf-8'}});}
});
