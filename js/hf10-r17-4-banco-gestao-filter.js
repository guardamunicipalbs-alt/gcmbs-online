// GCMBS 10.0.68 - HF10 R17.4
// Corrige somente a visibilidade dos cards da Analise de horas — Comando.
// Nao cria, altera ou exclui dados.
let r174Observer=null,r174Timer=0;

function r174Visible(){
  const s=document.querySelector('[data-view="banco"]');
  return !!s&&!s.classList.contains('hidden');
}
function r174Manager(){
  return /banco de horas autorizado/i.test(String(document.getElementById('tituloBanco')?.textContent||''));
}
function r174Apply(){
  if(!r174Visible()||!r174Manager())return;
  const el=document.getElementById('listaBancoGestao');
  const select=document.getElementById('bhGcmFiltro');
  if(!el||!select)return;
  const gid=Number(select.value||0);
  const nomeSel=String(select.selectedOptions?.[0]?.textContent||'').trim();
  const comp=String(document.getElementById('bhCompetenciaFiltro')?.value||'').trim();
  let vis=0;
  for(const card of el.querySelectorAll('.record-card')){
    const strong=String(card.querySelector('.record-card-head strong')?.textContent||'').trim();
    const meta=String(card.querySelector('.record-meta')?.textContent||'');
    const nomeOk=!gid||strong===nomeSel||strong.startsWith(nomeSel+' —');
    const compOk=!comp||meta.includes(`Competência ${comp}`);
    const ok=nomeOk&&compOk;
    if(ok){card.style.removeProperty('display');card.hidden=false;vis++;}
    else{card.style.setProperty('display','none','important');card.hidden=true;}
  }
  const empty=el.querySelector('[data-hf10-r17-gestao-empty]');
  if(empty){
    empty.hidden=vis>0;
    if(vis>0)empty.style.setProperty('display','none','important');
    else empty.style.removeProperty('display');
  }
}
function r174Schedule(delay=25){clearTimeout(r174Timer);r174Timer=setTimeout(r174Apply,delay);}
function r174Attach(){
  const el=document.getElementById('listaBancoGestao');
  if(el&&!el.__gcmbsR174Observed){
    el.__gcmbsR174Observed=true;
    r174Observer=new MutationObserver(()=>r174Schedule(20));
    r174Observer.observe(el,{childList:true,subtree:false});
  }
  r174Schedule(20);
}
document.addEventListener('change',e=>{
  if(e.target?.id==='bhGcmFiltro'||e.target?.id==='bhCompetenciaFiltro')r174Schedule(10);
},true);
document.addEventListener('click',e=>{
  if(e.target.closest?.('#mainNav'))setTimeout(r174Attach,120);
},true);
window.addEventListener('pageshow',()=>setTimeout(r174Attach,100));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',r174Attach,{once:true});else r174Attach();
console.info('[GCMBS] HF10 R17.4 filtro visual da Analise do Banco ativo');
