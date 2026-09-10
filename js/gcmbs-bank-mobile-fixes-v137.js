(()=>{'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dedupeGcmFilter(){
 const all=[...document.querySelectorAll('#bhGcmFiltroV136')];
 if(all.length>1)all.slice(1).forEach(x=>x.closest('label')?.remove());
 const first=$('bhGcmFiltroV136');if(first)first.closest('label')?.setAttribute('data-gcmbs-bank-gcm-filter','1');
 const toolbar=$('bhCompetenciaFiltro')?.closest('.toolbar');
 if(toolbar){const labels=[...toolbar.querySelectorAll('label')].filter(l=>/^GCM\s*/i.test((l.childNodes[0]?.textContent||l.textContent||'').trim()));if(labels.length>1)labels.slice(1).forEach(l=>l.remove())}
}
function normalizeText(){
 document.querySelectorAll('#listaBanco .item, [data-view="banco"] .item').forEach(card=>{
  if(card.dataset.v137==='1')return;card.dataset.v137='1';
  const small=card.querySelector('small'),strong=card.querySelector('strong'),span=card.querySelector('span');
  if(small)small.style.display='block';if(strong){strong.style.display='block';strong.style.marginTop='6px'}if(span){span.style.display='block';span.style.marginTop='6px';span.style.overflowWrap='anywhere'}
 });
}
function addProjectionLegend(){
 const host=$('bancoGestaoCard');if(!host||$('bhProjectionLegendV137'))return;
 const el=document.createElement('div');el.id='bhProjectionLegendV137';el.className='notice';el.innerHTML='<strong>Banco de Horas</strong><br><span>Horas previstas permanecem na projeção da competência e são somadas às efetivadas no fechamento da folha. Faltas ou serviços não realizados devem ser ajustados pela Movimentação do Comando, preservando a auditoria.</span>';
 const list=$('listaBanco');(list?.parentNode||host).insertBefore(el,list||null);
}
function auditDom(){dedupeGcmFilter();normalizeText();addProjectionLegend()}
function boot(){auditDom();new MutationObserver(auditDom).observe(document.documentElement,{childList:true,subtree:true});setInterval(auditDom,3000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();