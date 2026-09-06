/* GCMBS V105 - formulário inline + tabela no padrão Desktop */
(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const txt=e=>String(e?.textContent||'').replace(/\s+/g,' ').trim();
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_\s]+/g,' ').trim().toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const cadastroTitles=/cadastro de guardas|equipes|postos operacionais|tipos de escalas|escala extra|feriados|controle de acesso|justificativa de faltas/i;
let rebuilding=false,autoOpenedFor='';

function currentTitle(){return txt($('#onlineTitulo'))||txt($('#onlineModuloTitulo'))||''}
function activeCadastro(){return cadastroTitles.test(currentTitle()) && !$('#onlineRegistrosCard')?.classList.contains('hidden')}

function installInlineEditor(){
  const dlg=$('#onlineEditor'),records=$('#onlineRegistrosCard'); if(!dlg||!records)return;
  let host=$('#gc105InlineEditorHost');
  if(!host){host=document.createElement('section');host.id='gc105InlineEditorHost';records.insertBefore(host,$('#onlineEntityTabs')||records.children[1]||null)}
  const card=$('.module-editor-card',dlg);
  if(card && !host.contains(card)) host.appendChild(card);

  if(!dlg.dataset.gc105Patched){
    dlg.dataset.gc105Patched='1';
    dlg.showModal=function(){
      document.body.classList.add('gc105-inline-editor');
      host.classList.add('gc105-open');
      try{window.scrollTo({top:Math.max(0,records.getBoundingClientRect().top+window.scrollY-145),behavior:'smooth'})}catch(_){}
    };
    dlg.close=function(){host.classList.remove('gc105-open')};
  }

  const actions=$('.module-editor-actions',host);
  const novo=$('#onlineNovo');
  if(actions&&novo&&!actions.contains(novo)){
    actions.appendChild(novo);
  }
  if(novo){
    novo.classList.remove('hidden');
    novo.textContent='Novo';
  }
  const cancel=$('#onlineCancelarBottom');
  if(cancel)cancel.textContent='Limpar / fechar';
}

function kvMap(card){
  const map=new Map();
  const kv=$('.online-kv',card); if(!kv)return map;
  const kids=Array.from(kv.children);
  for(let i=0;i<kids.length-1;i+=2){
    const k=norm(txt(kids[i])),v=txt(kids[i+1]);
    if(k)map.set(k,v);
  }
  return map;
}
function getVal(map,...labels){
  for(const label of labels){
    const k=norm(label);
    if(map.has(k))return map.get(k);
  }
  return '';
}
function makeAction(src,label,cls){
  if(!src)return '';
  const id='gc105-'+Math.random().toString(36).slice(2);
  setTimeout(()=>{
    const b=document.getElementById(id);
    if(b)b.addEventListener('click',ev=>{ev.preventDefault();src.click()});
  },0);
  return `<button type="button" id="${id}" class="${cls}">${label}</button>`;
}

function columnsFor(title,cards){
  if(/cadastro de guardas|guardas/i.test(title)){
    return [
      ['ID',m=>m.__key||''],
      ['Nome de guerra',m=>getVal(m,'nome de guerra','gcm','nome')],
      ['Nome completo',m=>getVal(m,'nome completo')],
      ['Matrícula',m=>getVal(m,'matricula')],
      ['CPF',m=>getVal(m,'cpf')],
      ['Status',m=>getVal(m,'status')]
    ];
  }
  if(/equipes/i.test(title))return [['ID',m=>m.__key||''],['Nome',m=>getVal(m,'nome')],['Tipo de escala',m=>getVal(m,'tipo de escala')],['Ciclo',m=>getVal(m,'ciclo')],['Ativa',m=>getVal(m,'ativa','ativo')]];
  if(/postos/i.test(title))return [['ID',m=>m.__key||''],['Nome',m=>getVal(m,'nome')],['Tipo',m=>getVal(m,'tipo')],['Prioridade',m=>getVal(m,'prioridade')],['Mínimo',m=>getVal(m,'efetivo minimo','efetivo mínimo')],['Máximo',m=>getVal(m,'efetivo maximo','efetivo máximo')],['Ativo',m=>getVal(m,'ativo')]];
  if(/tipos de escalas/i.test(title))return [['ID',m=>m.__key||''],['Nome',m=>getVal(m,'nome')],['Descrição',m=>getVal(m,'descricao','descrição')],['Ativo',m=>getVal(m,'ativo')]];
  const first=cards[0]?kvMap(cards[0]):new Map();
  const labels=Array.from(first.keys()).slice(0,6);
  return [['ID',m=>m.__key||''],...labels.map(k=>[k.replace(/\b\w/g,c=>c.toUpperCase()),m=>m.get(k)||''])];
}

