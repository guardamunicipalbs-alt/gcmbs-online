/* GCMBS V141 — correções defensivas da gestão de permutas Online/App.
   A regra de negócio continua no gateway: este hotfix corrige apresentação e
   garante que exclusão/recusa de solicitação vencida permaneçam acionáveis. */
(()=>{'use strict';
if(window.__GCMBS_V141_PERMUTA_ADMIN__)return;window.__GCMBS_V141_PERMUTA_ADMIN__=true;
function style(){if(document.getElementById('gcmbsV141PermutaStyle'))return;const s=document.createElement('style');s.id='gcmbsV141PermutaStyle';s.textContent=`
#listaPermutasGestao .request-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;width:100%}
#listaPermutasGestao .request-actions .mini{width:100%!important;min-width:0!important;white-space:nowrap!important;word-break:normal!important;overflow-wrap:normal!important;padding-left:10px!important;padding-right:10px!important}
#listaPermutasGestao .request-actions .danger-soft{grid-column:auto}
@media(max-width:520px){#listaPermutasGestao .request-actions{grid-template-columns:repeat(2,minmax(0,1fr))}#listaPermutasGestao .request-actions .danger-soft{grid-column:1/-1}}
`;document.head.appendChild(s)}
function fixButtons(){document.querySelectorAll('#listaPermutasGestao [data-cmd-pm-del],#listaPermutasGestao [data-cmd-pm-no]').forEach(b=>{b.disabled=false;b.removeAttribute('aria-disabled');b.style.pointerEvents='auto'});}
function boot(){style();fixButtons();let q=false;new MutationObserver(()=>{if(q)return;q=true;requestAnimationFrame(()=>{q=false;fixButtons()})}).observe(document.documentElement,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
