/* R11 — apresentação: histórico do Forms primeiro, legado recolhível.
 * Nenhum evento de gravação ou sincronização é executado aqui. */
(function(){
  'use strict';
  function init(){
    const btn=document.getElementById('gcmbs-legado-toggle-r11');
    const view=document.querySelector('section[data-view="permutas"]');
    if(!btn||!view)return;
    btn.addEventListener('click',()=>{
      const opened=view.classList.toggle('gcmbs-legado-aberto-r11');
      btn.setAttribute('aria-expanded',String(opened));
      btn.textContent=opened?'Ocultar histórico anterior do GCMBS':'Exibir histórico anterior do GCMBS';
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();