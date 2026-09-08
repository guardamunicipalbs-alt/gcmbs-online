/* GCMBS V132 — arte aprovada do Login, sem alterar autenticação nem Desktop. */
(()=>{
'use strict';
if(window.__GCMBS_V132_LOGIN_HERO__)return;
window.__GCMBS_V132_LOGIN_HERO__=true;

const chunks=window.__GCMBS_V132_HERO||[];
const b64=chunks.join('');
if(!b64){console.warn('[GCMBS V132] arte do login não carregada');return;}
const HERO=`data:image/avif;base64,${b64}`;

function apply(){
  let style=document.getElementById('gcmbsV132LoginHeroStyle');
  if(!style){
    style=document.createElement('style');
    style.id='gcmbsV132LoginHeroStyle';
    style.textContent=`
#loginTela.gc131-login .gc131-brand-lockup,
#loginTela.gc131-login .gc131-city-mark,
#loginTela.gc131-login .gc131-quote,
#loginTela.gc131-login .gc131-visual-shade{display:none!important}
#loginTela.gc131-login .gc131-login-visual::after{display:none!important;content:none!important}
#loginTela.gc131-login .gc131-login-visual{
  background:#062a57 url("${HERO}") center center/cover no-repeat!important;
  box-shadow:18px 0 48px rgba(1,21,44,.12)!important;
}
@media(max-width:899px){
  #loginTela.gc131-login .gc131-login-visual{
    height:clamp(310px,43vh,390px)!important;
    min-height:310px!important;
    background-position:center center!important;
    box-shadow:none!important;
  }
  #loginTela.gc131-login .gc131-login-access{margin-top:-34px!important;padding-top:0!important}
}
@media(max-width:520px){
  #loginTela.gc131-login .gc131-login-visual{
    height:clamp(300px,41vh,350px)!important;
    min-height:300px!important;
  }
  #loginTela.gc131-login .gc131-login-access{margin-top:-36px!important}
}`;
    document.head.appendChild(style);
  }
  document.documentElement.classList.add('gc132-login-hero');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();
[80,220,500,1000,1800].forEach(ms=>setTimeout(apply,ms));

console.info('[GCMBS] V132 arte aprovada do Login Online/App ativa');
})();