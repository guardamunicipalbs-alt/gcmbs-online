/* GCMBS V161 — cache inteligente de leituras pesadas.
   Objetivo: reduzir chamadas repetidas de action=data/references sem alterar regras de negócio.
   Cache somente em memória; mutações e sincronização manual invalidam imediatamente. */
(()=>{
'use strict';
if(window.__GCMBS_SMART_DATA_CACHE_V161__)return;
window.__GCMBS_SMART_DATA_CACHE_V161__=true;

const nativeFetch=window.fetch.bind(window);
const CORE=/\/functions\/v1\/gcmbs-mobile-api-v6(?:$|\?)/i;
const SUPABASE_FUNCTION=/\.supabase\.co\/functions\/v1\//i;
const TTL={data:20000,references:120000};
const cache=new Map();
const inflight=new Map();
const mutationActions=/^(?:logout|change_password|reset_password_admin|entity_mutate|request_|update_|cancel_|decide_|admin_|accept_|send_|mark_|create$|institutional_message_send|escala_admin_adjust|permuta_admin_decide_mirror)/i;

function urlOf(input){try{return typeof input==='string'?input:String(input?.url||'')}catch{return ''}}
function methodOf(init){return String(init?.method||'GET').toUpperCase()}
function bodyOf(init){
  if(typeof init?.body!=='string')return null;
  try{return JSON.parse(init.body)}catch{return null}
}
function authKey(init){
  try{
    const h=new Headers(init?.headers||{}),v=h.get('authorization')||'';
    return v.slice(-20);
  }catch{return ''}
}
function clearData(){
  for(const k of [...cache.keys()])if(k.startsWith('data|')||k.startsWith('references|'))cache.delete(k);
}
function snapshot(r,text){
  return {status:r.status,statusText:r.statusText,headers:[...r.headers.entries()],text};
}
function responseOf(s){return new Response(s.text,{status:s.status,statusText:s.statusText,headers:s.headers})}

window.fetch=async(input,init={})=>{
  const url=urlOf(input),method=methodOf(init),body=method==='POST'?bodyOf(init):null;
  const action=String(body?.action||'').toLowerCase();

  if(method==='POST'&&SUPABASE_FUNCTION.test(url)&&mutationActions.test(action)){
    clearData();
    const r=await nativeFetch(input,init);
    if(r.ok)clearData();
    return r;
  }

  if(method==='POST'&&CORE.test(url)&&Object.prototype.hasOwnProperty.call(TTL,action)){
    const key=`${action}|${authKey(init)}`;
    const now=Date.now(),hit=cache.get(key);
    if(hit&&now-hit.at<TTL[action])return responseOf(hit.snapshot);
    if(inflight.has(key))return responseOf(await inflight.get(key));

    const p=(async()=>{
      const r=await nativeFetch(input,init);
      const text=await r.clone().text();
      const snap=snapshot(r,text);
      if(r.ok)cache.set(key,{at:Date.now(),snapshot:snap});
      return snap;
    })();
    inflight.set(key,p);
    try{return responseOf(await p)}finally{inflight.delete(key)}
  }

  return nativeFetch(input,init);
};

// Botão de sincronização explícita sempre força leitura nova.
document.addEventListener('click',e=>{
  if(e.target?.closest?.('#syncAgoraOnline,#relatoriosAtualizar,#gc130BancoAtualizar'))clearData();
},true);
window.addEventListener('gcmbs:v110-refresh',clearData);
window.addEventListener('online',clearData);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){
  const last=Math.max(0,...[...cache.values()].map(x=>Number(x.at)||0));
  if(last&&Date.now()-last>TTL.data)clearData();
}});

console.info('[GCMBS] V161 cache inteligente: data 20s / references 120s');
})();
