// GCMBS 10.0.68 - HF10 R17.2
// Banco de Horas: impede que a renderizacao legada sobrescreva a lista filtrada do Comando.
// Somente apresentacao; nao cria, altera ou exclui dados.
let r172Busy=false,r172Timer=0,r172Observer=null;

function r172Banco(){return document.querySelector('[data-view="banco"]');}
function r172Visible(){const s=r172Banco();return !!s&&!s.classList.contains('hidden');}
function r172Manager(){return /banco de horas autorizado/i.test(String(document.getElementById('tituloBanco')?.textContent||''));}
function r172Schedule(delay=60){
  clearTimeout(r172Timer);
  r172Timer=setTimeout(()=>{
    if(!r172Visible()||!r172Manager()||r172Busy)return;
    const select=document.getElementById('bhGcmFiltro');
    if(!select||!window.__gcmbsR17Refresh)return;
    r172Busy=true;
    Promise.resolve(window.__gcmbsR17Refresh(false)).catch(()=>{}).finally(()=>{r172Busy=false;});
  },delay);
}
function r172Attach(){
  const list=document.getElementById('listaBanco');
  if(!list||list.__gcmbsR172Observed)return;
  list.__gcmbsR172Observed=true;
  r172Observer=new MutationObserver(()=>r172Schedule(40));
  r172Observer.observe(list,{childList:true,subtree:false});
}
function r172Init(){
  r172Attach();
  if(r172Visible())r172Schedule(80);
}
document.addEventListener('change',e=>{
  if(e.target?.id==='bhGcmFiltro'||e.target?.id==='bhCompetenciaFiltro')r172Schedule(20);
},true);
document.addEventListener('click',e=>{
  if(e.target.closest?.('#mainNav'))setTimeout(()=>{r172Attach();r172Schedule(80);},120);
},true);
window.addEventListener('pageshow',()=>setTimeout(r172Init,100));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r172Init,{once:true});else r172Init();
console.info('[GCMBS] HF10 R17.2 protecao da lista filtrada do Banco de Horas ativa');
