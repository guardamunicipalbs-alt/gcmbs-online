/* GCMBS V122 — move os controles Data + Sincronizar para abaixo do painel institucional */
(()=>{
'use strict';
if(window.__GCMBS_V122_CONTROLS__) return;
window.__GCMBS_V122_CONTROLS__=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));

function homeActive(){
  const s=$('main>section[data-view="inicio"]');
  return !!s && !s.classList.contains('hidden');
}

function ensureSlot(){
  const hero=$('.gc118-hero');
  if(!hero) return null;

  let slot=$('.gc122-home-controls-slot');
  if(!slot){
    slot=document.createElement('div');
    slot.className='gc122-home-controls-slot';
    hero.insertAdjacentElement('afterend', slot);
  }
  return slot;
}

function moveControls(){
  const controls=$('.gc118-controls');
  if(!controls) return;

  // Marca o local original para impedir espaços fantasmas.
  let anchor=$('.gc122-controls-anchor');
  if(!anchor){
    anchor=document.createElement('div');
    anchor.className='gc122-controls-anchor';
    controls.insertAdjacentElement('beforebegin', anchor);
  }

  if(homeActive()){
    const slot=ensureSlot();
    if(slot && controls.parentElement !== slot){
      slot.appendChild(controls);
    }
  }else if(anchor && controls.parentElement !== anchor.parentElement){
    anchor.insertAdjacentElement('afterend', controls);
  }
}

function apply(){
  document.documentElement.classList.add('gc122-controls-below-hero');
  document.documentElement.classList.toggle('gc122-home-active', homeActive());
  moveControls();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();

[80,180,400,800,1500].forEach(ms=>setTimeout(apply,ms));
let timer=0;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(apply,70);
}).observe(document.documentElement,{
  childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']
});
setInterval(apply,900);

console.info('[GCMBS] V122 controles abaixo do painel institucional ativos');
})();

/* GCMBS V129 loader — carrega a correção de Relatórios diretamente da réplica Desktop. */
(()=>{
  if(window.__GCMBS_V129_LOADER__)return;
  window.__GCMBS_V129_LOADER__=true;
  const s=document.createElement('script');
  s.src='js/gcmbs-v129-relatorios-desktop.js?v=100129';
  s.async=false;
  document.head.appendChild(s);
})();

/* GCMBS V130 loader — filtro por GCM no Banco de Horas do Comando. */
(()=>{
  if(window.__GCMBS_V130_LOADER__)return;
  window.__GCMBS_V130_LOADER__=true;
  const s=document.createElement('script');
  s.src='js/gcmbs-v130-banco-horas-filtro-comando.js?v=100130';
  s.async=false;
  document.head.appendChild(s);
})();

/* GCMBS V131 loader — Login Desktop aprovado adaptado para Online + App Android. */
(()=>{
  if(window.__GCMBS_V131_LOADER__)return;
  window.__GCMBS_V131_LOADER__=true;

  const css=document.createElement('link');
  css.rel='stylesheet';
  css.href='css/gcmbs-v131-login-mobile-online.css?v=100131';
  document.head.appendChild(css);

  const s=document.createElement('script');
  s.src='js/gcmbs-v131-login-mobile-online.js?v=100131';
  s.async=false;
  document.head.appendChild(s);
})();

/* GCMBS V132 loader — arte aprovada do Login para Online + App. Desktop permanece intacto. */
(()=>{
  if(window.__GCMBS_V132_LOADER__)return;
  window.__GCMBS_V132_LOADER__=true;
  const files=[
    'js/gcmbs-v132-hero-chunk-0.js?v=100132',
    'js/gcmbs-v132-hero-chunk-1.js?v=100132',
    'js/gcmbs-v132-hero-chunk-2.js?v=100132',
    'js/gcmbs-v132-hero-chunk-3.js?v=100132',
    'js/gcmbs-v132-login-hero.js?v=100132'
  ];
  let i=0;
  const next=()=>{
    if(i>=files.length)return;
    const s=document.createElement('script');
    s.src=files[i++];
    s.async=false;
    s.onload=next;
    s.onerror=()=>console.error('[GCMBS V132] falha ao carregar',s.src);
    document.head.appendChild(s);
  };
  next();
})();
