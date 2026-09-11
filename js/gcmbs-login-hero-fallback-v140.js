/* GCMBS V140 — valida a arte principal do login e ativa fallback V131 se necessario. */
(()=>{'use strict';if(window.__GCMBS_V140_LOGIN_FALLBACK__)return;window.__GCMBS_V140_LOGIN_FALLBACK__=true;
function setFallback(on){document.getElementById('loginTela')?.classList.toggle('gc140-hero-fallback',!!on)}
function check(){const img=new Image();img.onload=()=>setFallback(!(img.naturalWidth>100&&img.naturalHeight>100));img.onerror=()=>setFallback(true);img.src=`assets/gcmbs-login-hero-v133.webp?v=100140&t=${Date.now()}`}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
})();
