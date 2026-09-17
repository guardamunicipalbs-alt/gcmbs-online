/* GCMBS Online V172: navegação confiável para o painel independente de aprovações.
 * Ajuste restrito ao atalho visual; não executa decisões ou grava dados.
 */
(()=>{
  'use strict';
  if(window.__GCMBS_BANK_ENTRY_V172__ || window.Capacitor?.isNativePlatform?.() || /^(file|capacitor):/i.test(location.protocol))return;
  window.__GCMBS_BANK_ENTRY_V172__=true;
  const destination=new URL('banco-aprovacoes-v166.html',document.baseURI).href;
  const selector='#gc166-safe-entry a[href$="banco-aprovacoes-v166.html"]';
  const buttonId='gc172AbrirAprovacoes';
  let scheduled=false;

  function fixEntry(){
    const link=document.querySelector(selector);
    if(!link)return;
    const button=document.createElement('button');
    button.type='button';
    button.id=buttonId;
    button.textContent=link.textContent||'Abrir aprovação, correção e recusa';
    button.className=link.className;
    button.style.cssText=link.style.cssText;
    button.style.border='0';
    button.style.cursor='pointer';
    button.style.fontFamily='inherit';
    button.setAttribute('aria-label','Abrir painel de aprovações do Banco de Horas');
    link.replaceWith(button);
  }

  // Captura no início do evento: evita que controladores de navegação da tela
  // principal interceptem o atalho antes da mudança para a página isolada.
  window.addEventListener('click',event=>{
    const target=event.target;
    const button=target instanceof Element?target.closest('#'+buttonId):null;
    if(!button)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.assign(destination);
  },true);

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;fixEntry();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fixEntry,{once:true});
  else fixEntry();
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  console.info('[GCMBS] V172 atalho de aprovações independente ativo');
})();
