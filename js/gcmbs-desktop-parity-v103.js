/* GCMBS V103 — organiza Online/App no mesmo padrão visual do Desktop sem alterar regras de negócio. */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const text=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();

function activeSection(){return $$('main>section[data-view]').find(s=>!s.classList.contains('hidden'))||null}
function clickNavByText(needle){const n=norm(needle);const b=$$('nav.desktop-nav button').find(x=>norm(x.textContent).includes(n));if(b)b.click()}
function currentTitle(){
  const s=activeSection();if(!s)return 'GCMBS';
  if(s.dataset.view==='online') return text($('#onlineTitulo'))||text($('#onlineModuloTitulo'))||'Módulo institucional';
  return text($('.desktop-page-head h1',s))||text($('h1',s))||'GCMBS';
}
function currentDescription(){
  const s=activeSection();if(!s)return 'Gestão operacional integrada';
  if(s.dataset.view==='online') return text($('#onlineDescricao'))||text($('#onlineModuloDescricao'))||'Gestão operacional integrada';
  return text($('.desktop-page-head p',s))||'Gestão operacional integrada';
}
function ensureHeader(){
  const header=$('#appTela>header');if(!header)return;
  const brand=$('.brand-head',header);if(brand&&!$('.gc103-route-head',brand)){
    const box=document.createElement('div');box.className='gc103-route-head';box.innerHTML='<strong id="gc103RouteTitle">GCMBS</strong><small id="gc103RouteMeta">Gestão operacional integrada</small>';
    const toggle=$('#menuToggle',brand);if(toggle)toggle.insertAdjacentElement('afterend',box);else brand.appendChild(box);
  }
  const hu=$('.header-user',header);if(hu&&!$('#gc103QuickScale',hu)){
    const q1=document.createElement('button');q1.id='gc103QuickScale';q1.type='button';q1.className='gc103-quick';q1.textContent='+ Gerar escala';q1.addEventListener('click',()=>clickNavByText('Gerador de Escala'));
    const q2=document.createElement('button');q2.id='gc103QuickGcm';q2.type='button';q2.className='gc103-quick';q2.textContent='+ GCM';q2.addEventListener('click',()=>clickNavByText('Cadastro de Guardas'));
    hu.insertBefore(q2,hu.firstChild);hu.insertBefore(q1,q2);
  }
  const t=$('#gc103RouteTitle');if(t)t.textContent=currentTitle();
  const m=$('#gc103RouteMeta');if(m)m.textContent=currentDescription();
}
function ensureRelated(){
  if($('#gc103RelatedBar'))return;
  const bar=document.createElement('div');bar.id='gc103RelatedBar';
  bar.innerHTML='<span class="gc103-related-label">Acesso relacionado:</span><button type="button" data-gc103-nav="Cadastro de Guardas">Guardas</button><button type="button" data-gc103-nav="Equipes">Equipes</button><button type="button" data-gc103-nav="Postos Operacionais">Postos</button><button type="button" data-gc103-nav="Gerador de Escala">Gerar escala</button><span class="gc103-sync-state" id="gc103SyncState">Online</span>';
  $('#appTela')?.appendChild(bar);
  $$('[data-gc103-nav]',bar).forEach(b=>b.addEventListener('click',()=>clickNavByText(b.dataset.gc103Nav)));
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
  const ver=$('#onlineVersao');if(ver&&/10\.0\.7[68]/.test(text(ver)))ver.textContent='Online/App 10.0.85 · V110';
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
  $$('#appTela').forEach(()=>{});
  $$('[id*="Versao"],small,span').forEach(el=>{
    if(el.children.length)return;
    const s=text(el);if(s==='Online 10.0.85')el.textContent='Online 10.0.85';
  });
}
function update(){ensureHeader();ensureRelated();dynamicOnline();compactRecordActions();versionLabels();syncState();ensureHeader()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});else update();
[80,250,700,1500].forEach(ms=>setTimeout(update,ms));
let timer=0;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(update,55)}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
console.info('[GCMBS] V103 padrão Desktop ativo no Online/App');
})();
