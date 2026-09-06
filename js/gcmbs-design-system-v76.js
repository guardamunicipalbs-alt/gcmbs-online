/*
 * GCMBS ONLINE — Bootstrap da Interface Institucional Premium v77.
 * Este arquivo publicado no GitHub Pages afeta somente o Online.
 * O APK e o Desktop mantêm suas cópias locais 10.0.76 até aprovação visual.
 */
(()=>{
  'use strict';
  const root=document.documentElement;
  root.classList.add('gcmbs-ds');

  // A prévia premium é intencionalmente restrita ao site Online oficial.
  if(location.hostname!=='guardamunicipalbs-alt.github.io') return;
  root.classList.add('gc77-preview');

  if(!document.querySelector('link[data-gc77-premium]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='css/gcmbs-online-premium-v77.css?v=20260906-premium-3';
    link.dataset.gc77Premium='1';
    document.head.appendChild(link);
  }

  if(!document.querySelector('script[data-gc77-premium]')){
    const script=document.createElement('script');
    script.src='js/gcmbs-online-premium-v77.js?v=20260906-premium-3';
    script.defer=true;
    script.dataset.gc77Premium='1';
    document.head.appendChild(script);
  }
})();
