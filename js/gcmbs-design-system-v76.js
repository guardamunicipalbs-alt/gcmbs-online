/*
 * GCMBS — Bootstrap visual institucional.
 * Premium 3D v80 = v78 aprovado + correções v79 + paridade App/Desktop.
 * A carga HF83 mantém a rota protegida de Justificativa de Faltas.
 */
(()=>{
  'use strict';
  const root=document.documentElement;
  root.classList.add('gcmbs-ds','gc78-premium','gc79-refined','gc80-platform');
  root.classList.remove('gc77-preview');
  root.dataset.gc77Premium='1';

  document.querySelectorAll('link[href*="gcmbs-online-premium-v77"],script[src*="gcmbs-online-premium-v77"]').forEach(el=>el.remove());

  const loadStyle=(href,key)=>{
    if(document.querySelector(`link[data-${key}]`))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.setAttribute(`data-${key}`,'1');document.head.appendChild(link);
  };
  const loadScript=(src,key)=>{
    if(document.querySelector(`script[data-${key}]`))return;
    const script=document.createElement('script');script.src=src;script.defer=true;script.setAttribute(`data-${key}`,'1');document.head.appendChild(script);
  };

  loadStyle('css/gcmbs-premium-3d-v78.css?v=100080','gc78-premium');
  loadStyle('css/gcmbs-premium-3d-v79-fix.css?v=100080','gc79-refined');
  loadStyle('css/gcmbs-premium-3d-v79-r2.css?v=100080','gc79-r2');
  loadStyle('css/gcmbs-platform-parity-v80.css?v=100080','gc80-platform');

  loadScript('js/gcmbs-premium-3d-v78.js?v=100080','gc78-premium');
  loadScript('js/gcmbs-premium-3d-v79-fix.js?v=100080','gc79-refined');
  loadScript('js/gcmbs-premium-3d-v79-r2.js?v=100080','gc79-r2');
  loadScript('js/gcmbs-platform-parity-v80.js?v=100080','gc80-platform');
  loadScript('js/hf83-justificativas-protected-route.js?v=100083','gc83-justificativas');
})();
