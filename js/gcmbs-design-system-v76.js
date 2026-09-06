/*
 * GCMBS — Bootstrap visual institucional.
 * Premium 3D v80 = v78 aprovado + correções v79 + paridade App/Desktop.
 * Login Institucional v81 = nova tela de acesso Desktop/Online/App sem alterar autenticação.
 * HF83 mantém a rota protegida de Justificativa de Faltas.
 * HF84 corrige mojibake e fallback do brasão institucional.
 * V102 consolida no Online/App o resultado aprovado das V84 e V90-V101 do Desktop.
 * V103 reorganiza todas as telas Online/App no mesmo padrão visual e hierarquia do Desktop.
 */
(()=>{
  'use strict';
  const root=document.documentElement;
  root.classList.add('gcmbs-ds','gc78-premium','gc79-refined','gc80-platform','gc81-login','gc102-cumulative','gc103-desktop-parity');
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
  loadStyle('css/gcmbs-login-institucional-v81.css?v=100081','gc81-login');
  loadStyle('css/gcmbs-cumulative-v102.css?v=100102','gc102-cumulative');
  loadStyle('css/gcmbs-desktop-parity-v103.css?v=100103','gc103-desktop-parity');

  loadScript('js/gcmbs-premium-3d-v78.js?v=100080','gc78-premium');
  loadScript('js/gcmbs-premium-3d-v79-fix.js?v=100080','gc79-refined');
  loadScript('js/gcmbs-premium-3d-v79-r2.js?v=100080','gc79-r2');
  loadScript('js/gcmbs-platform-parity-v80.js?v=100080','gc80-platform');
  loadScript('js/gcmbs-login-institucional-v81.js?v=100081','gc81-login');
  loadScript('js/hf83-justificativas-protected-route.js?v=100083','gc83-justificativas');
  loadScript('js/hf84-utf8-branding-fix.js?v=100084','gc84-utf8-branding');
  loadScript('js/gcmbs-cumulative-v102.js?v=100102','gc102-cumulative');
  loadScript('js/gcmbs-desktop-parity-v103.js?v=100110','gc103-desktop-parity');
})();
