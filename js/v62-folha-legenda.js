// GCMBS 10.0.62 — ajuste conceitual da legenda da Folha.
// Não altera cálculos, marcações nem regras: apenas esclarece que X pertence à apuração mensal da competência.
const FOLHA_LEGENDA_ANTIGA='Marcações: X = trabalhou; F = falta; FJ = falta justificada. Em telas menores, deslize lateralmente.';
const FOLHA_LEGENDA_NOVA='Marcações: X = serviço contabilizado na competência; F = falta; FJ = falta justificada. Em telas menores, deslize lateralmente.';
let folhaLegendaScheduled=false;

function atualizarLegendaFolha(){
  folhaLegendaScheduled=false;
  const root=document.getElementById('gcmbsFolhaV62');
  if(!root)return;
  for(const p of root.querySelectorAll('.folha-box-head p')){
    if(String(p.textContent||'').trim()===FOLHA_LEGENDA_ANTIGA){
      p.textContent=FOLHA_LEGENDA_NOVA;
    }
  }
}

function agendarLegendaFolha(){
  if(folhaLegendaScheduled)return;
  folhaLegendaScheduled=true;
  queueMicrotask(atualizarLegendaFolha);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',agendarLegendaFolha,{once:true});
else agendarLegendaFolha();

new MutationObserver(agendarLegendaFolha).observe(document.documentElement,{subtree:true,childList:true});
