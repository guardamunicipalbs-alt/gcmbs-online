/* GCMBS V142 — rotas protegidas cloud-first para Manutenção e Frequência. */
(async()=>{'use strict';
  const MAINT='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-maintenance-v142';
  const FREQ='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-frequency-v142';
  const mod=await import('./data-provider.js?v=100142');
  const P=mod?.AuthenticatedProvider?.prototype;if(!P||P.__gcmbsV142Protected)return;P.__gcmbsV142Protected=true;
  const original=P.entityMutate;
  const call=async function(url,payload){const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Sessão móvel não autenticada.');let r;try{r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(payload),cache:'no-store'});}catch{throw new Error('Falha de comunicação com o servidor. Nenhuma alteração foi confirmada.');}let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);if(b.cloud_committed!==true)throw new Error('O servidor não confirmou a consolidação da alteração na nuvem.');return b;};
  P.entityMutate=async function(entity,record_key,operation,data,client_change_id=''){
    const e=String(entity||'').toLowerCase(),op=String(operation||'UPSERT').toUpperCase();
    const cid=client_change_id||`${e}-v142:${crypto.randomUUID()}`;
    if(e==='manutencao_viaturas')return call(MAINT,{record_key,operation:op,data,client_change_id:cid});
    if(e==='frequencia_registros'){
      if(op!=='UPSERT')throw new Error('Frequência usa atualização protegida; exclusão genérica não é permitida.');
      return call(FREQ,{data,client_change_id:cid});
    }
    return original.call(this,entity,record_key,operation,data,client_change_id);
  };
})().catch(e=>console.error('[GCMBS V142 protected-write]',e));
