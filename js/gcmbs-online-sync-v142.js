import {AuthenticatedProvider} from './data-provider.js?v=100142';

const MAINTENANCE_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-maintenance-v142';
const token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
async function maintenanceMutate(record_key,operation,data,client_change_id=''){
  const t=token();if(!t)throw new Error('Sessão online não autenticada.');
  const r=await fetch(MAINTENANCE_API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({record_key,operation,data,client_change_id:client_change_id||`online-v142:${crypto.randomUUID()}`}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
const original=AuthenticatedProvider.prototype.entityMutate;
if(original&&!original.__gcmbs_v142){
  const patched=async function(entity,record_key,operation,data,client_change_id=''){
    if(String(entity||'').toLowerCase()==='manutencao_viaturas'){
      const out=await maintenanceMutate(record_key,String(operation||'UPSERT').toUpperCase(),data||{},client_change_id);
      try{await this.load()}catch{}
      return out;
    }
    return original.call(this,entity,record_key,operation,data,client_change_id);
  };
  patched.__gcmbs_v142=true;
  AuthenticatedProvider.prototype.entityMutate=patched;
}
console.info('[GCMBS] V142 — manutenção online cloud-first ativa');
