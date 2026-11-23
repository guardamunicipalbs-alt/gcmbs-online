/* GCMBS V365 - evidencias de contato Desktop no Online; consulta autenticada 30min. */
(()=>{
'use strict';
if(window.__GCMBS_STATUS_DESKTOP_V365__)return;
window.__GCMBS_STATUS_DESKTOP_V365__=true;
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-sync-status-v156';
const WINDOW=1800000;
let latestAt=0,loading=false,sessionKey='';
function holder(){
 const head=document.querySelector('.brand-head');
 if(!head)return null;
 let div=document.getElementById('gc365-status');
 if(!div){div=document.createElement('small');div.id='gc365-status';div.style.cssText='display:block;margin-top:4px;font-size:11px;line-height:1.3;max-width:380px;color:inherit';div.textContent='Desktop: verificacao ainda nao realizada';head.appendChild(div);}
 return div;
}
function formatDate(v){
 if(!v)return '';
 const t=new Date(v);if(!Number.isFinite(t.getTime()))return '';
 return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'}).format(t);
}
async function read(force=false){
 const el=holder(),token=localStorage.getItem('gcmbs.mobile.token')||'';
 if(!el||!token){if(el)el.textContent='Desktop: entre para consultar o estado';return;}
 if(sessionKey!==token){latestAt=0;sessionKey=token;}
 if(loading||(!force&&Date.now()-latestAt<WINDOW))return;
 loading=true;latestAt=Date.now();
 try{
  const response=await fetch(API,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'sync_status'}),cache:'no-store'});
  if(!response.ok)throw Error('Consulta indisponivel ('+response.status+')');
  const body=await response.json();
  if(body?.success!==true||!body?.sincronizacao)throw Error('Resposta incompleta');
  const s=body.sincronizacao,at=formatDate(s.ultimo_contato_desktop||s.ultima_sincronizacao);
  const verified=s.checkpoint_verificado===true;
  el.textContent='Ultimo sinal Desktop: '+(at||'nao confirmado')+' | Sincronizacao '+(verified?'com checkpoint verificado':'sem checkpoint verificado');
 }catch(error){el.textContent='Estado da sincronizacao indisponivel (sem alterar os dados)';}
 finally{loading=false;}
}
function boot(){
 holder();setTimeout(()=>read(),1000);
 setInterval(()=>read(),WINDOW);
 document.addEventListener('click',e=>{if(e.target?.closest?.('#entrar,#sair')){sessionKey='';latestAt=0;setTimeout(()=>read(),1600);}},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();