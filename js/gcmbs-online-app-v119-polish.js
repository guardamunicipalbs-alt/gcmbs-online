/* GCMBS V119 — acabamento Online/App após validação visual da V118. */
(()=>{
'use strict';
if(window.__GCMBS_V119_POLISH__) return;
window.__GCMBS_V119_POLISH__=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();

function homeActive(){
  const s=$('main>section[data-view="inicio"]');
  return !!s && !s.classList.contains('hidden');
}

function compactConnection(){
  const el=$('#connectionStatus');
  if(!el) return;
  const raw=txt(el);
  if(!raw) return;

  // Mantém Offline/erros intactos. Compacta apenas a mensagem longa de sincronização.
  if(/última sincroniza[cç][aã]o/i.test(raw)){
    const m=raw.match(/(\d{1,2}):(\d{2})(?::\d{2})?/);
    if(m) el.textContent=`Sincronizado ${m[1].padStart(2,'0')}:${m[2]}`;
  }
}

function versionLabel(){
  // A versão binária continua 10.0.85 até a geração do novo APK.
  // Aqui atualizamos somente a identificação da camada visual.
  const ov=$('#onlineVersao');
  if(ov && /10\.0\.85/.test(txt(ov))) ov.textContent='Online/App 10.0.85 · V119';

  const state=$('#gc103SyncState');
  if(state && !homeActive()){
    const online=/offline/i.test(txt($('#connectionStatus')))?'Offline':'Online';
    state.textContent=`${online} · 10.0.85 · V119`;
  }
}

function headerButtons(){
  const q1=$('#gc103QuickScale');
  const q2=$('#gc103QuickGcm');
  const pass=$('#minhaSenha');
  if(q1) q1.textContent='+ Gerar escala';
  if(q2) q2.textContent='+ GCM';
  if(pass) pass.textContent='Minha senha';
}

function apply(){
  document.documentElement.classList.add('gc119-polish');
  document.documentElement.classList.toggle('gc119-home-active',homeActive());

  // A V103 recria a barra global. Não removemos o nó para não afetar outros módulos;
  // no Home ela fica invisível e permanece disponível nas demais telas.
  const bar=$('#gc103RelatedBar');
  if(bar) bar.setAttribute('aria-hidden', homeActive() ? 'true' : 'false');

  headerButtons();
  compactConnection();
  versionLabel();
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();

[80,180,400,800,1500].forEach(ms=>setTimeout(apply,ms));
let timer=0;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(apply,60);
}).observe(document.documentElement,{
  childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']
});
setInterval(apply,900);

console.info('[GCMBS] V119 acabamento visual Online/App ativo');
})();