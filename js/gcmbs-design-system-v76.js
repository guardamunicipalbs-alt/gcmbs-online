/*
 * GCMBS — Bootstrap visual de compatibilidade.
 * Aprovacao visual 05/09/2026: Premium 3D v78 passa a ser o tema institucional
 * compartilhado por Desktop Electron, Online e App.
 * Este bootstrap nao altera regras, dados, permissoes ou fluxos funcionais.
 */
(()=>{
  'use strict';
  const root=document.documentElement;
  root.classList.add('gcmbs-ds');
  root.classList.remove('gc77-preview');

  if(!document.querySelector('link[data-gc78-premium]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='css/gcmbs-premium-3d-v78.css?v=100078';
    link.dataset.gc78Premium='1';
    document.head.appendChild(link);
  }

  if(!document.querySelector('script[data-gc78-premium]')){
    const script=document.createElement('script');
    script.src='js/gcmbs-premium-3d-v78.js?v=100078';
    script.defer=true;
    script.dataset.gc78Premium='1';
    document.head.appendChild(script);
  }
})();
