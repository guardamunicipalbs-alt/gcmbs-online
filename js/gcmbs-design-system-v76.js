/*
 * GCMBS — Bootstrap visual institucional.
 * Premium 3D v79 = v78 aprovado + correções de paridade visual observadas em produção.
 * Camada exclusivamente visual; preserva regras, dados, permissões e cálculos.
 */
(()=>{
  'use strict';
  const root=document.documentElement;
  root.classList.add('gcmbs-ds','gc78-premium','gc79-refined');
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

  loadStyle('css/gcmbs-premium-3d-v78.css?v=100079','gc78-premium');
  loadStyle('css/gcmbs-premium-3d-v79-fix.css?v=100079','gc79-refined');
  loadScript('js/gcmbs-premium-3d-v78.js?v=100079','gc78-premium');
  loadScript('js/gcmbs-premium-3d-v79-fix.js?v=100079','gc79-refined');
})();
