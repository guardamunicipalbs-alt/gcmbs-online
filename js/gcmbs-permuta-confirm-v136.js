(()=>{'use strict';
function pending(btn){const card=btn.closest('[data-request-id],.record-card,.item');if(card)card.dataset.gcmbsDecisionPending='1';const old=btn.textContent;btn.dataset.gcmbsOldText=old;btn.disabled=true;btn.textContent='Processando...';setTimeout(()=>{if(document.body.contains(btn)){btn.disabled=false;btn.textContent=btn.dataset.gcmbsOldText||old}},12000)}
document.addEventListener('click',e=>{const btn=e.target.closest?.('[data-cmd-permuta-ok],[data-cmd-permuta-no],[data-permuta-approve],[data-permuta-reject]');if(btn&&!btn.disabled)pending(btn)},true);
window.addEventListener('gcmbs:v110-refresh',()=>setTimeout(()=>document.querySelectorAll('[data-gcmbs-decision-pending="1"]').forEach(x=>x.removeAttribute('data-gcmbs-decision-pending')),300));
})();