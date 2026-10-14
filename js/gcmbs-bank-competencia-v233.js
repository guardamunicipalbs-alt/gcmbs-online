/* GCMBS V295 — competência financeira autoritativa do Banco de Horas.
 * Regra:
 *   - competencia_pagamento e a referencia principal quando estiver preenchida;
 *   - competencia persistida e o fallback seguinte;
 *   - somente na ausencia de ambas a competencia e inferida pela data do fato (20 -> 19);
 *   - data_fato preserva a origem historica e NAO exclui um credito retroativo valido;
 *   - registros EXCLUIDOS/ESTORNADOS continuam fora dos totais;
 *   - lancamento futuro nunca e antecipado para outra competencia.
 * Somente leitura no Online: nao cria movimentos nem altera saldos persistidos.
 */
const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v74';
const $=id=>document.getElementById(id);
const hojeFortaleza=()=>{const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const valor=k=>p.find(x=>x.type===k)?.value||'';return `${valor('year')}-${valor('month')}-${valor('day')}`};
const horas=min=>{const n=Math.abs(min);return `${min<0?'-':''}${Math.floor(n/60)}h${String(n%60).padStart(2,'0')}`};
const dataISO=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||'').slice(0,10))?String(v).slice(0,10):'';
const competenciaISO=v=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v||'').slice(0,7))?String(v).slice(0,7):'';
export function competenciaDaData(v){
  const d=dataISO(v);if(!d)throw new Error('Data do fato invalida.');
  const [a,m,dd]=d.split('-').map(Number);
  if(dd<20)return `${a}-${String(m).padStart(2,'0')}`;
  const prox=m===12?[a+1,1]:[a,m+1];return `${prox[0]}-${String(prox[1]).padStart(2,'0')}`;
}
export function competenciaFinanceiraRegistro(r){
  const pagamento=competenciaISO(r?.competencia_pagamento);
  if(pagamento)return pagamento;
  const persistida=competenciaISO(r?.competencia);
  if(persistida)return persistida;
  const d=dataISO(r?.data_fato);
  return d?competenciaDaData(d):'';
}
export function classificacaoFinanceira(r,competencia){
  const comp=competenciaFinanceiraRegistro(r);
  if(!comp)return {incluir:false,motivo:'SEM_COMPETENCIA'};
  if(comp!==competencia)return {incluir:false,motivo:comp>competencia?'COMPETENCIA_FUTURA':'OUTRA_COMPETENCIA',competencia:comp};
  return {incluir:true,motivo:'COMPETENCIA_PAGAMENTO',competencia:comp};
}
export function calcularCompetenciaIntegral(lancamentos,competencia,guardaId=0,hoje=hojeFortaleza()){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(competencia)))throw new Error('Competencia invalida.');
  if(!Array.isArray(lancamentos))throw new Error('Historico indisponivel.');
  const ids=new Map();let credito50=0,credito100=0,debito=0,previstos=0,horasPrevistas=0,quantidade=0,outrasCompetencias=0,futuros=0,retroativos=0;
  for(const r of lancamentos){
    if(guardaId&&Number(r.guarda_id)!==guardaId)continue;
    if(String(r.status||'ATIVO').toUpperCase()!=='ATIVO'||r.deleted===true)continue;
    const cls=classificacaoFinanceira(r,competencia);
    if(!cls.incluir){if(cls.motivo==='OUTRA_COMPETENCIA')outrasCompetencias++;if(cls.motivo==='COMPETENCIA_FUTURA')futuros++;continue}
    const min=Number(r.minutos),classe=String(r.classe||''),natureza=String(r.natureza||'CREDITO').toUpperCase();
    if(!Number.isSafeInteger(min)||min<0||!['50','100'].includes(classe)||!['CREDITO','DEBITO'].includes(natureza))throw new Error('Movimentacao ativa invalida: conferencia necessaria.');
    const id=Number(r.desktop_id||r.id||0);
    if(Number.isSafeInteger(id)&&id>0){const chave=`${Number(r.guarda_id)}:${id}`,assinatura=`${competencia}:${natureza}:${classe}:${min}`;if(ids.has(chave)){if(ids.get(chave)!==assinatura)throw new Error('IDs repetidos com valores divergentes: auditoria necessaria.');continue}ids.set(chave,assinatura)}
    if(natureza==='DEBITO')debito+=min;else if(classe==='100')credito100+=min;else credito50+=min;
    quantidade++;const d=dataISO(r.data_fato);if(d&&d>hoje){previstos++;if(natureza==='CREDITO')horasPrevistas+=min}
    const origem=competenciaISO(r.competencia_origem)||String(d||'').slice(0,7);if(origem&&origem<competencia)retroativos++;
  }
  return {credito50,credito100,debito,saldo:credito50+credito100-debito,quantidade,previstos,horasPrevistas,outrasCompetencias,futuros,retroativos};
}
let ultimo=null,assinatura='',pedido=0,carregando=false,observando=false;
function visivel(){const s=document.querySelector('section[data-view="banco"]');return !!s&&!s.classList.contains('hidden')}
function escopo(){const comp=$('bhCompetenciaFiltro')?.value||'';const principal=$('bhGcmFiltro');const alternativo=$('bhGcmFiltroV136');const selecionado=principal?principal.value:(alternativo?.value||'');const guarda=String(selecionado).startsWith('id:')?Number(String(selecionado).slice(3)):Number(selecionado)||0;return {comp,guarda,token:localStorage.getItem('gcmbs.mobile.token')||''}}
const assinaturaEscopo=e=>`${e.comp}|${e.guarda}|${e.token}`;
function nota(){const el=$('bhSaldo')?.closest('.card');if(!el)return null;let p=$('gcmbsCompetenciaIntegralV233');if(!p){p=document.createElement('p');p.id='gcmbsCompetenciaIntegralV233';p.className='notice';p.style.marginTop='10px';el.appendChild(p)}return p}
function render(){if(!ultimo||!visivel())return;const e=escopo();if(assinaturaEscopo(e)!==assinatura)return;let r;try{r=calcularCompetenciaIntegral(ultimo,e.comp,e.guarda)}catch(err){const p=nota();if(p)p.textContent=`Conferencia indisponivel: ${err.message}`;return}for(const [id,min] of [['bh50',r.credito50],['bh100',r.credito100],['bhDeb',r.debito],['bhSaldo',r.saldo]]){const el=$(id),texto=horas(min);if(el&&el.textContent!==texto)el.textContent=texto}const p=nota();if(p){const extras=[];if(r.retroativos)extras.push(`${r.retroativos} movimento(s) retroativo(s) contabilizado(s) pela competencia de pagamento`);if(r.futuros)extras.push(`${r.futuros} movimento(s) de competencia futura nao antecipado(s)`);p.textContent=`Competencia ${e.comp}: ${r.quantidade} movimentacoes ATIVAS contabilizadas pela competencia de pagamento.${extras.length?' '+extras.join('; ')+'.':''} Data do fato mantida apenas como origem historica. Saldo informativo.`}}
async function atualizar(){if(!visivel())return;const e=escopo();if(!e.token||!/^\d{4}-\d{2}$/.test(e.comp))return;const sig=assinaturaEscopo(e);if(carregando)return;carregando=true;const seq=++pedido;try{const resp=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${e.token}`},body:JSON.stringify({action:'data'}),cache:'no-store'});if(!resp.ok)throw new Error('Dados nao disponiveis.');const body=await resp.json();if(!Array.isArray(body.banco_horas))throw new Error('Historico incompleto.');if(seq!==pedido||sig!==assinaturaEscopo(escopo()))return;calcularCompetenciaIntegral(body.banco_horas,e.comp,e.guarda);ultimo=body.banco_horas;assinatura=sig;render()}catch(err){if(seq===pedido){const p=nota();if(p)p.textContent='Nao foi possivel conferir a competencia na nuvem. Os valores existentes foram preservados.'}}finally{carregando=false;if(seq!==pedido&&visivel())setTimeout(atualizar,0)}}
function iniciar(){if(!$('bhCompetenciaFiltro'))return;document.addEventListener('change',ev=>{if(['bhCompetenciaFiltro','bhGcmFiltro','bhGcmFiltroV136'].includes(ev.target?.id)){pedido++;ultimo=null;const p=nota();if(p)p.textContent='Conferindo a competencia selecionada...';setTimeout(atualizar,120)}},true);document.addEventListener('click',ev=>{if(ev.target?.closest?.('[data-go="banco"],[data-module="banco_horas"]'))setTimeout(atualizar,350)},true);window.addEventListener('gcmbs:v110-refresh',()=>{pedido++;setTimeout(atualizar,350)});if(!observando){const grid=$('bhSaldo')?.closest('.grid');if(grid){observando=true;new MutationObserver(()=>{if(ultimo&&visivel())render()}).observe(grid,{childList:true,subtree:true,characterData:true})}}setInterval(()=>{if(visivel())atualizar()},60000);if(visivel())setTimeout(atualizar,250)}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar()}
