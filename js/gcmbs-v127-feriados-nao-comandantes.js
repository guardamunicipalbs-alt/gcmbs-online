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

/* GCMBS V128 — Relatórios de Escalas em matriz por posto/horário.
   Corrige a apresentação do módulo Relatórios sem alterar a réplica, a API
   ou as regras de escala. A origem dos dados continua sendo o Desktop.
*/
(()=>{
'use strict';
if(window.__GCMBS_V128_RELATORIOS_MATRIZ__)return;
window.__GCMBS_V128_RELATORIOS_MATRIZ__=true;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();

let ultimoConjunto=[];
let renderizando=false;
let observerTimer=0;

function relatoriosVisivel(){
  const sec=$('main>section[data-view="relatorios"]');
  return !!sec && !sec.classList.contains('hidden');
}
function isoDeBr(data){
  const m=String(data||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m?`${m[3]}-${m[2]}-${m[1]}`:'';
}
function brDeIso(data){
  const m=String(data||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}/${m[2]}/${m[1]}`:String(data||'');
}
function datasEntre(ini,fim){
  if(!ini||!fim||ini>fim)return [];
  const out=[],d=new Date(`${ini}T12:00:00`);
  const limite=new Date(`${fim}T12:00:00`);
  let guarda=0;
  while(d<=limite && guarda<400){
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    out.push(`${y}-${m}-${day}`);
    d.setDate(d.getDate()+1);guarda++;
  }
  return out;
}
function extrairCartoes(){
  const host=$('#relatoriosLista');
  if(!host)return [];
  const cards=$$('article.record-card',host);
  if(!cards.length)return [];
  return cards.map((card,ordem)=>{
    const nome=card.querySelector('.record-card-head strong')?.textContent?.trim()||'GCM';
    const data=isoDeBr(card.querySelector('.record-card-head span')?.textContent?.trim()||'');
    const meta=card.querySelector('.record-meta')?.textContent?.replace(/\s+/g,' ').trim()||'';
    const separador=meta.indexOf(' · ');
    const posto=(separador>=0?meta.slice(0,separador):meta).trim()||'Posto não informado';
    const horario=(separador>=0?meta.slice(separador+3):'').trim()||'Horário não informado';
    const motorista=!!card.querySelector('.tag-driver');
    const extra=!!card.querySelector('.tag-extra');
    const detalhe=$$('div',card).at(-1)?.textContent?.replace(/\s+/g,' ').trim()||'';
    const mv=detalhe.match(/Viatura:\s*(.*?)(?:\s+Extra\s*$|$)/i);
    const viatura=mv?.[1]?.trim()||'';
    return {nome,data,posto,horario,motorista,extra,viatura,ordem};
  }).filter(x=>x.data);
}
function horarioSelecionado(){
  return $('#relatoriosHorario')?.value||'';
}
function dadosAtuais(){
  const h=horarioSelecionado();
  return h?ultimoConjunto.filter(x=>norm(x.horario)===norm(h)):ultimoConjunto.slice();
}
function montarGrupos(dados){
  const mapa=new Map();
  for(const x of dados){
    const chave=`${x.posto}\u0000${x.horario}`;
    if(!mapa.has(chave))mapa.set(chave,{posto:x.posto,horario:x.horario,itens:new Map(),ordem:x.ordem});
    const g=mapa.get(chave);
    if(!g.itens.has(x.data))g.itens.set(x.data,[]);
    g.itens.get(x.data).push(x);
  }
  return [...mapa.values()].sort((a,b)=>a.ordem-b.ordem);
}
function datasDaMatriz(dados){
  const ini=$('#relatoriosIni')?.value||'',fim=$('#relatoriosFim')?.value||'';
  const filtrado=!!($('#relatoriosGcm')?.value||$('#relatoriosPosto')?.value||horarioSelecionado());
  if(!filtrado && ini && fim)return datasEntre(ini,fim);
  return [...new Set(dados.map(x=>x.data))].sort();
}
function celula(itens){
  if(!itens?.length)return '<td class="vazio">—</td>';
  itens.sort((a,b)=>norm(a.nome).localeCompare(norm(b.nome),'pt-BR'));
  return `<td>${itens.map(x=>`<div class="gcm-linha"><b>${esc(x.nome)}</b>${x.motorista?`<span class="tag-driver">MOTORISTA${x.viatura?' - '+esc(x.viatura):''}</span>`:''}${!x.motorista&&x.viatura?`<span class="gc128-viatura">Viatura: ${esc(x.viatura)}</span>`:''}${x.extra?'<span class="tag-extra">Extra</span>':''}</div>`).join('')}</td>`;
}
function garantirControles(){
  const filtros=$('section[data-view="relatorios"] .report-filters');
  if(!filtros)return;
  if(!$('#relatoriosHorario')){
    const label=document.createElement('label');
    label.id='gc128HorarioWrap';
    label.innerHTML='Horário<select id="relatoriosHorario"><option value="">Todos os horários</option><option>07:00 às 17:00</option><option>07:00 às 19:00</option><option>19:00 às 07:00</option></select>';
    const gerar=$('#relatoriosGerar');
    filtros.insertBefore(label,gerar||null);
    label.querySelector('select').addEventListener('change',()=>renderMatriz());
  }
  if(!$('#relatoriosLimpar')){
    const b=document.createElement('button');
    b.id='relatoriosLimpar';b.type='button';b.className='secondary';b.textContent='Limpar filtros';
    b.addEventListener('click',()=>{
      for(const id of ['relatoriosGcm','relatoriosPosto','relatoriosHorario']){const el=$('#'+id);if(el)el.value='';}
      const datas=ultimoConjunto.map(x=>x.data).sort();
      if(datas.length){if($('#relatoriosIni'))$('#relatoriosIni').value=datas[0];if($('#relatoriosFim'))$('#relatoriosFim').value=datas[datas.length-1];}
      $('#relatoriosGerar')?.click();
    });
    filtros.appendChild(b);
  }
}
function renderMatriz(){
  if(renderizando)return;
  const host=$('#relatoriosLista');
  if(!host||!relatoriosVisivel())return;
  const dados=dadosAtuais(),datas=datasDaMatriz(dados),grupos=montarGrupos(dados);
  const status=$('#relatoriosStatus');
  if(status)status.textContent=`${dados.length} registro(s) institucional(is) · visão por posto e horário · fonte: réplica integral do Desktop 10.0.85`;

  const corpo=grupos.map(g=>`<tr><th class="posto-linha"><b>${esc(g.posto)}</b><span>${esc(g.horario)}</span></th>${datas.map(d=>celula(g.itens.get(d)||[])).join('')}</tr>`).join('');
  renderizando=true;
  host.classList.remove('list','module-record-list');
  host.innerHTML=`<div class="report-summary gc128-summary"><strong>Escala — visão por posto e horário</strong><span>${dados.length} registro(s)</span></div><p class="muted gc128-help">As datas ficam na horizontal. Em telas menores, deslize a tabela lateralmente.</p><div class="matrix-wrap"><table class="report-matrix gc128-report-matrix"><thead><tr><th class="col-posto">POSTO / HORÁRIO</th>${datas.map(d=>`<th>${esc(brDeIso(d))}</th>`).join('')}</tr></thead><tbody>${corpo||`<tr><td colspan="${Math.max(1,datas.length+1)}">Nenhum registro encontrado para os filtros informados.</td></tr>`}</tbody></table></div>`;
  renderizando=false;
}
function capturarERenderizar(){
  garantirControles();
  const host=$('#relatoriosLista');
  const cards=extrairCartoes();
  if(cards.length){
    ultimoConjunto=cards;
    renderMatriz();
    return;
  }
  if(host?.querySelector('.empty')){
    ultimoConjunto=[];
    renderMatriz();
    return;
  }
  if(host && relatoriosVisivel() && ultimoConjunto.length && !host.querySelector('.gc128-report-matrix')){
    renderMatriz();
  }
}
function tabelaImpressao(grupos,datas){
  const cab=`<tr><th>POSTO / HORÁRIO</th>${datas.map(d=>`<th>${esc(brDeIso(d))}</th>`).join('')}</tr>`;
  const linhas=grupos.map(g=>`<tr><th><b>${esc(g.posto)}</b><small>${esc(g.horario)}</small></th>${datas.map(d=>{
    const itens=g.itens.get(d)||[];
    return `<td>${itens.map(x=>`<div><b>${esc(x.nome)}</b>${x.motorista?`<small>MOTORISTA${x.viatura?' - '+esc(x.viatura):''}</small>`:''}${!x.motorista&&x.viatura?`<small>Viatura: ${esc(x.viatura)}</small>`:''}${x.extra?'<small>EXTRA</small>':''}</div>`).join('')||'—'}</td>`;
  }).join('')}</tr>`).join('');
  return `<table><thead>${cab}</thead><tbody>${linhas}</tbody></table>`;
}
function imprimirMatriz(){
  const dados=dadosAtuais(),datas=datasDaMatriz(dados),grupos=montarGrupos(dados);
  if(!dados.length){alert('Nenhum registro encontrado para imprimir.');return;}
  const blocos=[];for(let i=0;i<datas.length;i+=8)blocos.push(datas.slice(i,i+8));
  const w=window.open('','_blank','noopener,noreferrer');
  if(!w){alert('Libere pop-ups para imprimir o relatório.');return;}
  const filtros=[
    $('#relatoriosGcm')?.value&&`GCM: ${$('#relatoriosGcm').value}`,
    $('#relatoriosPosto')?.value&&`Posto: ${$('#relatoriosPosto').value}`,
    horarioSelecionado()&&`Horário: ${horarioSelecionado()}`
  ].filter(Boolean).join(' · ')||'Todos os GCMs, postos e horários';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>GCMBS - Relatório de Escalas</title><style>
  @page{size:landscape;margin:8mm}*{box-sizing:border-box}body{font:10px Arial,sans-serif;color:#0b2f57;margin:0}h1{font-size:16px;margin:0 0 3px}p{margin:2px 0 7px}.bloco{page-break-after:always}.bloco:last-child{page-break-after:auto}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #91a9c3;padding:4px;vertical-align:top}thead th{background:#eef4fa;text-align:center}tbody th{width:145px;text-align:left;background:#f8fbfe}tbody th small,td small{display:block;font-size:8px;font-weight:normal;margin-top:2px}td div{margin-bottom:4px}td div:last-child{margin-bottom:0}td b{display:block;font-size:9px}
  </style></head><body><h1>GCMBS — Relatório Institucional de Escalas</h1><p>${esc(brDeIso(datas[0]))} a ${esc(brDeIso(datas.at(-1)))} · ${esc(filtros)} · ${dados.length} registro(s)</p>${blocos.map((b,i)=>`<section class="bloco"><p><b>Período ${i+1}/${blocos.length}:</b> ${esc(brDeIso(b[0]))} a ${esc(brDeIso(b.at(-1)))}</p>${tabelaImpressao(grupos,b)}</section>`).join('')}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),120);
}

document.addEventListener('click',e=>{
  if(e.target.closest?.('#relatoriosImprimir')){
    e.preventDefault();e.stopImmediatePropagation();imprimirMatriz();return;
  }
  const nav=e.target.closest?.('[data-go="relatorios"],[data-module="relatorios"]');
  if(nav)[0,80,220,500,900].forEach(ms=>setTimeout(capturarERenderizar,ms));
},true);

const hostObserver=new MutationObserver(()=>{
  if(renderizando)return;
  clearTimeout(observerTimer);
  observerTimer=setTimeout(capturarERenderizar,35);
});
function iniciar(){
  garantirControles();
  const host=$('#relatoriosLista');
  if(host)hostObserver.observe(host,{childList:true,subtree:true});
  capturarERenderizar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});
else iniciar();
[100,300,700,1500].forEach(ms=>setTimeout(iniciar,ms));

console.info('[GCMBS] V128 Relatórios em matriz por posto/horário ativo');
})();