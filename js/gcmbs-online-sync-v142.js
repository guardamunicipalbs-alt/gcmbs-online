// GCMBS V142 — roteamento cloud-first compatível inclusive com app-core 10.0.85.
const MAINTENANCE_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-maintenance-v142';
const FREQUENCY_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-frequency-v142';
if(!window.__gcmbsCloudFirstV142){
 window.__gcmbsCloudFirstV142=true;
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(input,init={})=>{
  try{
   const url=typeof input==='string'?input:String(input?.url||'');
   if(/gcmbs-communication-gateway-v131/.test(url)&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string'){
    const b=JSON.parse(init.body||'{}');
    if(String(b.action||'').toLowerCase()==='entity_mutate'){
     const e=String(b.entity||'').toLowerCase(),op=String(b.operation||'UPSERT').toUpperCase();
     const cid=String(b.client_change_id||'').trim()||`${e}-v142:${crypto.randomUUID()}`;
     let target='',payload={};
     if(e==='manutencao_viaturas'){target=MAINTENANCE_API;payload={record_key:b.record_key||'',operation:op,data:b.data||{},client_change_id:cid};}
     if(e==='frequencia_registros'){
      if(op!=='UPSERT')return new Response(JSON.stringify({message:'Frequência usa atualização protegida; exclusão genérica não é permitida.'}),{status:400,headers:{'Content-Type':'application/json'}});
      target=FREQUENCY_API;payload={data:b.data||{},client_change_id:cid};
     }
     if(target){const headers=new Headers(init.headers||{});headers.set('Content-Type','application/json');return nativeFetch(target,{...init,headers,body:JSON.stringify(payload),cache:'no-store'});}
    }
   }
  }catch(e){console.error('[GCMBS V142 cloud-first]',e);}
  return nativeFetch(input,init);
 };
}
console.info('[GCMBS] V142 — manutenção e frequência cloud-first ativas');
