const V6='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8'};
const reply=(s:number,b:unknown)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const norm=(v:unknown)=>String(v??'').trim();
const ALLOWED:any={
  eventos_extras:new Set(['id','origem_evento','oficio_id','nome','data','horario_inicio','horario_fim','local','observacao','guarda_ids']),
  justificativas_faltas:new Set(['id','data_final','motivo','status','guarda_id','tipo_servico','observacao','arquivo_nome','quantidade_dias','data_inicial','arquivo_tipo','arquivo_dados','remover_arquivo'])
};
function pick(data:any,allowed:Set<string>){const out:any={};if(!data||typeof data!=='object'||Array.isArray(data))return out;for(const k of allowed)if(Object.prototype.hasOwnProperty.call(data,k))out[k]=data[k];return out;}
Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{message:'Método não permitido.'});
  try{
    const auth=req.headers.get('authorization')||'';if(!auth.toLowerCase().startsWith('bearer '))return reply(401,{message:'Sessão não autenticada.'});
    const b=await req.json().catch(()=>({})),entity=norm(b.entity),allowed=ALLOWED[entity];
    if(norm(b.action).toLowerCase()!=='entity_mutate'||!allowed)return reply(400,{message:'Fluxo HF13 inválido.'});
    const payload={action:'entity_mutate',entity,record_key:norm(b.record_key),operation:String(b.operation||'UPSERT').toUpperCase(),data:pick(b.data,allowed),client_change_id:norm(b.client_change_id)};
    const upstream=await fetch(V6,{method:'POST',headers:{'Content-Type':'application/json','Authorization':auth},body:JSON.stringify(payload)});
    const raw=await upstream.text();let body:any={};try{body=JSON.parse(raw||'{}')}catch{body={message:raw||'Resposta inválida da API v6.'}}
    return reply(upstream.status,body);
  }catch(e){console.error('[gcmbs-entity-hf13]',e);return reply(500,{message:e instanceof Error?e.message:'Erro interno.'});}
});