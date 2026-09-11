(()=>{'use strict';
const $=id=>document.getElementById(id);
const today=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
function dedupeGcmFilter(){
 const all=[...document.querySelectorAll('#bhGcmFiltroV136')];
 if(all.length>1)all.slice(1).forEach(x=>x.closest('label')?.remove()||x.remove());
 const first=$('bhGcmFiltroV136');if(first)first.closest('label')?.setAttribute('data-gcmbs-bank-gcm-filter','1');
 const toolbar=$('bhCompetenciaFiltro')?.closest('.toolbar');
 if(toolbar){const labels=[...toolbar.querySelectorAll('label')].filter(l=>/^GCM\s*/i.test((l.childNodes[0]?.textContent||l.textContent||'').trim()));if(labels.length>1)labels.slice(1).forEach(l=>l.remove())}
}
function normalizeCards(){
 document.querySelectorAll('#listaBanco .item,#listaCorrecoes .item,[data-view="banco"] .record-card,[data-view="banco"] .item,[data-view="permutas"] .record-card').forEach(card=>{
  card.dataset.v137='1';card.style.overflowWrap='anywhere';
  [...card.children].forEach(el=>{if(['SMALL','STRONG','SPAN'].includes(el.tagName)){el.style.display='block';el.style.marginTop=el===card.firstElementChild?'0':'6px'}});
  card.querySelectorAll('.status-pill').forEach(p=>{p.style.display='inline-flex';p.style.marginTop='6px'});
 });
}
function addProjectionLegend(){
 const host=$('bancoGestaoCard');if(!host||$('bhProjectionLegendV137'))return;
 const el=document.createElement('div');el.id='bhProjectionLegendV137';el.className='notice';el.innerHTML='<strong>Banco de Horas · auditoria</strong><br><span>Os lançamentos da competência permanecem rastreáveis por origem. Serviços futuros são identificados como previstos; aprovações/correções posteriores permanecem vinculadas ao GCM e à competência sem criar uma segunda movimentação.</span>';
 const list=$('listaBanco');(list?.parentNode||host).insertBefore(el,list||null);
}
function markFutureMovements(){
 const hoje=today();document.querySelectorAll('#listaBanco .item').forEach(card=>{
  const s=String(card.querySelector('small')?.textContent||'');const m=s.match(/(\d{2})\/(\d{2})\/(\d{4})/);if(!m)return;const iso=`${m[3]}-${m[2]}-${m[1]}`;
  let tag=card.querySelector('[data-gcmbs-previsto]');if(iso>hoje&&!tag){tag=document.createElement('small');tag.dataset.gcmbsPrevisto='1';tag.textContent='PREVISTO · serviço ainda não ocorrido';tag.style.cssText='display:inline-block;margin-top:7px;font-weight:700;color:#92400e';card.appendChild(tag)}else if(iso<=hoje&&tag)tag.remove();
 });
}
function clarifyDecisionStates(){
 document.querySelectorAll('[data-view="permutas"] .record-card,[data-view="banco"] .record-card').forEach(card=>{
  const pill=card.querySelector('.status-pill');if(!pill)return;const st=String(pill.textContent||'').trim().toUpperCase();
  if(['DECISAO_PENDENTE_DESKTOP','DECISÃO_PENDENTE_DESKTOP'].includes(st)){pill.textContent='DECISÃO REGISTRADA';pill.title='A decisão foi registrada na nuvem e aguarda consolidação/sincronização.'}
 });
}
function protectDecisionClicks(){
 if(document.documentElement.dataset.gcmbsDecisionGuard==='1')return;document.documentElement.dataset.gcmbsDecisionGuard='1';
 document.addEventListener('click',ev=>{const b=ev.target?.closest?.('[data-cmd-pm-ok],[data-cmd-pm-no],[data-cmd-mirror-ok],[data-cmd-mirror-no],[data-cmd-bh-ok],[data-cmd-bh-no]');if(!b||b.disabled)return;const original=b.textContent;setTimeout(()=>{b.disabled=true;b.textContent='Processando...';setTimeout(()=>{if(document.body.contains(b)){b.disabled=false;b.textContent=original}},15000)},0)},true);
}
function auditDom(){dedupeGcmFilter();normalizeCards();addProjectionLegend();markFutureMovements();clarifyDecisionStates()}
function boot(){protectDecisionClicks();auditDom();let queued=false;new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;auditDom()})}).observe(document.documentElement,{childList:true,subtree:true});setInterval(auditDom,5000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();