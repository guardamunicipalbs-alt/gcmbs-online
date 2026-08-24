import './v62-permuta-loop-guard.js?v=100066';
import './v62-extra-multi.js?v=100066';
import './central-pendencias-fix.js';
import './relatorios-route-fix.js';
import './audit-pending-fixes.js?v=100066';
import './v62-folha-ui.js?v=100066';
import './v62-folha-legenda.js?v=100066';

// Politica de seguranca do login GCMBS.
// Quando "Lembrar meu acesso" estiver desmarcado, nenhum dado de login
// deve permanecer visivel/persistido depois de sair ou fechar a pagina.
const GCMBS_LOGIN_REMEMBER='gcmbs.login.remember';
const GCMBS_LOGIN_USER='gcmbs.login.usuario';
const GCMBS_LOGIN_TOKEN='gcmbs.mobile.token';

const byId=id=>document.getElementById(id);
const rememberEnabled=()=>localStorage.getItem(GCMBS_LOGIN_REMEMBER)==='1';
let interacted=false;

function clearUnrememberedStorage(){
  if(rememberEnabled())return;
  localStorage.removeItem(GCMBS_LOGIN_USER);
  localStorage.removeItem(GCMBS_LOGIN_TOKEN);
  try{sessionStorage.removeItem(GCMBS_LOGIN_TOKEN);}catch{}
}

function configureBrowserAutocomplete(){
  const form=byId('loginForm'),user=byId('loginUsuario'),pass=byId('loginSenha');
  if(!form||!user||!pass)return;
  const remember=rememberEnabled();
  form.setAttribute('autocomplete',remember?'on':'off');
  user.setAttribute('autocomplete',remember?'username':'off');
  pass.setAttribute('autocomplete',remember?'current-password':'new-password');
  if(!remember){
    // Ajuda a impedir preenchimento por gerenciadores de senha de terceiros.
    user.setAttribute('data-lpignore','true');
    pass.setAttribute('data-lpignore','true');
    user.setAttribute('data-1p-ignore','true');
    pass.setAttribute('data-1p-ignore','true');
  }else{
    user.removeAttribute('data-lpignore');pass.removeAttribute('data-lpignore');
    user.removeAttribute('data-1p-ignore');pass.removeAttribute('data-1p-ignore');
  }
}

function clearVisibleCredentials(force=false){
  if(rememberEnabled())return;
  const tela=byId('loginTela'),user=byId('loginUsuario'),pass=byId('loginSenha');
  if(!user||!pass||tela?.classList.contains('hidden'))return;
  if(!force&&interacted)return;
  user.value='';
  pass.value='';
}

function schedulePostAutofillClear(){
  // Chrome/gerenciadores podem preencher alguns ms depois do carregamento.
  for(const ms of [0,60,250,700,1400])setTimeout(()=>clearVisibleCredentials(false),ms);
}

function onLoginShown(){
  interacted=false;
  clearUnrememberedStorage();
  configureBrowserAutocomplete();
  clearVisibleCredentials(true);
  schedulePostAutofillClear();
}

function setupLoginSecurity(){
  const tela=byId('loginTela'),user=byId('loginUsuario'),pass=byId('loginSenha'),remember=byId('loginLembrar');
  if(!tela||!user||!pass||!remember)return;

  user.addEventListener('input',e=>{if(e.isTrusted)interacted=true;});
  pass.addEventListener('input',e=>{if(e.isTrusted)interacted=true;});

  remember.addEventListener('change',()=>{
    localStorage.setItem(GCMBS_LOGIN_REMEMBER,remember.checked?'1':'0');
    if(!remember.checked)clearUnrememberedStorage();
    configureBrowserAutocomplete();
  });

  new MutationObserver(()=>{
    if(!tela.classList.contains('hidden'))onLoginShown();
  }).observe(tela,{attributes:true,attributeFilter:['class']});

  window.addEventListener('pageshow',()=>{
    if(!rememberEnabled())onLoginShown();
  });

  window.addEventListener('pagehide',()=>{
    if(!rememberEnabled())clearUnrememberedStorage();
  });

  configureBrowserAutocomplete();
  if(!rememberEnabled())onLoginShown();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupLoginSecurity,{once:true});
else setupLoginSecurity();