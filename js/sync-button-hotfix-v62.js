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

// GCMBS Online — Premium Preview v77.
// Deliberadamente restrito ao GitHub Pages: não ativa no APK/Capacitor nem no Desktop.
(function carregarPreviewPremiumOnline(){
  if(location.hostname!=='guardamunicipalbs-alt.github.io') return;
  if(document.querySelector('link[data-gc77-preview]')) return;

  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='css/gcmbs-online-premium-v77.css?v=20260906-1';
  css.dataset.gc77Preview='1';
  document.head.appendChild(css);

  const js=document.createElement('script');
  js.src='js/gcmbs-online-premium-v77.js?v=20260906-1';
  js.defer=true;
  js.dataset.gc77Preview='1';
  document.head.appendChild(js);
})();
