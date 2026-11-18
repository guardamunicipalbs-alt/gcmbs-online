/* GCMBS Online R9-R3: somente apresentacao de Permutas.
   Oculta painel legado de autorização de extras, transferida ao fluxo Google Forms.
   Não modifica registros, listeners, cache ou chamadas de rede. */
(function(){
  'use strict';
  const alvo='Permutas de extras aguardando sua autorização';
  function aplicar(){
    const view=document.querySelector('section[data-view="permutas"]');
    if(!view)return;
    for(const h of view.querySelectorAll('h2,h3')){
      if((h.textContent||'').trim()!==alvo)continue;
      const card=h.closest('.card');
      if(card)card.style.setProperty('display','none','important');
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',aplicar,{once:true});
  else aplicar();
  const observer=new MutationObserver(aplicar);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();
