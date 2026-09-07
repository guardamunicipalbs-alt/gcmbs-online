/* GCMBS V123 — reorganização superior do Quadro Operacional */
(()=>{
'use strict';
if(window.__GCMBS_V123_TOP__) return;
window.__GCMBS_V123_TOP__=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();

function homeActive(){
  const s=$('main>section[data-view="inicio"]');
  return !!s && !s.classList.contains('hidden');
}

function ensureTitleBlock(){
  const main=$('.gc118-main');
  if(!main) return null;

  let slot=$('.gc123-title-slot', main);
  if(!slot){
    slot=document.createElement('div');
    slot.className='gc123-title-slot';
    main.insertBefore(slot, main.firstChild);
  }

  let top=$('.gc118-top');
  if(!top){
    top=document.createElement('div');
    top.className='gc118-top';
    top.innerHTML='<h1>Quadro Operacional</h1><p>Painel institucional e panorama do dia</p>';
  }

  if(top.parentElement !== slot){
    slot.appendChild(top);
  }
  top.classList.add('gc123-mounted');
  return top;
}

function removeTopExtras(){
  ['gc103QuickScale','gc103QuickGcm'].forEach(id=>{
    const e=document.getElementById(id);
    if(e){
      e.style.display='none';
      e.tabIndex=-1;
      e.setAttribute('aria-hidden','true');
    }
  });

  ['#gc103RelatedBar','.gc118-related'].forEach(sel=>{
    const e=$(sel);
    if(e){
      e.style.display='none';
      e.setAttribute('aria-hidden','true');
    }
  });
}

function compactSync(){
  const el=$('#connectionStatus');
  if(!el) return;
  const raw=txt(el);
  if(!raw) return;
  if(/última sincroniza[cç][aã]o/i.test(raw)){
    const m=raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    if(m) el.textContent=`Sincronizado ${m[1].padStart(2,'0')}:${m[2]}`;
  }
}

function apply(){
  document.documentElement.classList.add('gc123-top-clean');
  document.documentElement.classList.toggle('gc123-home-active', homeActive());

  removeTopExtras();
  compactSync();

  const headerTitle=document.getElementById('gc121HeaderTitle');
  if(headerTitle){
    headerTitle.style.display = homeActive() ? 'none' : '';
  }

  if(homeActive()){
    ensureTitleBlock();
  }
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();

[70,160,350,700,1200,1800].forEach(ms=>setTimeout(apply,ms));
let timer=0;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(apply,60);
}).observe(document.documentElement,{
  childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']
});
setInterval(apply,900);

console.info('[GCMBS] V123 limpeza superior do Quadro Operacional ativa');
})();