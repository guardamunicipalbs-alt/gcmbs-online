/* GCMBS V126 — isolamento de navegação / editor Online + App
   Corrige vazamento visual de formulário entre módulos e mantém o título superior
   coerente com o item ativo do menu. */
(()=>{
'use strict';
if(window.__GCMBS_V126_NAV_GUARD__)return;
window.__GCMBS_V126_NAV_GUARD__=true;

const $=(s,r=document)=>r.querySelector(s);
const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();

function activeModuleButton(){
  return $('#mainNav [data-module].active') ||
         $('.desktop-nav [data-module].active') ||
         $('#mainNav [data-go].active');
}
function activeModuleId(){
  const b=activeModuleButton();
  return String(b?.dataset?.module||b?.dataset?.go||'').trim();
}
function activeModuleLabel(){
  const b=activeModuleButton();
  return text($('.nav-label',b)) || text(b).replace(/\s+\d+\s*$/,'').trim();
}
function onlineViewVisible(){
  const v=$('[data-view="online"]');
  return !!v && !v.classList.contains('hidden');
}
function closeOnlineEditor(clear=false){
  const dlg=$('#onlineEditor');
  if(dlg){
    try{ if(dlg.open) dlg.close(); }catch{}
    dlg.removeAttribute('open');
  }
  if(clear){
    const campos=$('#onlineCampos');
    if(campos)campos.innerHTML='';
    const msg=$('#onlineMsg');
    if(msg)msg.textContent='';
  }
}
function fixRouteTitle(){
  const bar=$('#gc103RelatedBar');
  if(!bar)return;
  const title=$('#gc124RouteTitle',bar);
  const meta=$('#gc124RouteMeta',bar);
  const label=activeModuleLabel();

  if(label && title && (onlineViewVisible() || activeModuleId())){
    title.textContent=label;
  }

  if(meta && onlineViewVisible()){
    const d=text($('#onlineModuloDescricao')) || text($('#onlineDescricao'));
    if(d)meta.textContent=d;
  }
}
function staleEditorGuard(){
  const dlg=$('#onlineEditor');
  if(!dlg?.open)return;

  const owner=String(dlg.dataset.gc126Module||'');
  const current=activeModuleId();

  if(owner && current && owner!==current){
    closeOnlineEditor(true);
  }
}
function apply(){
  fixRouteTitle();
  staleEditorGuard();
}

/* Captura antes dos handlers do app: ao trocar de módulo, o editor antigo é fechado. */
document.addEventListener('click',e=>{
  const nav=e.target.closest?.('#mainNav [data-module],#mainNav [data-go],.desktop-nav [data-module],.desktop-nav [data-go]');
  if(nav){
    closeOnlineEditor(true);
    setTimeout(apply,0);
    setTimeout(apply,120);
    setTimeout(apply,500);
    return;
  }

  if(e.target.closest?.('#onlineNovo')){
    const dlg=$('#onlineEditor');
    if(dlg)dlg.dataset.gc126Module=activeModuleId();
  }
},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();

[80,200,500,1000].forEach(ms=>setTimeout(apply,ms));
let timer=0;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(apply,45);
}).observe(document.documentElement,{
  childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','open']
});
setInterval(apply,700);

console.info('[GCMBS] V126 navigation/editor guard ativo');
})();