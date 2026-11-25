import {AuthenticatedProvider} from './data-provider.js?v=100076';

// R2: conserva somente o fluxo de justificativas.
const ENTITY_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
async function post(url,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(payload),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}

const oldEntityMutate=AuthenticatedProvider.prototype.entityMutate;
if(oldEntityMutate&&!oldEntityMutate.__gcmbs_hf13){
  const fn=async function(entity,record_key,operation,data,client_change_id=''){
    const ent=String(entity||''),op=String(operation||'UPSERT').toUpperCase();let d=data&&typeof data==='object'?{...data}:data;
    if(ent==='justificativas_faltas'&&op==='UPSERT'&&d?.arquivo_dados){
      let raw=String(d.arquivo_dados||'');if(raw.length>8*1024*1024)throw new Error('O documento da justificativa excede o limite permitido.');
      if(!d.arquivo_tipo)d.arquivo_tipo='application/octet-stream';
      // O Desktop armazena e visualiza o documento como Data URL, igual ao formulário nativo.
      if(!raw.startsWith('data:'))raw=`data:${d.arquivo_tipo};base64,${raw}`;
      d={...d,arquivo_dados:raw};
    }
    if(ent==='justificativas_faltas'){
      return post(ENTITY_API,{action:'entity_mutate',entity:ent,record_key:record_key||'',operation:op,data:d||{},client_change_id});
    }
    return oldEntityMutate.call(this,entity,record_key,operation,d,client_change_id);
  };
  fn.__gcmbs_hf13=true;AuthenticatedProvider.prototype.entityMutate=fn;
}
