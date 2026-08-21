// GCMBS 10.0.62 — corrige a duplicidade visual do botão de sincronização.
// O index.html mantém um botão estático sem a rotina v62; o v62-sync-ui.js cria o botão funcional.
// Removemos somente o botão estático para preservar uma única ação real de sincronização.
function removerBotaoSyncEstatico(){
  const antigo=document.getElementById('syncAgoraOnline');
  if(antigo) antigo.remove();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',removerBotaoSyncEstatico,{once:true});
}else{
  removerBotaoSyncEstatico();
}
