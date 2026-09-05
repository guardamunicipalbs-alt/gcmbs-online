// GCMBS 10.0.62 — compatibilidade para a duplicidade visual do botão de sincronização.
// v74: deduplicação visual autocontida; recuperação do Quadro usa o gateway canônico.
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
