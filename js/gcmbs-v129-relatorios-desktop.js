/* GCMBS V129 — Relatórios importados diretamente da réplica integral do Desktop.
   Corrige a interpretação do campo motorista: na réplica ele identifica o
   motorista da composição e pode aparecer repetido em todos os registros do
   mesmo posto/turno. Só recebe a etiqueta MOTORISTA o GCM cujo nome/ID coincide
   com o motorista informado pelo Desktop. */
(()=>{
'use strict';
if(window.__GCMBS_V129_RELATORIOS_DESKTOP__)return;
window.__GCMBS_V129_RELATORIOS_DESKTOP__=true;

const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
const br=iso=>{const m=String(iso||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(iso||'')};

let raw=[];
let loading=false;
let rendering=false;

function visivel(){
  const s=$('main>section[data-view="relatorios"]');
  return !!s&&!s.classList.contains('hidden');
}
async function call(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function nome(x){return String(x?.nome_guerra||x?.hist_guarda_nome_guerra||x?.guarda_nome||x?.guarda||'GCM').trim()}
function posto(x){return String(x?.posto_nome||x?.hist_posto_nome||x?.posto||'').trim()}
function extra(x){
  const origem=norm(x?.origem),tipo=norm(x?.tipo_servico);
  return Boolean(origem.includes('EXTRA')||tipo==='EXTRA'||x?.extra===true||Number(x?.extra||0)===1||Number(x?.extra_manual_id??x?.hist_extra_manual_id??x?.extra_id??0)>0);
}
function horario(x){
  const turno=norm(x?.turno);
  const hi=String(x?.horario_inicio??x?.hist_horario_inicio??x?.extra_horario_inicio??x?.hora_inicio??'').slice(0,5);
  const hf=String(x?.horario_fim??x?.hist_horario_fim??x?.extra_horario_fim??x?.hora_fim??'').slice(0,5);
  const txt=String(x?.horario??x?.hist_horario??x?.extra_horario??x?._extraManualHorario??'').trim();
  const m=txt.match(/(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
  if(extra(x)){
    if(m&&m[1]!==m[2])return `${m[1]} às ${m[2]}`;
    if(hi&&hf&&hi!==hf)return `${hi} às ${hf}`;
  }
  if(hi&&hf&&hi!==hf)return `${hi} às ${hf}`;
  if(turno==='B')return '19:00 às 07:00';
  if(turno==='A')return '07:00 às 19:00';
  return hi&&hf?`${hi} às ${hf}`:'07:00 às 19:00';
}
function viatura(x){return String(x?.viatura||x?.hist_viatura_prefixo||x?.viatura_prefixo||'').trim()}
function ehMotorista(x){
  const atual=norm(nome(x));
  const motorNome=norm(x?.motorista_nome_guerra||x?.motorista_nome||x?.motorista||x?.hist_motorista_nome_guerra||'');
  if(motorNome&&!['1','SIM','TRUE','YES','S','MOTORISTA'].includes(motorNome)){
    return motorNome===atual||motorNome===norm(x?.guarda_nome)||motorNome===norm(x?.hist_guarda_nome_guerra);
  }
  const gid=Number(x?.guarda_id||x?.hist_guarda_id||0),mid=Number(x?.motorista_id||x?.hist_motorista_id||0);
  if(gid>0&&mid>0)return gid===mid;
  const flag=x?.eh_motorista??x?.is_motorista??x?.motorista_flag;
  return flag===true||Number(flag||0)===1||['SIM','TRUE','S'].includes(norm(flag));
}
function datasEntre(ini,fim){
  if(!ini||!fim||ini>fim)return [];
  const out=[],d=new Date(`${ini}T12:00:00`),lim=new Date(`${fim}T12:00:00`);let guard=0;
  while(d<=lim&&guard++<400){
    out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
    d.setDate(d.getDate()+1);
  }
  return out;
}
function garantirHorario(){
  const filtros=$('section[data-view="relatorios"] .report-filters');if(!filtros)return;
  if(!$('#relatoriosHorario')){
    const label=document.createElement('label');
    label.innerHTML='Horário<select id="relatoriosHorario"><option value="">Todos os horários</option><option>07:00 às 17:00</option><option>07:00 às 19:00</option><option>19:00 às 07:00</option></select>';
    filtros.insertBefore(label,$('#relatoriosGerar')||null);
  }
}
function preencherFiltros(){
  garantirHorario();
  const g=$('#relatoriosGcm'),p=$('#relatoriosPosto');if(!g||!p)return;
  const vg=g.value,vp=p.value;
  const nomes=[...new Set(raw.map(nome).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
  const postos=[...new Set(raw.map(posto).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR',{sensitivity:'base'}));
  g.innerHTML='<option value="">Todos os GCMs</option>'+nomes.map(x=>`<option>${esc(x)}</option>`).join('');
  p.innerHTML='<option value="">Todos os postos</option>'+postos.map(x=>`<option>${esc(x)}</option>`).join('');
  g.value=nomes.includes(vg)?vg:'';p.value=postos.includes(vp)?vp:'';
}
function filtrados(){
  const ini=$('#relatoriosIni')?.value||'',fim=$('#relatoriosFim')?.value||'';
  const g=norm($('#relatoriosGcm')?.value),p=norm($('#relatoriosPosto')?.value),h=norm($('#relatoriosHorario')?.value);
  return raw.filter(x=>{
    const d=String(x?.data||'').slice(0,10);
    if(ini&&d<ini)return false;if(fim&&d>fim)return false;
    if(g&&norm(nome(x))!==g)return false;
    if(p&&norm(posto(x))!==p)return false;
    if(h&&norm(horario(x))!==h)return false;
    return true;
  });
}
function montar(dados){
  const map=new Map();
  for(const item of dados){
    const po=posto(item);if(!po)continue;
    const ho=horario(item),turno=norm(item?.turno||'A'),prioridade=Number(item?.posto_prioridade??item?.hist_posto_prioridade??9999),key=`${po}\u0000${turno}\u0000${ho}`;
    if(!map.has(key))map.set(key,{posto:po,horario:ho,turno,prioridade,itens:new Map()});
    const g=map.get(key),dia=String(item?.data||'').slice(0,10),arr=g.itens.get(dia)||[],nm=nome(item),ex=arr.find(z=>norm(z.nome)===norm(nm));
    const atual={nome:nm,motorista:ehMotorista(item),viatura:viatura(item),extra:extra(item)};
    if(ex){ex.motorista=ex.motorista||atual.motorista;if(atual.motorista&&!ex.viatura)ex.viatura=atual.viatura;ex.extra=ex.extra||atual.extra}else arr.push(atual);
    g.itens.set(dia,arr);g.prioridade=Math.min(g.prioridade,prioridade);
  }
  return [...map.values()].sort((a,b)=>(a.prioridade-b.prioridade)||a.posto.localeCompare(b.posto,'pt-BR',{sensitivity:'base'})||a.turno.localeCompare(b.turno));
}
function celula(itens){
  if(!itens?.length)return '<td class="vazio">—</td>';
  itens.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR',{sensitivity:'base'}));
  return `<td>${itens.map(x=>`<div class="gcm-linha"><b>${esc(x.nome)}</b>${x.motorista?`<span class="tag-driver">MOTORISTA${x.viatura?' - '+esc(x.viatura):''}</span>`:''}${x.extra?'<span class="tag-extra">Extra</span>':''}</div>`).join('')}</td>`;
}
function render(){
  if(rendering||!visivel())return;
  const host=$('#relatoriosLista');if(!host)return;
  const dados=filtrados(),grupos=montar(dados),ini=$('#relatoriosIni')?.value||'',fim=$('#relatoriosFim')?.value||'';
  const filtroAtivo=!!($('#relatoriosGcm')?.value||$('#relatoriosPosto')?.value||$('#relatoriosHorario')?.value);
  const datas=filtroAtivo?[...new Set(dados.map(x=>String(x?.data||'').slice(0,10)))].sort():datasEntre(ini,fim);
  const status=$('#relatoriosStatus');if(status)status.textContent=`${dados.length} registro(s) · fonte: réplica integral do Desktop 10.0.85 · motoristas conforme Desktop`;
  const linhas=grupos.map(g=>`<tr><th class="posto-linha"><b>${esc(g.posto)}</b><span>${esc(g.horario)}</span></th>${datas.map(d=>celula(g.itens.get(d)||[])).join('')}</tr>`).join('');
  rendering=true;
  host.classList.remove('list','module-record-list');
  host.innerHTML=`<div class="report-summary gc128-summary"><strong>Escala — dados importados do Desktop</strong><span>${dados.length} registro(s)</span></div><p class="muted gc128-help">Motorista, viatura, posto, turno e extras seguem os campos recebidos da réplica integral do Desktop.</p><div class="matrix-wrap"><table class="report-matrix gc128-report-matrix" data-gc129-desktop="1"><thead><tr><th class="col-posto">POSTO / HORÁRIO</th>${datas.map(d=>`<th>${esc(br(d))}</th>`).join('')}</tr></thead><tbody>${linhas||`<tr><td colspan="${Math.max(1,datas.length+1)}">Nenhum registro encontrado para os filtros informados.</td></tr>`}</tbody></table></div>`;
  rendering=false;
}
async function carregar(force=false){
  if(loading)return;
  if(raw.length&&!force){preencherFiltros();render();return;}
  loading=true;const status=$('#relatoriosStatus');if(status)status.textContent='Importando escalas da réplica integral do Desktop...';
  try{
    const b=await call('relatorio_escalas');raw=Array.isArray(b?.escalas)?b.escalas:[];
    const ds=raw.map(x=>String(x?.data||'').slice(0,10)).filter(Boolean).sort();
    if(ds.length){if($('#relatoriosIni')&&!$('#relatoriosIni').value)$('#relatoriosIni').value=ds[0];if($('#relatoriosFim')&&!$('#relatoriosFim').value)$('#relatoriosFim').value=ds[ds.length-1];}
    preencherFiltros();render();
  }catch(e){if(status)status.textContent=e?.message||'Não foi possível importar as escalas do Desktop.';}finally{loading=false}
}
function imprimir(){
  const dados=filtrados();if(!dados.length)return alert('Nenhum registro encontrado para imprimir.');
  const grupos=montar(dados),ini=$('#relatoriosIni')?.value||'',fim=$('#relatoriosFim')?.value||'',filtroAtivo=!!($('#relatoriosGcm')?.value||$('#relatoriosPosto')?.value||$('#relatoriosHorario')?.value);
  const datas=filtroAtivo?[...new Set(dados.map(x=>String(x?.data||'').slice(0,10)))].sort():datasEntre(ini,fim),blocos=[];for(let i=0;i<datas.length;i+=8)blocos.push(datas.slice(i,i+8));
  const w=window.open('','_blank','noopener,noreferrer');if(!w)return alert('Libere pop-ups para imprimir o relatório.');
  const tabela=ds=>`<table><thead><tr><th>POSTO / HORÁRIO</th>${ds.map(d=>`<th>${esc(br(d))}</th>`).join('')}</tr></thead><tbody>${grupos.map(g=>`<tr><th><b>${esc(g.posto)}</b><small>${esc(g.horario)}</small></th>${ds.map(d=>`<td>${(g.itens.get(d)||[]).map(x=>`<div><b>${esc(x.nome)}</b>${x.motorista?`<small>MOTORISTA${x.viatura?' - '+esc(x.viatura):''}</small>`:''}${x.extra?'<small>EXTRA</small>':''}</div>`).join('')||'—'}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  w.document.write(`<!doctype html><meta charset="utf-8"><title>GCMBS - Relatório de Escalas</title><style>@page{size:landscape;margin:8mm}body{font:10px Arial;color:#0b2f57}h1{font-size:16px}table{border-collapse:collapse;width:100%;table-layout:fixed}.bloco{page-break-after:always}.bloco:last-child{page-break-after:auto}th,td{border:1px solid #91a9c3;padding:4px;vertical-align:top}thead th{background:#eef4fa}tbody th{width:145px;text-align:left;background:#f8fbfe}small{display:block;font-size:8px;margin-top:2px}td div{margin-bottom:4px}</style><h1>GCMBS — Relatório Institucional de Escalas</h1><p>Fonte: réplica integral do Desktop · ${dados.length} registro(s)</p>${blocos.map((b,i)=>`<section class="bloco"><p><b>Período ${i+1}/${blocos.length}:</b> ${esc(br(b[0]))} a ${esc(br(b.at(-1)))}</p>${tabela(b)}</section>`).join('')}`);
  w.document.close();w.focus();setTimeout(()=>w.print(),120);
}
function substituirControles(){
  garantirHorario();
  const gerar=$('#relatoriosGerar');if(gerar&&!gerar.dataset.gc129Owned){const b=gerar.cloneNode(true);b.dataset.gc129Owned='1';gerar.replaceWith(b);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();render()});}
  const atualizar=$('#relatoriosAtualizar');if(atualizar&&!atualizar.dataset.gc129Owned){const b=atualizar.cloneNode(true);b.dataset.gc129Owned='1';atualizar.replaceWith(b);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();carregar(true)});}
  const imp=$('#relatoriosImprimir');if(imp){const b=imp.cloneNode(true);b.id='relatoriosImprimirV129';b.dataset.gc129Owned='1';imp.replaceWith(b);b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();imprimir()});}
  for(const id of ['relatoriosIni','relatoriosFim','relatoriosGcm','relatoriosPosto','relatoriosHorario']){const el=$('#'+id);if(el&&!el.dataset.gc129Bound){el.dataset.gc129Bound='1';el.addEventListener('change',render)}}
}
function observarHost(){
  const host=$('#relatoriosLista');if(!host||host.dataset.gc129Observed)return;host.dataset.gc129Observed='1';
  new MutationObserver(()=>{if(rendering||!visivel()||!raw.length)return;if(host.querySelector('article.record-card')||!host.querySelector('[data-gc129-desktop="1"]'))setTimeout(render,25)}).observe(host,{childList:true,subtree:true});
}
function iniciar(){substituirControles();observarHost();if(visivel())carregar(false)}
document.addEventListener('click',e=>{const nav=e.target.closest?.('[data-go="relatorios"],[data-module="relatorios"]');if(nav)[40,120,300,700].forEach(ms=>setTimeout(iniciar,ms))},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
[120,350,800,1600].forEach(ms=>setTimeout(iniciar,ms));
console.info('[GCMBS] V129 Relatórios usando diretamente a réplica do Desktop ativo');
})();