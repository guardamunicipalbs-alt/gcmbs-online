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