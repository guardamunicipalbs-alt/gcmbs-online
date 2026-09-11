/* GCMBS V110/V153 - auditoria, sincronização e correções cumulativas. */
(()=>{
'use strict';
const VERSION='10.0.153';
const GATEWAY='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';
const $=id=>document.getElementById(id);
function loadCorrections(){const mods=['./gcmbs-permuta-admin-fixes-v141.js?v=100153','./gcmbs-v147-final-reconciliation.js?v=100153','./gcmbs-permuta-flow-v148.js?v=100153','./gcmbs-bank-filter-v136.js?v=100153','./gcmbs-permuta-cancel-v150.js?v=100153'];for(const src of mods)import(src).catch(e=>console.warn('[GCMBS V153] Falha ao carregar',src,e?.message||e));}
function stampVersion(){const v=$('onlineVersao');if(v)v.textContent=`Online/App ${VERSION} · V153`;document.documentElement.dataset.gcmbsVersion=VERSION;}
async function requestSync(){const token=localStorage.getItem('gcmbs.mobile.token');if(!token)throw new Error('Faça login antes de sincronizar.');const r=await fetch(GATEWAY,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action:'request_sync'}),cache:'no-store'});let b={};try{b=await r.json()}catch{}if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);return b;}
function dispatchRefresh(){window.dispatchEvent(new Event('gcmbs:v110-refresh'));}
function ensureSync(){const legacy=$('onlineSyncNow');if(legacy)legacy.remove();let btn=$('syncAgoraOnline');if(!btn||btn.dataset.gcmbsV110Bound==='1')return;const clean=btn.cloneNode(true);btn.replaceWith(clean);btn=clean;btn.dataset.gcmbsV110Bound='1';btn.addEventListener('click',async ev=>{ev.preventDefault();ev.stopImmediatePropagation();const old=btn.textContent;btn.disabled=true;btn.textContent='Solicitando...';try{const r=await requestSync();dispatchRefresh();alert(r.message||'Sincronização solicitada.');}catch(e){alert('Não foi possível solicitar a sincronização: '+(e?.message||e));}finally{btn.textContent=old;btn.disabled=false;}},true);}
function removeDuplicateDashboard(){document.querySelectorAll('[data-view="inicio"] .gc102-analytics').forEach(el=>el.remove());}
function init(){loadCorrections();stampVersion();ensureSync();removeDuplicateDashboard();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
[100,350,700,1200,1800,3000].forEach(ms=>setTimeout(init,ms));
let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(removeDuplicateDashboard,40);}).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('pageshow',()=>setTimeout(init,0));
console.info('[GCMBS] V153 correção de aprovação de permutas ativa');
})();