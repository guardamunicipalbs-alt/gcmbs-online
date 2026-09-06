/* GCMBS — Login Institucional v81. Somente apresentação; não altera autenticação. */
(()=>{
  'use strict';
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));

  function iconSource(scope=document){
    const img=q('#loginIcone, .login-icon, img[src*="brasao" i], img[src*="icon" i]',scope);
    if(!img)return 'icon.png';
    return img.currentSrc||img.getAttribute('src')||'icon.png';
  }

  function makeBrand(src,desktop=false){
    const aside=document.createElement('aside');
    aside.className=desktop?'gc-login-desktop-brand':'gc-login-brand-panel';
    aside.innerHTML=`<div class="gc-login-brand-content">
      <img class="gc-login-brand-mark" src="${src}" alt="Brasão da Guarda Civil Municipal">
      <div class="gc-login-brand-kicker">Guarda Civil Municipal</div>
      <h2 class="gc-login-brand-title">GCMBS</h2>
      <div class="gc-login-brand-subtitle">Sistema de Gestão da Guarda Civil Municipal</div>
      <div class="gc-login-brand-motto">Disciplina · Serviço · Proteção</div>
      <ul class="gc-login-brand-features">
        <li>Gestão de escalas e efetivo</li>
        <li>Controle e transparência operacional</li>
        <li>Integração Desktop, Online e App</li>
        <li>Serviço à sociedade</li>
      </ul>
      <div class="gc-login-city">Guarda Civil Municipal · Brejo Santo - CE</div>
    </div>`;
    return aside;
  }

  function decorateFields(form){
    if(!form)return;
    const user=q('#loginUsuario, input[autocomplete="username"], input[name*="usuario" i], input[name*="cpf" i], input[type="text"]',form);
    const pass=q('#loginSenha, input[autocomplete="current-password"], input[type="password"]',form);
    if(user){
      const label=user.closest('label');
      if(label){
        label.classList.add('gc-user-field');
        if(!q('.gc-login-field-caption',label)){
          const cap=document.createElement('span');cap.className='gc-login-field-caption';cap.textContent='CPF / Usuário';label.insertBefore(cap,user);
        }
      }
    }
    if(pass){
      const label=pass.closest('label');
      if(label){
        label.classList.add('gc-pass-field');
        if(!q('.gc-login-field-caption',label)){
          const cap=document.createElement('span');cap.className='gc-login-field-caption';cap.textContent='Senha';label.insertBefore(cap,pass);
        }
        if(!q('.gc-login-eye',label)){
          const eye=document.createElement('button');
          eye.type='button';eye.className='gc-login-eye';eye.setAttribute('aria-label','Mostrar senha');eye.textContent='◉';
          eye.addEventListener('click',()=>{
            const reveal=pass.type==='password';pass.type=reveal?'text':'password';
            eye.textContent=reveal?'⊘':'◉';eye.setAttribute('aria-label',reveal?'Ocultar senha':'Mostrar senha');pass.focus();
          });
          label.appendChild(eye);
        }
      }
    }
  }

  function enhanceOnline(){
    const screen=q('#loginTela');
    if(!screen||screen.dataset.gcLoginV81==='1')return false;
    const card=q('.login-card',screen),form=q('#loginForm, form',screen);
    if(!card||!form)return false;
    screen.dataset.gcLoginV81='1';screen.classList.add('gc-login-ready');
    try{
      if((window.Capacitor&&typeof window.Capacitor.isNativePlatform==='function'&&window.Capacitor.isNativePlatform())||/^capacitor:|^file:/i.test(location.protocol))screen.classList.add('gc-login-native');
    }catch(_){/* apenas visual */}

    const shell=document.createElement('div');shell.className='gc-login-shell';
    const access=document.createElement('main');access.className='gc-login-access-panel';
    const brand=makeBrand(iconSource(screen),false);
    screen.insertBefore(shell,card);
    shell.appendChild(brand);shell.appendChild(access);access.appendChild(card);

    const logo=q('.login-icon',card);if(logo)logo.setAttribute('aria-hidden','true');
    const h1=q('h1',card);if(h1)h1.textContent='Acesse o GCMBS';
    const p=q('p.muted, p',card);if(p)p.textContent='Acesso institucional seguro e integrado';
    if(!q('.gc-login-welcome',card)){
      const welcome=document.createElement('div');welcome.className='gc-login-welcome';welcome.textContent='Bem-vindo(a)';
      card.insertBefore(welcome,h1||card.firstChild);
    }
    decorateFields(form);
    const remember=q('#loginLembrar',form);if(remember){
      const label=remember.closest('label');if(label){
        label.childNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE&&n.textContent.trim())n.textContent=' Memorizar usuário e senha neste dispositivo';});
      }
    }
    if(!q('.gc-login-help',card)){
      const help=document.createElement('div');help.className='gc-login-help';help.innerHTML='<strong>Dúvidas ou acesso bloqueado?</strong>Entre em contato com o Comando.';
      const small=q(':scope > small.muted',card);card.insertBefore(help,small||null);
    }
    return true;
  }

  function enhanceDesktopLegacy(){
    if(q('#loginTela')||document.body.classList.contains('gcmbs-login-desktop'))return false;
    const candidates=qa('button, input[type="submit"], input[type="button"]');
    const enter=candidates.find(el=>String(el.textContent||el.value||'').trim().toLocaleLowerCase('pt-BR')==='entrar');
    const pass=q('input[type="password"]');
    if(!enter||!pass)return false;
    if(!/login|acesso|gcmbs/i.test(document.title+' '+document.body.innerText.slice(0,500)))return false;
    const form=enter.closest('form')||pass.closest('form');if(!form)return false;
    const card=form.closest('.login-card,.card,.panel,.login-box,.container')||form.parentElement;if(!card)return false;
    document.body.classList.add('gcmbs-login-desktop');card.classList.add('gc-login-legacy-card');
    document.body.insertBefore(makeBrand(iconSource(card),true),document.body.firstChild);
    if(!q('.gc-login-welcome',card)){
      const welcome=document.createElement('div');welcome.className='gc-login-welcome';welcome.textContent='Bem-vindo(a)';card.insertBefore(welcome,card.firstChild);
    }
    decorateFields(form);
    return true;
  }

  function run(){enhanceOnline()||enhanceDesktopLegacy();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
  setTimeout(run,250);
})();
