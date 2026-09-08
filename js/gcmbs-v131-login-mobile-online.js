/* GCMBS V131 — Login responsivo para Online + App Android.
   Adapta a tela aprovada no Desktop sem alterar autenticação, sessão ou API. */
(()=>{
'use strict';
if(window.__GCMBS_V131_LOGIN_MOBILE_ONLINE__)return;
window.__GCMBS_V131_LOGIN_MOBILE_ONLINE__=true;

const $=(s,r=document)=>r.querySelector(s);
const svg=(name)=>{
  const icons={
    user:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0"/></svg>',
    lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    eye:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
    eyeOff:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.2A10.4 10.4 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-3 3.7M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6c1.3 0 2.5-.3 3.6-.7M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    enter:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2M3 12h11M10 8l4 4-4 4"/></svg>',
    key:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="7.5" cy="16.5" r="3.5"/><path d="m10 14 9-9M16 5h3v3M14 7l3 3"/></svg>',
    headset:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v7H5a1 1 0 0 1-1-1v-6Zm16 0h-3v7h2a1 1 0 0 0 1-1v-6Z"/></svg>',
    team:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2.5 19a5.5 5.5 0 0 1 11 0M13 19a4.5 4.5 0 0 1 9 0"/></svg>',
    phone:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 5h4M11 19h2"/></svg>'
  };
  return icons[name]||'';
};

function setLabel(label,input,caption,kind){
  if(!label||!input)return;
  label.classList.add('gc131-field',`gc131-${kind}-field`);
  [...label.childNodes].forEach(node=>{
    if(node.nodeType===Node.TEXT_NODE)node.textContent='';
  });
  if(!label.querySelector('.gc131-field-icon')){
    const i=document.createElement('span');
    i.className='gc131-field-icon';
    i.innerHTML=svg(kind==='user'?'user':'lock');
    label.insertBefore(i,input);
  }
  if(!label.querySelector('.gc131-field-caption')){
    const c=document.createElement('span');
    c.className='gc131-field-caption';
    c.textContent=caption;
    label.insertBefore(c,input);
  }
}

function addPasswordEye(label,input){
  if(!label||!input||label.querySelector('.gc131-eye'))return;
  const b=document.createElement('button');
  b.type='button';
  b.className='gc131-eye';
  b.setAttribute('aria-label','Mostrar senha');
  b.innerHTML=svg('eye');
  b.addEventListener('click',()=>{
    const show=input.type==='password';
    input.type=show?'text':'password';
    b.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');
    b.innerHTML=svg(show?'eyeOff':'eye');
    input.focus({preventScroll:true});
  });
  label.appendChild(b);
}

function configureCheck(card){
  const check=$('#loginLembrar',card);
  const label=check?.closest('label');
  if(!check||!label)return;
  label.classList.add('gc131-remember');
  [...label.childNodes].forEach(node=>{
    if(node.nodeType===Node.TEXT_NODE)node.textContent='';
  });
  if(!label.querySelector('.gc131-remember-text')){
    const s=document.createElement('span');
    s.className='gc131-remember-text';
    s.textContent='Memorizar usuário e senha neste computador';
    label.appendChild(s);
  }
}

function configureButtons(card){
  const enter=$('#entrar',card);
  if(enter&&!enter.dataset.gc131){
    enter.dataset.gc131='1';
    enter.classList.add('gc131-enter');
    enter.innerHTML=`<span class="gc131-button-icon">${svg('enter')}</span><span>Entrar</span>`;
  }

  let recovery=$('.gc131-recovery',card);
  if(!recovery&&enter){
    recovery=document.createElement('button');
    recovery.type='button';
    recovery.className='gc131-recovery';
    recovery.innerHTML=`<span class="gc131-button-icon">${svg('key')}</span><span>Recuperar senha</span>`;
    recovery.addEventListener('click',()=>{
      const msg=$('#loginErro',card);
      if(msg){
        msg.classList.add('gc131-info');
        msg.textContent='A redefinição de senha é feita pelo Comando. Informe seu usuário/CPF ao responsável; no próximo acesso o sistema solicitará a criação de uma nova senha.';
      }
      $('#loginUsuario',card)?.focus();
    });
    enter.insertAdjacentElement('afterend',recovery);
  }
}

function configureHelp(card){
  const originalSmall=$(':scope > small.muted',card);
  if(originalSmall)originalSmall.classList.add('gc131-original-note');
  const installWrap=card.querySelector(':scope > div[style*="text-align:center"]');
  if(installWrap)installWrap.classList.add('gc131-install-wrap');
  const installLink=installWrap?.querySelector('a');
  if(installLink){
    installLink.classList.add('gc131-install-link');
    installLink.innerHTML=`<span class="gc131-button-icon">${svg('phone')}</span><span>Baixar aplicativo Android</span>`;
  }

  if(card.querySelector('.gc131-help'))return;
  const help=document.createElement('div');
  help.className='gc131-help';
  help.innerHTML=`
    <div class="gc131-help-item">
      <span class="gc131-help-icon">${svg('headset')}</span>
      <span><b>Precisa de ajuda?</b><small>Entre em contato com o suporte da TI.</small></span>
    </div>
    <div class="gc131-help-divider" aria-hidden="true"></div>
    <div class="gc131-help-item">
      <span class="gc131-help-icon">${svg('team')}</span>
      <span><b>Uso institucional</b><small>Juntos por uma Brejo Santo mais segura.</small></span>
    </div>`;
  card.appendChild(help);
}

function createShell(screen,card){
  let shell=$('.gc131-login-shell',screen);
  if(shell)return shell;

  shell=document.createElement('div');
  shell.className='gc131-login-shell';

  const visual=document.createElement('section');
  visual.className='gc131-login-visual';
  visual.setAttribute('aria-label','Identidade institucional GCMBS');
  visual.innerHTML=`
    <div class="gc131-visual-shade"></div>
    <div class="gc131-city-mark"><b>BREJO SANTO - CE</b><span>NOSSA GENTE,<br>NOSSA FORÇA</span><i></i></div>
    <div class="gc131-brand-lockup">
      <img src="brasao-gcmbs.png" alt="Brasão da Guarda Civil Municipal de Brejo Santo">
      <strong>GCMBS</strong>
      <span>Sistema de Gestão da<br>Guarda Civil Municipal</span>
      <i></i>
      <em>Disciplina · Serviço · Proteção</em>
    </div>
    <div class="gc131-quote">“Uma cidade mais segura<br>se constrói com pessoas<br>que servem.”<i></i><small>GUARDA CIVIL MUNICIPAL<br>DE BREJO SANTO</small></div>`;

  const access=document.createElement('section');
  access.className='gc131-login-access';
  access.innerHTML='<div class="gc131-access-watermark" aria-hidden="true">GCMBS</div>';

  screen.insertBefore(shell,card);
  shell.appendChild(visual);
  shell.appendChild(access);
  access.appendChild(card);

  const footer=document.createElement('footer');
  footer.className='gc131-login-footer';
  footer.innerHTML=`
    <div class="gc131-footer-brand"><img src="icon.png" alt=""><span><b>GCMBS | Guarda Civil Municipal de Brejo Santo - CE</b><small>Sistema de Gestão da Guarda Civil Municipal</small></span></div>
    <div class="gc131-footer-meta"><span>● Sistema Online</span><span>▣ App Android</span><span>Disciplina · Serviço · Proteção</span></div>`;
  screen.appendChild(footer);
  return shell;
}

function adapt(){
  const screen=$('#loginTela');
  const card=screen?.querySelector('.login-card');
  if(!screen||!card)return;

  screen.classList.add('gc131-login');
  card.classList.add('gc131-login-card');
  createShell(screen,card);

  const icon=$('#loginIcone',card);if(icon)icon.classList.add('gc131-hidden-icon');
  const h1=card.querySelector(':scope > h1');
  if(h1){h1.textContent='BEM VINDO(A)';h1.classList.add('gc131-welcome-title');}
  const p=card.querySelector(':scope > p.muted');
  if(p){p.textContent='ACESSE O GCMBS';p.classList.add('gc131-welcome-subtitle');}

  const user=$('#loginUsuario',card),pass=$('#loginSenha',card);
  setLabel(user?.closest('label'),user,'CPF / Usuário','user');
  setLabel(pass?.closest('label'),pass,'Senha','pass');
  addPasswordEye(pass?.closest('label'),pass);
  configureCheck(card);
  configureButtons(card);
  configureHelp(card);

  document.body.classList.toggle('gc131-login-active',!screen.classList.contains('hidden'));
  document.documentElement.classList.toggle('gc131-login-active',!screen.classList.contains('hidden'));
}

function syncVisibility(){
  const screen=$('#loginTela');
  const active=!!screen&&!screen.classList.contains('hidden');
  document.body.classList.toggle('gc131-login-active',active);
  document.documentElement.classList.toggle('gc131-login-active',active);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{adapt();syncVisibility();},{once:true});
else{adapt();syncVisibility();}
[80,180,400,900,1800].forEach(ms=>setTimeout(()=>{adapt();syncVisibility();},ms));

const observer=new MutationObserver(()=>{
  adapt();syncVisibility();
});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});

console.info('[GCMBS] V131 Login responsivo Online/App ativo');
})();
