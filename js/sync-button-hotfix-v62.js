import './dashboard-resilience-v62.js?v=100067';

// GCMBS 10.0.62 — compatibilidade para a duplicidade visual do botão de sincronização.
// A rotina principal de deduplicação e recuperação do Quadro está em dashboard-resilience-v62.js.
function removerBotaoSyncEstaticoSeDuplicado(){
  const funcional=document.getElementById('onlineSyncNow');
  const antigo=document.getElementById('syncAgoraOnline');
  if(funcional&&antigo&&funcional!==antigo) antigo.remove();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',removerBotaoSyncEstaticoSeDuplicado,{once:true});
}else{
  removerBotaoSyncEstaticoSeDuplicado();
}
