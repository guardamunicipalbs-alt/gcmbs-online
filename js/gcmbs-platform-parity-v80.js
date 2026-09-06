/* GCMBS Platform Parity v80 — somente apresentação. */
(()=>{
  'use strict';
  const root=document.documentElement;
  if(root.dataset.gc80Platform==='1')return;
  root.dataset.gc80Platform='1';
  root.classList.add('gc80-platform');

  const ua=String(navigator.userAgent||'');
  const protocol=String(location.protocol||'');
  const isElectron=/Electron/i.test(ua)||!!(window.process&&window.process.versions&&window.process.versions.electron);
  const isAndroid=/Android/i.test(ua);
  const isCapacitor=!!window.Capacitor||/^capacitor:$/i.test(protocol)||(/^file:$/i.test(protocol)&&isAndroid);
  const narrow=()=>window.matchMedia&&window.matchMedia('(max-width:899px)').matches;

  const applyPlatform=()=>{
    const mobile=isCapacitor||narrow();
    root.classList.toggle('gc80-mobile',mobile);
    root.classList.toggle('gc80-native-app',isCapacitor);
    root.classList.toggle('gc80-desktop',!mobile);
    root.classList.toggle('gc80-electron',isElectron||(!mobile&&protocol==='file:'));
  };
  applyPlatform();
  window.addEventListener('resize',applyPlatform,{passive:true});

  const $=(s,r=document)=>r.querySelector(s);

  // No App, Minha senha e Sair ficam disponíveis também no rodapé do drawer.
  function ensureMobileAccount(){
    if(!root.classList.contains('gc80-mobile'))return;
    const nav=$('nav.desktop-nav');
    if(!nav||nav.querySelector('.gc80-mobile-account'))return;
    const senha=$('#minhaSenha'),sair=$('#sair');
    if(!senha&&!sair)return;
    const box=document.createElement('div');box.className='gc80-mobile-account';
    if(senha){const b=document.createElement('button');b.type='button';b.textContent='Minha senha';b.addEventListener('click',()=>senha.click());box.appendChild(b)}
    if(sair){const b=document.createElement('button');b.type='button';b.textContent='Sair';b.addEventListener('click',()=>sair.click());box.appendChild(b)}
    nav.appendChild(box);
  }

  // Fecha drawer após escolher opção no celular, mantendo o comportamento natural do App.
  function installDrawerAutoClose(){
    const nav=$('nav.desktop-nav');if(!nav||nav.dataset.gc80Close==='1')return;
    nav.dataset.gc80Close='1';
    nav.addEventListener('click',e=>{
      const btn=e.target.closest('button[data-go]');
      if(!btn||!root.classList.contains('gc80-mobile'))return;
      setTimeout(()=>{nav.classList.remove('open');$('#navBackdrop')?.classList.add('hidden')},40);
    });
  }

  function markDesktopShell(){
    if(root.classList.contains('gc80-electron'))document.body?.classList.add('gc80-electron-body');
  }

  function apply(){applyPlatform();ensureMobileAccount();installDrawerAutoClose();markDesktopShell()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  new MutationObserver(()=>requestAnimationFrame(apply)).observe(document.documentElement,{childList:true,subtree:true});
})();
