/* GCMBS R10 - histórico Forms incorporado a Permutas.
   A abertura do menu somente consulta endpoint autenticado (não sincroniza o Google Sheets).
   O iframe compartilha a origem e sessão existentes, sem tokens na URL. */
(function(){
  'use strict';
  const viewSelector='section[data-view="permutas"]';
  const frameId='gcmbs-forms-inline-frame';
  let carregado=false, tokenCarregado='';
  function limpar(){const frame=document.getElementById(frameId);if(!frame)return;carregado=false;tokenCarregado='';frame.style.display='none';frame.removeAttribute('src');const status=document.getElementById('gcmbs-forms-inline-status');if(status){status.style.display='';status.textContent='Abra Permutas para consultar seu histórico.';}}
  function ativar(){
    const sec=document.querySelector(viewSelector);
    const frame=document.getElementById(frameId);
    const status=document.getElementById('gcmbs-forms-inline-status');
    if(!sec||!frame)return;
    const token=localStorage.getItem('gcmbs.mobile.token')||'';
    if(carregado&&token!==tokenCarregado)limpar();
    if(!token||document.getElementById('appTela')?.classList.contains('hidden')){if(carregado)limpar();return;}
    if(sec.classList.contains('hidden')||carregado)return;
    tokenCarregado=token;
    carregado=true;
    frame.style.display='block';
    const src=frame.getAttribute('data-src');
    if(src)frame.setAttribute('src',src);
    if(status)status.textContent='Consultando histórico autenticado no Supabase…';
  }
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin)return;
    const frame=document.getElementById(frameId);
    if(!frame||e.source!==frame.contentWindow||!e.data||e.data.type!=='gcmbs-forms-r10-height')return;
    const height=Number(e.data.height);
    if(Number.isFinite(height)&&height>=400&&height<=6000)frame.style.height=Math.ceil(height)+'px';
  });
  function boot(){
    const frame=document.getElementById(frameId);
    if(frame)frame.addEventListener('load',()=>{
      const status=document.getElementById('gcmbs-forms-inline-status');
      if(status&&carregado&&tokenCarregado===localStorage.getItem('gcmbs.mobile.token'))status.style.display='none';
    });
    const view=document.querySelector(viewSelector);
    if(view)new MutationObserver(ativar).observe(view,{attributes:true,attributeFilter:['class','style']});
    const app=document.getElementById('appTela');if(app)new MutationObserver(ativar).observe(app,{attributes:true,attributeFilter:['class','style']});
    window.addEventListener('storage',e=>{if(e.key==='gcmbs.mobile.token'||e.key===null){limpar();ativar();}});
    window.addEventListener('pageshow',ativar);
    ativar();
    document.addEventListener('click',()=>queueMicrotask(ativar),true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();