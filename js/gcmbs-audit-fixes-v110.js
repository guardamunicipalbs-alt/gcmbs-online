/* GCMBS V110 - auditoria: sincronizacao e botoes consolidados. */
(()=>{
'use strict';
const VERSION='10.0.85';
const GATEWAY='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const $=id=>document.getElementById(id);

function stampVersion(){
  const v=$('onlineVersao');
  if(v&&v.textContent!==`Online/App ${VERSION} · V110`)v.textContent=`Online/App ${VERSION} · V110`;
  const state=$('gc103SyncState');
  if(state&&/Online/.test(String(state.textContent||''))&&!String(state.textContent||'').includes(VERSION))state.textContent=`Online · ${VERSION} · V110`;
}
async function requestSync(){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Faça login antes de sincronizar.');
  const r=await fetch(GATEWAY,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action:'request_sync'}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function dispatchRefresh(){window.dispatchEvent(new Event('gcmbs:v110-refresh'));}
function ensureSync(){
  const legacy=$('onlineSyncNow');if(legacy)legacy.remove();
  let btn=$('syncAgoraOnline');if(!btn)return;
  if(btn.dataset.gcmbsV110Bound==='1')return;
  // Remove listeners legados impossiveis de enumerar e deixa um unico botao canonico.
  const clean=btn.cloneNode(true);btn.replaceWith(clean);btn=clean;
  btn.dataset.gcmbsV110Bound='1';btn.dataset.r18Bound='1';
  btn.addEventListener('click',async ev=>{
    ev.preventDefault();ev.stopImmediatePropagation();
    const old=btn.textContent;btn.disabled=true;btn.textContent='Solicitando...';
    try{
      const r=await requestSync();
      btn.textContent='Atualizando dados...';
      dispatchRefresh();
      setTimeout(dispatchRefresh,5000);
      alert(r.message||'Sincronização solicitada ao Desktop. Os dados serão recarregados automaticamente.');
      setTimeout(()=>{btn.textContent=old;btn.disabled=false;},6000);
    }catch(e){
      alert('Não foi possível solicitar a sincronização: '+(e?.message||e));
      btn.textContent=old;btn.disabled=false;
    }
  },true);
}
function init(){stampVersion();ensureSync();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
[100,700,1800].forEach(ms=>setTimeout(init,ms));
document.addEventListener('click',e=>{if(e.target.closest?.('#mainNav [data-module],#menuToggle'))setTimeout(stampVersion,80)},true);
window.addEventListener('pageshow',()=>setTimeout(init,0));
console.info('[GCMBS] V110 auditoria: sincronização e botões consolidados ativos');
})();
