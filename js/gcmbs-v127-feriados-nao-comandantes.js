/* GCMBS V127 — Feriados somente consulta para GCMs NÃO COMANDANTES.
   Não altera o fluxo de Comandante/Subcomandante.
*/
(()=>{
'use strict';
if(window.__GCMBS_V127_FERIADOS_READONLY__)return;
window.__GCMBS_V127_FERIADOS_READONLY__=true;

const $=(s,r=document)=>r.querySelector(s);
const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();

function onlineVisible(){
  const v=$('main>section[data-view="online"]');
  return !!v && !v.classList.contains('hidden');
}
function feriadosAtivo(){
  const b=$('#mainNav [data-module="feriados"].active,.desktop-nav [data-module="feriados"].active');
  if(b)return true;
  if(!onlineVisible())return false;
  return norm(text($('#onlineTitulo')))==='FERIADOS' || norm(text($('#onlineModuloTitulo')))==='FERIADOS';
}
function somenteConsulta(){
  return norm(text($('#onlineNivel')))==='CONSULTA';
}
function alvoNaoComandante(){
  return feriadosAtivo() && somenteConsulta();
}
function fecharFormularioFantasma(){
  const dlg=$('#onlineEditor');
  if(dlg){
    try{if(dlg.open)dlg.close()}catch{}
    dlg.removeAttribute('open');
    dlg.setAttribute('aria-hidden','true');
  }
  const campos=$('#onlineCampos');
  if(campos)campos.innerHTML='';
  const msg=$('#onlineMsg');
  if(msg)msg.textContent='';
}
function fixarFeriadosConsulta(){
  if($('#onlineTitulo'))$('#onlineTitulo').textContent='Feriados';
  if($('#onlineDescricao'))$('#onlineDescricao').textContent='Calendário institucional. Consulta disponível; cadastro e alterações são exclusivos da equipe COMANDANTES.';
  if($('#onlineModuloTitulo'))$('#onlineModuloTitulo').textContent='Feriados';
  if($('#onlineModuloDescricao'))$('#onlineModuloDescricao').textContent='Calendário institucional. GCMs fora da equipe COMANDANTES possuem acesso somente para consulta.';
  if($('#gc124RouteTitle'))$('#gc124RouteTitle').textContent='Feriados';
  if($('#gc124RouteMeta'))$('#gc124RouteMeta').textContent='Calendário institucional. Consulta para GCMs fora da equipe COMANDANTES.';

  const novo=$('#onlineNovo');
  if(novo){
    novo.classList.add('hidden');
    novo.setAttribute('aria-hidden','true');
    novo.tabIndex=-1;
  }

  const card=$('#onlineRegistrosCard');
  if(card)card.classList.remove('hidden');

  fecharFormularioFantasma();
}

function limparAoSair(){
  const dlg=$('#onlineEditor');
  if(dlg)dlg.removeAttribute('aria-hidden');
  const novo=$('#onlineNovo');
  if(novo){
    novo.removeAttribute('aria-hidden');
    novo.tabIndex=0;
  }
}

function apply(){
  const alvo=alvoNaoComandante();
  document.documentElement.classList.toggle('gc127-feriados-readonly',alvo);

  if(alvo)fixarFeriadosConsulta();
  else limparAoSair();
}

document.addEventListener('click',e=>{
  const nav=e.target.closest?.('#mainNav [data-module],.desktop-nav [data-module]');
  if(!nav)return;
  [0,60,150,350,700].forEach(ms=>setTimeout(apply,ms));
},true);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
else apply();

[80,180,400,800,1400].forEach(ms=>setTimeout(apply,ms));
let timer=0;
new MutationObserver(()=>{
  clearTimeout(timer);
  timer=setTimeout(apply,55);
}).observe(document.documentElement,{
  childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','open']
});
setInterval(apply,850);

console.info('[GCMBS] V127 Feriados read-only somente para não-COMANDANTES ativo');
})();