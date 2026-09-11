/* GCMBS V142 — interceptação segura das escritas protegidas já usadas pelo Online/App. */
(()=>{'use strict';
 const MAINT='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-maintenance-v142';
 const FREQ='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-frequency-v142';
 if(window.__gcmbsProtectedFetchV142)return;window.__gcmbsProtectedFetchV142=true;
 const nativeFetch=window.fetch.bind(window);
 window.fetch=async(input,init={})=>{
   try{
     const url=typeof input==='string'?input:String(input?.url||'');
     if(/gcmbs-communication-gateway-v131/.test(url)&&String(init?.method||'GET').toUpperCase()==='POST'&&typeof init?.body==='string'){
       const b=JSON.parse(init.body||'{}');
       if(String(b.action||'').toLowerCase()==='entity_mutate'){
         const entity=String(b.entity||'').toLowerCase(),op=String(b.operation||'UPSERT').toUpperCase();
         let target='',payload=null;
         const cid=String(b.client_change_id||'').trim()||`${entity}-v142:${crypto.randomUUID()}`;
         if(entity==='manutencao_viaturas'){target=MAINT;payload={record_key:b.record_key||'',operation:op,data:b.data||{},client_change_id:cid};}
         if(entity==='frequencia_registros'){
           if(op!=='UPSERT')return new Response(JSON.stringify({message:'Frequência usa atualização protegida; exclusão genérica não é permitida.'}),{status:400,headers:{'Content-Type':'application/json'}});
           target=FREQ;payload={data:b.data||{},client_change_id:cid};
         }
         if(target){
           const headers=new Headers(init.headers||{});headers.set('Content-Type','application/json');
           return nativeFetch(target,{...init,headers,body:JSON.stringify(payload),cache:'no-store'});
         }
       }
     }
   }catch(e){console.error('[GCMBS V142 protected route]',e);}
   return nativeFetch(input,init);
 };
})();