function rebuildTable(){
  if(rebuilding)return;
  const source=$('#onlineRegistros'),recordsCard=$('#onlineRegistrosCard');
  if(!source||!recordsCard||recordsCard.classList.contains('hidden'))return;
  const title=currentTitle();
  if(!cadastroTitles.test(title))return;
  const cards=$$(':scope > [data-online-key],:scope > .item[data-online-key]',source);
  let host=$('#gc105TableHost');
  if(!host){host=document.createElement('section');host.id='gc105TableHost';source.parentElement.insertBefore(host,source)}
  rebuilding=true;
  try{
    if(!cards.length){
      host.innerHTML='<div class="gc105-table-title"><div><h3>Registros cadastrados</h3><small>Listagem no padrão do Desktop</small></div></div><div class="gc105-empty">Nenhum registro.</div>';
      source.classList.add('gc105-source-hidden'); return;
    }
    const cols=columnsFor(title,cards);
    const rows=cards.map(card=>{
      const m=kvMap(card);m.__key=card.dataset.onlineKey||'';
      const edit=$('[data-online-edit]',card),del=$('[data-online-del]',card),doc=$('[data-online-doc]',card);
      const cells=cols.map(([h,get],i)=>`<td class="${i===0?'gc105-id':/status|ativo|ativa/i.test(h)?'gc105-status':''}">${esc(get(m)||'—')}</td>`).join('');
      const actions=[
        makeAction(edit,/controle de acesso/i.test(title)?'Acessar':'Editar','gc105-edit'),
        makeAction(doc,'Documento',''),
        makeAction(del,'Excluir','gc105-del')
      ].filter(Boolean).join('');
      return `<tr data-key="${esc(m.__key)}">${cells}<td class="gc105-actions"><div class="gc105-inline-actions">${actions}</div></td></tr>`;
    }).join('');
    host.innerHTML=`<div class="gc105-table-title"><div><h3>${/guardas/i.test(title)?'Guardas cadastrados':'Registros cadastrados'}</h3><small>Listagem no mesmo padrão do Desktop</small></div></div><div class="gc105-table-wrap"><table class="gc105-table"><thead><tr>${cols.map(c=>`<th>${esc(c[0])}</th>`).join('')}<th>Ações</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    source.classList.add('gc105-source-hidden');
    $$('tbody tr',host).forEach(tr=>{
      tr.addEventListener('dblclick',ev=>{
        if(ev.target.closest('button'))return;
        const card=cards.find(c=>String(c.dataset.onlineKey)===String(tr.dataset.key));
        $('[data-online-edit]',card)?.click();
      });
    });
  }finally{rebuilding=false}
}

function ensureDefaultForm(){
  if(!activeCadastro())return;
  const title=currentTitle();
  document.body.classList.add('gc105-inline-editor');
  installInlineEditor();
  const host=$('#gc105InlineEditorHost'),novo=$('#onlineNovo');
  if(!novo||novo.classList.contains('hidden'))return;
  const key=norm(title);
  if(autoOpenedFor!==key && !host?.classList.contains('gc105-open')){
    autoOpenedFor=key;
    setTimeout(()=>{ if(activeCadastro() && !host.classList.contains('gc105-open')) novo.click(); },80);
  }
}
function cleanHeader(){
  const records=$('#onlineRegistrosCard'); if(!records||records.classList.contains('hidden'))return;
  const title=currentTitle();
  if(!cadastroTitles.test(title))return;
  $('.online-toolbar #onlineVoltar')?.classList.add('hidden');
  const h=$('.online-toolbar h2'); if(h)h.textContent=title;
}
function tick(){
  if(!activeCadastro()){document.body.classList.remove('gc105-inline-editor');autoOpenedFor='';return}
  installInlineEditor();cleanHeader();rebuildTable();ensureDefaultForm();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
[80,220,600,1200].forEach(ms=>setTimeout(tick,ms));
let timer=0;
new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(tick,55)}).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
console.info('[GCMBS] V105 cadastro no padrão real do Desktop ativo');
})();
