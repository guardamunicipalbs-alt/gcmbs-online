/* GCMBS V110/V150 - auditoria, sincronização e correções cumulativas. */
(()=>{
'use strict';
const VERSION='10.0.150';
const GATEWAY='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';
const $=id=>document.getElementById(id);

function loadCorrections(){
  const mods=[
    './gcmbs-permuta-admin-fixes-v141.js?v=100150',
    './gcmbs-v147-final-reconciliation.js?v=100150',
    './gcmbs-permuta-flow-v148.js?v=100150',
    './gcmbs-bank-filter-v136.js?v=100150',
    './gcmbs-permuta-cancel-v150.js?v=100150'
  ];
  for(const src of mods)import(src).catch(e=>console.warn('[GCMBS V150] Falha ao carregar',src,e?.message||e));
}

function stampVersion(){
  const v=$('onlineVersao');
  if(v&&v.textContent!==`Online/App ${VERSION} · V150`)v.textContent=`Online/App ${VERSION} · V150`;
  const state=$('gc103SyncState');
  if(state&&/Online/.test(String(state.textContent||''))&&!String(state.textContent||'').includes(VERSION))state.textContent=`Online · ${VERSION} · V150`;
  document.documentElement.dataset.gcmbsVersion=VERSION;
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
  const clean=btn.cloneNode(true);btn.replaceWith(clean);btn=clean;
  btn.dataset.gcmbsV110Bound='1';btn.dataset.r18Bound='1';
  btn.addEventListener('click',async ev=>{
    ev.preventDefault();ev.stopImmediatePropagation();
    const old=btn.textContent;btn.disabled=true;btn.textContent='Solicitando...';
    try{
      const r=await requestSync();btn.textContent='Atualizando dados...';dispatchRefresh();setTimeout(dispatchRefresh,5000);
      alert(r.message||'Sincronização solicitada. Os dados serão recarregados automaticamente.');
      setTimeout(()=>{btn.textContent=old;btn.disabled=false;},6000);
    }catch(e){alert('Não foi possível solicitar a sincronização: '+(e?.message||e));btn.textContent=old;btn.disabled=false;}
  },true);
}
function removeDuplicateDashboard(){const view=document.querySelector('[data-view="inicio"]');if(!view)return;view.querySelectorAll('.gc102-analytics').forEach(el=>el.remove());}
function init(){loadCorrections();stampVersion();ensureSync();removeDuplicateDashboard();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
[100,350,700,1200,1800,3000].forEach(ms=>setTimeout(init,ms));
let dedupeTimer=0;new MutationObserver(()=>{clearTimeout(dedupeTimer);dedupeTimer=setTimeout(removeDuplicateDashboard,40);}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',e=>{if(e.target.closest?.('#mainNav [data-module],#menuToggle'))setTimeout(init,80)},true);
window.addEventListener('pageshow',()=>setTimeout(init,0));
console.info('[GCMBS] V150 auditoria, Banco canônico e Permutas ativas');
})();
