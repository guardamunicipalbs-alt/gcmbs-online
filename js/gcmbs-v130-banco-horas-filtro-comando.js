/* GCMBS V130 — Banco de Horas: filtro por GCM para Comando.
   A competência continua sendo o filtro temporal. Para Comandante/Subcomandante,
   acrescenta seleção de GCM e recalcula os indicadores/movimentações a partir
   da réplica canônica recebida do Desktop. */
(()=>{
'use strict';
if(window.__GCMBS_V130_BANCO_FILTRO__)return;
window.__GCMBS_V130_BANCO_FILTRO__=true;

const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const fmt=d=>{const m=String(d||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(d||'')};
const horas=min=>{const n=Number(min||0),sg=n<0?'-':'';return `${sg}${Math.floor(Math.abs(n)/60)}h${String(Math.abs(n)%60).padStart(2,'0')}`};

let banco=[];
let refs={guardas:[]};
let sessao=null;
let loading=false;
let loaded=false;
let applying=false;
let lastSig='';
let timer=0;

function bancoVisivel(){const s=$('main>section[data-view="banco"]');return !!s&&!s.classList.contains('hidden')}
async function call(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function gestor(){
  const role=norm(sessao?.role),cargo=norm(sessao?.cargo);
  if(role.includes('COMANDANTE')||cargo.includes('COMANDANTE'))return true;
  return /BANCO DE HORAS AUTORIZADO/i.test($('#tituloBanco')?.textContent||'');
}
function competencia(x){
  const p=x?.payload&&typeof x.payload==='object'?x.payload:{};
  return String(x?.competencia||p.competencia||p.competencia_origem||x?.data_fato||p.data||x?.created_at||'').slice(0,7);
}
function nomeMov(x){return String(x?.nome_guerra||x?.guarda_nome||x?.hist_guarda_nome_guerra||'').trim()}
function guardaId(x){return Number(x?.guarda_id||x?.hist_guarda_id||x?.payload?.guarda_id||0)}
function nomePorId(id){
  const g=(refs.guardas||[]).find(x=>Number(x?.id)===Number(id));
  return String(g?.nome_guerra||g?.nome_completo||'').trim();
}
function selecionado(){return $('#bhGcmFiltro')?.value||''}
function corresponde(x,sel=selecionado()){
  if(!sel)return true;
  if(sel.startsWith('id:'))return guardaId(x)===Number(sel.slice(3));
  if(sel.startsWith('nome:'))return norm(nomeMov(x))===sel.slice(5);
  return true;
}
function ensureStyle(){
  if($('#gc130BancoStyle'))return;
  const st=document.createElement('style');st.id='gc130BancoStyle';st.textContent=`
    section[data-view="banco"] .gc130-bank-filter{min-width:210px}
    section[data-view="banco"] .gc130-bank-filter select{min-width:210px}
    section[data-view="banco"] .gc130-bank-refresh{align-self:end;min-height:42px}
    section[data-view="banco"] .gc130-bank-filter-note{font-size:11px;color:#64748b;margin-left:auto}
    @media(max-width:760px){section[data-view="banco"] .gc130-bank-filter{width:100%}section[data-view="banco"] .gc130-bank-filter select{min-width:0}}
  `;document.head.appendChild(st);
}
function opcoesGcm(){
  const map=new Map();
  for(const g of refs.guardas||[]){const id=Number(g?.id||0),nome=String(g?.nome_guerra||g?.nome_completo||'').trim();if(id&&nome)map.set(`id:${id}`,nome)}
  for(const x of banco){const id=guardaId(x),nome=nomeMov(x)||nomePorId(id);if(id&&nome)map.set(`id:${id}`,nome);else if(nome)map.set(`nome:${norm(nome)}`,nome)}
  return [...map].sort((a,b)=>a[1].localeCompare(b[1],'pt-BR',{sensitivity:'base'}));
}
function ensureFiltro(){
  if(!bancoVisivel()||!gestor())return null;
  ensureStyle();
  const toolbar=$('section[data-view="banco"] .card .toolbar');if(!toolbar)return null;
  let wrap=$('#gc130BancoFiltroWrap');
  if(!wrap){
    wrap=document.createElement('label');wrap.id='gc130BancoFiltroWrap';wrap.className='gc130-bank-filter';wrap.innerHTML='GCM<select id="bhGcmFiltro"><option value="">Todos os GCMs</option></select>';
    const comp=$('#bhCompetenciaFiltro')?.closest('label');
    if(comp)comp.insertAdjacentElement('afterend',wrap);else toolbar.appendChild(wrap);
    wrap.querySelector('select').addEventListener('change',()=>{lastSig='';render(true)});
  }
  let btn=$('#gc130BancoAtualizar');
  if(!btn){btn=document.createElement('button');btn.id='gc130BancoAtualizar';btn.type='button';btn.className='secondary gc130-bank-refresh';btn.textContent='↻ Atualizar';btn.addEventListener('click',()=>load(true));toolbar.appendChild(btn)}
  let note=$('#gc130BancoFiltroNote');
  if(!note){note=document.createElement('span');note.id='gc130BancoFiltroNote';note.className='gc130-bank-filter-note';note.textContent='Filtro disponível ao Comando';toolbar.appendChild(note)}

  const sel=$('#bhGcmFiltro'),atual=sel?.value||'';
  if(sel){
    const opts=opcoesGcm();
    sel.innerHTML='<option value="">Todos os GCMs</option>'+opts.map(([v,n])=>`<option value="${esc(v)}">${esc(n)}</option>`).join('');
    sel.value=opts.some(([v])=>v===atual)?atual:'';
  }
  const comp=$('#bhCompetenciaFiltro');if(comp&&!comp.dataset.gc130Bound){comp.dataset.gc130Bound='1';comp.addEventListener('change',()=>setTimeout(()=>{lastSig='';render(true)},80))}
  return wrap;
}
function dadosFiltrados(){
  const comp=$('#bhCompetenciaFiltro')?.value||'';
  return banco.filter(x=>String(x?.status||'ATIVO').toUpperCase()==='ATIVO'&&(!comp||competencia(x)===comp)&&corresponde(x));
}
function renderGestaoFiltro(){
  if(!gestor())return;
  const sel=selecionado(),nome=sel.startsWith('id:')?nomePorId(Number(sel.slice(3))):sel.startsWith('nome:')?sel.slice(5):'';
  const box=$('#listaBancoGestao');if(!box)return;
  $$('article.record-card',box).forEach(card=>{
    if(!sel){card.style.display='';return}
    const strong=card.querySelector('.record-card-head strong')?.textContent||'';
    card.style.display=norm(strong).startsWith(norm(nome))?'':'none';
  });
}
function render(force=false){
  if(applying||!bancoVisivel()||!gestor())return;
  ensureFiltro();
  const list=$('#listaBanco');if(!list)return;
  const comp=$('#bhCompetenciaFiltro')?.value||'',sel=selecionado();
  const dados=dadosFiltrados().sort((a,b)=>String(b?.data_fato||b?.created_at||'').localeCompare(String(a?.data_fato||a?.created_at||'')));
  const sig=`${comp}|${sel}|${dados.length}|${dados.map(x=>`${x.id||''}:${x.minutos||0}:${x.status||''}`).slice(0,60).join(',')}`;
  const marker=!!list.querySelector('[data-gc130-bank-list]');
  if(!force&&sig===lastSig&&marker){renderGestaoFiltro();return}
  applying=true;
  try{
    let c50=0,c100=0,deb=0;
    for(const x of dados){const sign=norm(x?.natureza)==='DEBITO'?-1:1,m=sign*Number(x?.minutos||0);if(sign<0)deb+=Number(x?.minutos||0);if(String(x?.classe)==='100')c100+=m;else c50+=m}
    if($('#bh50'))$('#bh50').textContent=horas(c50);
    if($('#bh100'))$('#bh100').textContent=horas(c100);
    if($('#bhDeb'))$('#bhDeb').textContent=horas(deb);
    if($('#bhSaldo'))$('#bhSaldo').textContent=horas(c50+c100);
    const nomeSel=sel.startsWith('id:')?nomePorId(Number(sel.slice(3))):'';
    list.innerHTML=`<div data-gc130-bank-list="1">${dados.slice(0,80).map(x=>{const gid=guardaId(x),nm=nomeMov(x)||nomePorId(gid)||'GCM';return `<div class="item gc130-bank-item"><small>${fmt(x?.data_fato||x?.created_at)} · ${esc(x?.classe||'50')}%${gestor()?' · '+esc(nm):''}</small><strong>${esc(x?.tipo||x?.origem||'Movimentação')}</strong><span>${norm(x?.natureza)==='DEBITO'?'-':'+'}${horas(x?.minutos)}</span></div>`}).join('')||'<div class="empty">Sem movimentações para o filtro selecionado.</div>'}</div>`;
    const note=$('#gc130BancoFiltroNote');if(note)note.textContent=sel?`Exibindo: ${nomeSel||'GCM selecionado'} · ${dados.length} movimentação(ões)`:`Todos os GCMs · ${dados.length} movimentação(ões)`;
    renderGestaoFiltro();
    lastSig=sig;
  }finally{applying=false}
}
async function load(force=false){
  if(loading||(!force&&loaded)){ensureFiltro();render();return}
  loading=true;
  const btn=$('#gc130BancoAtualizar');if(btn){btn.disabled=true;btn.textContent='Atualizando...'}
  try{
    const [s,d,r]=await Promise.all([call('session'),call('data'),call('references')]);
    sessao=s?.session||s||null;
    banco=Array.isArray(d?.banco_horas)?d.banco_horas:[];
    const rr=r?.references||r||{};refs={guardas:Array.isArray(rr?.guardas)?rr.guardas:[]};
    loaded=true;lastSig='';ensureFiltro();render(true);
  }catch(e){
    const note=$('#gc130BancoFiltroNote');if(note)note.textContent=e?.message||'Falha ao carregar o filtro do Banco de Horas.';
    console.warn('[GCMBS V130 Banco]',e);
  }finally{loading=false;if(btn){btn.disabled=false;btn.textContent='↻ Atualizar'}}
}
function tick(){
  if(!bancoVisivel())return;
  if(!loaded)load();else{ensureFiltro();render()}
}
document.addEventListener('click',e=>{
  if(e.target.closest?.('[data-go="banco"],[data-module="banco_horas"]'))[0,100,300,700].forEach(ms=>setTimeout(tick,ms));
},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(tick,150),{once:true});else setTimeout(tick,150);
new MutationObserver(()=>{if(applying)return;clearTimeout(timer);timer=setTimeout(tick,100)}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
setInterval(()=>{if(bancoVisivel())tick()},1200);
console.info('[GCMBS] V130 filtro por GCM no Banco de Horas do Comando ativo');
})();
