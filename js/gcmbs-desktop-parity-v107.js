/* GCMBS V108 - V107 + ordem decrescente de data na Escala Extra Manual */
(()=>{
'use strict';
const root=document.documentElement;
root.classList.add('gc107-clean');

const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_\s]+/g,' ').trim().toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const CAD=/cadastro de guardas|equipes|postos operacionais|tipos de escalas|escala extra|feriados|controle de acesso|justificativa de faltas/i;
let opening=false,currentKey='',rebuilding=false;

function pageTitle(){return txt($('#onlineTitulo'))||txt($('#onlineModuloTitulo'))||''}
function active(){
  const card=$('#onlineRegistrosCard');
  return !!card&&!card.classList.contains('hidden')&&CAD.test(pageTitle());
}
function label(){
  const t=pageTitle();
  if(/guardas/i.test(t))return 'Guardas cadastrados';
  if(/equipes/i.test(t))return 'Equipes cadastradas';
  if(/postos/i.test(t))return 'Postos cadastrados';
  if(/tipos de escalas/i.test(t))return 'Tipos de escalas cadastrados';
  return 'Registros cadastrados';
}
function cleanLegacy(){
  $$('.gc104-section-head,.gc104-summary-strip,.gc104-table-wrap,.gc104-record-note').forEach(el=>el.remove());
  $$('[class*="gc104-"]').forEach(el=>{
    [...el.classList].filter(c=>c.startsWith('gc104-')).forEach(c=>el.classList.remove(c));
  });

  const dlg=$('#onlineEditor');
  const moved=$('#gc105InlineEditorHost .module-editor-card');
  if(dlg&&moved&&!$('.module-editor-card',dlg))dlg.appendChild(moved);
  $('#gc105InlineEditorHost')?.remove();
  $('#gc105TableHost')?.remove();
  $('#gc107TableHost')?.remove();
  $('#gc107ListHead')?.remove();
  $('#onlineRegistros')?.classList.remove('gc104-hidden-source','gc105-source-hidden');
}
function patchDialog(){
  const dlg=$('#onlineEditor'),card=$('#onlineRegistrosCard');
  if(!dlg||!card)return null;

  const moved=$('#gc105InlineEditorHost .module-editor-card');
  if(moved&&!$('.module-editor-card',dlg))dlg.appendChild(moved);

  dlg.classList.add('gc107-inline-editor');
  if(dlg.parentElement!==card)card.insertBefore(dlg,card.firstChild);

  if(!dlg.dataset.gc107Patched){
    dlg.dataset.gc107Patched='1';
    try{
      dlg.showModal=function(){this.setAttribute('open','')};
      dlg.show=function(){this.setAttribute('open','')};
      dlg.close=function(){this.removeAttribute('open')};
    }catch(_){}
  }

  const actions=$('.module-editor-actions',dlg),novo=$('#onlineNovo');
  if(actions&&novo&&!actions.contains(novo))actions.appendChild(novo);
  if(novo){novo.classList.remove('hidden');novo.textContent='Novo';}
  const cancel=$('#onlineCancelarBottom');if(cancel)cancel.textContent='Limpar';
  return dlg;
}
function autoOpen(){
  const dlg=patchDialog();if(!dlg)return;
  const k=norm(pageTitle()),fields=$('#onlineCampos');
  if(currentKey!==k||!txt(fields)){
    currentKey=k;
    const novo=$('#onlineNovo');
    if(novo&&!opening){
      opening=true;
      setTimeout(()=>{try{novo.click()}finally{setTimeout(()=>opening=false,120)}},30);
    }
  }else if(!dlg.hasAttribute('open')){
    dlg.setAttribute('open','');
  }
}
function kv(card){
  const m=new Map(),box=$('.online-kv',card);if(!box)return m;
  const kids=Array.from(box.children);
  for(let i=0;i<kids.length-1;i+=2){const k=norm(txt(kids[i])),v=txt(kids[i+1]);if(k)m.set(k,v)}
  return m;
}
function val(m,...keys){for(const k of keys){const n=norm(k);if(m.has(n))return m.get(n)}return ''}
function gc108DateValue(v){
  const s=String(v||'').trim();
  if(!s||s==='—')return -1;
  let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m)return Number(m[3]+m[2]+m[1]);
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(m)return Number(m[1]+m[2]+m[3]);
  return -1;
}
function cols(title,cards){
  if(/guardas/i.test(title))return [
    ['ID',m=>m.__key||''],['Nome de guerra',m=>val(m,'nome de guerra','gcm','nome')],
    ['Nome completo',m=>val(m,'nome completo')],['Matrícula',m=>val(m,'matricula')],
    ['CPF',m=>val(m,'cpf')],['Status',m=>val(m,'status')]
  ];
  if(/equipes/i.test(title))return [['ID',m=>m.__key||''],['Nome',m=>val(m,'nome')],['Tipo de escala',m=>val(m,'tipo de escala')],['Ciclo',m=>val(m,'ciclo')],['Ativa',m=>val(m,'ativa','ativo')]];
  if(/postos/i.test(title))return [['ID',m=>m.__key||''],['Nome',m=>val(m,'nome')],['Tipo',m=>val(m,'tipo')],['Prioridade',m=>val(m,'prioridade')],['Mínimo',m=>val(m,'efetivo minimo','efetivo mínimo')],['Máximo',m=>val(m,'efetivo maximo','efetivo máximo')],['Ativo',m=>val(m,'ativo')]];
  const first=cards[0]?kv(cards[0]):new Map(),keys=Array.from(first.keys()).slice(0,6);
  return [['ID',m=>m.__key||''],...keys.map(k=>[k.replace(/\b\w/g,c=>c.toUpperCase()),m=>m.get(k)||''])];
}
function makeButton(src,text,cls){
  if(!src)return null;
  const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;
  b.addEventListener('click',ev=>{ev.preventDefault();src.click()});
  return b;
}
function buildList(){
  if(rebuilding)return;
  const card=$('#onlineRegistrosCard'),src=$('#onlineRegistros');if(!card||!src)return;
  rebuilding=true;
  try{
    let head=$('#gc107ListHead');
    if(!head){
      head=document.createElement('div');head.id='gc107ListHead';
      head.innerHTML='<div><h3></h3><small></small></div><div id="gc107SearchHost"></div>';
      card.appendChild(head);
    }
    $('h3',head).textContent=label();
    const total=Number(txt($('#onlineTotal'))||0);
    $('small',head).textContent=total?`${total} registro(s) · listagem no padrão do Desktop`:'Listagem no padrão do Desktop';
    const search=$('.module-search',card),sh=$('#gc107SearchHost',head);
    if(search&&sh&&!sh.contains(search))sh.appendChild(search);

    let host=$('#gc107TableHost');
    if(!host){host=document.createElement('section');host.id='gc107TableHost';card.appendChild(host)}

    const cards=$$(':scope > .item[data-online-key],:scope > [data-online-key]',src);
    if(!cards.length){host.innerHTML='<div class="gc107-empty">Nenhum registro.</div>';src.classList.add('gc107-source-hidden');return}

    const title=pageTitle(),columns=cols(title,cards);
    const rows=cards.map(c=>{
      const m=kv(c);m.__key=c.dataset.onlineKey||'';
      return {card:c,map:m,sort:val(m,'nome de guerra','nome','nome completo')||m.__key};
    }).sort((a,b)=>{
      if(/escala extra manual|escala extra/i.test(title)){
        const da=gc108DateValue(val(a.map,'data'));
        const db=gc108DateValue(val(b.map,'data'));
        if(da!==db)return db-da;
        const ia=Number(a.map.__key||0),ib=Number(b.map.__key||0);
        if(Number.isFinite(ia)&&Number.isFinite(ib)&&ia!==ib)return ib-ia;
        return 0;
      }
      return String(a.sort).localeCompare(String(b.sort),'pt-BR',{sensitivity:'base'});
    });

    const table=document.createElement('table');table.className='gc107-table';
    table.innerHTML=`<thead><tr>${columns.map(x=>`<th>${esc(x[0])}</th>`).join('')}<th>Ações</th></tr></thead><tbody></tbody>`;
    const tb=$('tbody',table);
    rows.forEach(r=>{
      const tr=document.createElement('tr');
      columns.forEach(([h,get],i)=>{
        const td=document.createElement('td');td.textContent=get(r.map)||'—';
        if(i===0)td.classList.add('gc107-id');if(/status|ativo|ativa/i.test(h))td.classList.add('gc107-status');
        tr.appendChild(td);
      });
      const td=document.createElement('td');td.className='gc107-actions';const box=document.createElement('div');box.className='gc107-inline-actions';
      const edit=$('[data-online-edit]',r.card),del=$('[data-online-del]',r.card),doc=$('[data-online-doc]',r.card);
      const eb=makeButton(edit,/controle de acesso/i.test(title)?'Acessar':'Editar','gc107-edit');if(eb)box.appendChild(eb);
      const db=makeButton(doc,'Documento','');if(db)box.appendChild(db);
      const xb=makeButton(del,'Excluir','gc107-del');if(xb)box.appendChild(xb);
      td.appendChild(box);tr.appendChild(td);
      tr.addEventListener('dblclick',ev=>{if(!ev.target.closest('button'))edit?.click()});
      tb.appendChild(tr);
    });
    const wrap=document.createElement('div');wrap.className='gc107-table-wrap';wrap.appendChild(table);
    host.replaceChildren(wrap);
    src.classList.add('gc107-source-hidden');
  }finally{rebuilding=false}
}
function version(){
  const ov=$('#onlineVersao');if(ov)ov.textContent='Online/App 10.0.84 · V108';
  $$('small,span').forEach(el=>{
    if(el.children.length)return;
    const s=txt(el);
    if(/^Online\s*(?:\/App)?\s*[-·]?\s*10\.0\.\d+(?:\s*[-·]\s*V\d+)?$/i.test(s))el.textContent='Online · 10.0.84 · V108';
  });
}
function tick(){
  version();
  if(!active()){document.body.classList.remove('gc107-cadastro');currentKey='';return}
  document.body.classList.add('gc107-cadastro');
  cleanLegacy();
  patchDialog();
  autoOpen();
  buildList();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
[80,220,500,1000,1800].forEach(ms=>setTimeout(tick,ms));
let timer=0;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(tick,70)}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
setInterval(()=>{if(active())version()},1500);
console.info('[GCMBS] V108 ordem decrescente de data ativa');
})();
