/* GCMBS V124 — V103 consolidada sem atalhos e sem "Acesso relacionado".
   O título do módulo passa a ocupar a faixa superior fixa abaixo do header. */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();

function activeSection(){return $$('main>section[data-view]').find(s=>!s.classList.contains('hidden'))||null}
function homeActive(){const s=$('main>section[data-view="inicio"]');return !!s&&!s.classList.contains('hidden')}
function currentTitle(){
  if(homeActive()) return 'Quadro Operacional';
  const s=activeSection();if(!s)return 'GCMBS';
  if(s.dataset.view==='online') return text($('#onlineTitulo'))||text($('#onlineModuloTitulo'))||'Módulo institucional';
  return text($('.desktop-page-head h1',s))||text($('h1',s))||'GCMBS';
}
function currentDescription(){
  if(homeActive()) return 'Painel institucional e panorama do dia';
  const s=activeSection();if(!s)return 'Gestão operacional integrada';
  if(s.dataset.view==='online') return text($('#onlineDescricao'))||text($('#onlineModuloDescricao'))||'Gestão operacional integrada';
  return text($('.desktop-page-head p',s))||'Gestão operacional integrada';
}

function ensureHeader(){
  const header=$('#appTela>header');if(!header)return;

  // V124: o título NÃO fica no header. Fica na faixa logo abaixo.
  $('.gc103-route-head',header)?.remove();

  // V124: atalhos solicitados para remoção definitiva.
  $('#gc103QuickScale',header)?.remove();
  $('#gc103QuickGcm',header)?.remove();
}

function ensureRelated(){
  let bar=$('#gc103RelatedBar');
  if(!bar){
    bar=document.createElement('div');
    bar.id='gc103RelatedBar';
    $('#appTela')?.appendChild(bar);
  }

  bar.className='gc124-route-bar';

  if(!$('#gc124RouteTitle',bar)){
    bar.innerHTML=
      '<div class="gc124-route-copy">'+
        '<strong id="gc124RouteTitle">GCMBS</strong>'+
        '<small id="gc124RouteMeta">Gestão operacional integrada</small>'+
      '</div>'+
      '<span class="gc103-sync-state" id="gc103SyncState">Online</span>';
  }

  const t=$('#gc124RouteTitle',bar);
  const m=$('#gc124RouteMeta',bar);
  if(t)t.textContent=currentTitle();
  if(m)m.textContent=currentDescription();
}

function syncState(){
  const out=$('#gc103SyncState');if(!out)return;
  const c=text($('#connectionStatus'))||'Online';
  const v=text($('#onlineVersao'))||'';
  out.textContent=v?`${c} · ${v.replace('Online/App ','')}`:c;
}

function dynamicOnline(){
  const view=$('[data-view="online"]');if(!view)return;
  const records=$('#onlineRegistrosCard',view), landing=$('.module-landing',view), head=$('.module-page-head',view);
  const open=records&&!records.classList.contains('hidden');
  landing?.classList.toggle('gc103-record-open',!!open);
  if(open&&head){
    const h=$('h1',head),p=$('p',head);const title=text($('#onlineTitulo')),desc=text($('#onlineDescricao'));
    if(h&&title)h.textContent=title;if(p&&desc)p.textContent=desc;
  }
  if(!open&&head){
    const h=$('h1',head),p=$('p',head),mh=$('#onlineModuloTitulo'),mp=$('#onlineModuloDescricao');
    if(h&&mh&&text(mh))h.textContent=text(mh);if(p&&mp&&text(mp))p.textContent=text(mp);
  }
  const ver=$('#onlineVersao');if(ver&&/10\.0\.7[68]/.test(text(ver)))ver.textContent='Online/App 10.0.85 · V124';
}

function compactRecordActions(){
  $$('[data-view="online"] #onlineRegistros .record-card').forEach(card=>{
    if(card.dataset.gc103Ready)return;card.dataset.gc103Ready='1';
    const buttons=$$('button',card).filter(b=>/editar|excluir|acessar|remover|alterar|abrir/i.test(text(b)));
    if(buttons.length>1){
      const wrap=document.createElement('div');wrap.className='gc103-record-actions';
      buttons[0].parentElement?.insertBefore(wrap,buttons[0]);buttons.forEach(b=>wrap.appendChild(b));
    }
  });
}

function versionLabels(){
  $$('[id*="Versao"],small,span').forEach(el=>{
    if(el.children.length)return;
    const s=text(el);if(s==='Online 10.0.85')el.textContent='Online 10.0.85';
  });
}

function update(){
  ensureHeader();
  ensureRelated();
  dynamicOnline();
  compactRecordActions();
  versionLabels();
  syncState();
  ensureHeader();
  ensureRelated();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
[80,250,700,1500].forEach(ms=>setTimeout(update,ms));
let timer=0;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(update,55)})
  .observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
console.info('[GCMBS] V124 topo consolidado Online/App ativo');
})();