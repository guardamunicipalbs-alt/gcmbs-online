const API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-communication-gateway-v131';
const BANK_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-bank-command-v133';
const TYPES=[
  ['CREDITO_SERVICO_EXTRA','Crédito por Serviço Extra','CREDITO'],
  ['CREDITO_MANUAL_SERVICO_TRABALHADO','Crédito manual por serviço trabalhado','CREDITO'],
  ['CREDITO_INDENIZACAO','Crédito por indenização','CREDITO'],
  ['CREDITO_MERECIMENTO_COMPENSACAO','Crédito por merecimento/compensação','CREDITO'],
  ['DEBITO_PAGAMENTO_FOLHA','Débito por pagamento em folha','DEBITO'],
  ['DEBITO_SAIDA_ANTECIPADA','Débito por saída antecipada','DEBITO'],
  ['DEBITO_FALTA_SERVICO_EXTRA_ESCALADO','Débito por Falta ao Serviço Extra Escalado','DEBITO'],
  ['DEBITO_PENALIZACAO_AJUSTE','Débito por penalização/ajuste','DEBITO'],
  ['TRANSFERENCIA_COMPETENCIA_SEGUINTE','Transferência para competência seguinte','DEBITO']
];
const TYPE_MAP=new Map(TYPES.map(x=>[x[0],x]));
let mounted=false,refs={guardas:[]},feriados=new Set();
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const token=()=>localStorage.getItem('gcmbs.mobile.token')||'';
async function post(url,action,payload={}){
  const t=token();if(!t)throw new Error('Sessão não autenticada.');
  let r;
  try{r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${t}`},body:JSON.stringify({action,...payload}),cache:'no-store'})}
  catch{throw new Error('Falha de comunicação com o servidor. Verifique a conexão e tente novamente.')}
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
function localDate(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Fortaleza',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=t=>parts.find(x=>x.type===t)?.value||'';return `${get('year')}-${get('month')}-${get('day')}`;
}
function competenceOf(date){return /^\d{4}-\d{2}/.test(date)?date.slice(0,7):localDate().slice(0,7)}
function isSunday(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(`${date}T12:00:00-03:00`).getDay()===0}
function classFor(date){return isSunday(date)||feriados.has(date)?'100':'50'}
function activeGuards(){
  const list=Array.isArray(refs.guardas)?refs.guardas:[];
  return list.filter(g=>Number(g.id||g.guarda_id||0)>0&&g.ativo!==false&&Number(g.ativo??1)!==0)
    .sort((a,b)=>String(a.nome_guerra||a.nome_completo||'').localeCompare(String(b.nome_guerra||b.nome_completo||''),'pt-BR'));
}
function updateAutoFields(){
  const tipo=$('bcmdTipo')?.value||'',info=TYPE_MAP.get(tipo),date=$('bcmdData')?.value||'';
  if($('bcmdNatureza'))$('bcmdNatureza').value=info?.[2]||'CREDITO';
  if($('bcmdClasse'))$('bcmdClasse').value=classFor(date);
}
async function loadContext(){
  await post(BANK_API,'health');
  const r=await post(API,'references');refs=r.references||r||{};
  try{
    const h=await post(API,'entity_list',{entity:'feriados',limit:500,offset:0});
    const rows=Array.isArray(h?.records)?h.records:[];
    feriados=new Set(rows.filter(x=>!x.deleted).map(x=>String(x?.data?.data||'').slice(0,10)).filter(Boolean));
  }catch{feriados=new Set()}
}
function renderCard(){
  const marker=$('bancoGestaoCard');if(!marker||$('bancoComandoMovV133'))return false;
  const today=localDate(),comp=$('bhCompetenciaFiltro')?.value||competenceOf(today),guards=activeGuards();
  const card=document.createElement('div');card.id='bancoComandoMovV133';card.className='card';
  card.innerHTML=`
    <div class="toolbar"><div><h2>Movimentação do Comando</h2><p class="muted">Lançamento direto por Comandante/Subcomandante. A nuvem registra imediatamente e o Desktop recebe a réplica quando estiver conectado.</p></div><span class="badge">Nuvem canônica</span></div>
    <form id="formBancoComandoV133" class="form-grid">
      <label>GCM<select id="bcmdGcm" required><option value="">Selecione...</option>${guards.map(g=>`<option value="${Number(g.id||g.guarda_id)}">${esc(g.nome_guerra||g.nome_completo||('GCM #'+(g.id||g.guarda_id)))}</option>`).join('')}</select></label>
      <label>Competência<input id="bcmdComp" type="month" value="${esc(comp)}" required></label>
      <label>Data do fato<input id="bcmdData" type="date" value="${esc(today)}" required></label>
      <label>Tipo<select id="bcmdTipo" required>${TYPES.map(x=>`<option value="${x[0]}">${esc(x[1])}</option>`).join('')}</select></label>
      <label>Natureza<input id="bcmdNatureza" value="CREDITO" readonly></label>
      <label>Classe<input id="bcmdClasse" value="${classFor(today)}" readonly><small>Automática: domingo/feriado = 100%; demais dias = 50%.</small></label>
      <label>Horas<input id="bcmdHoras" type="number" min="0.01" max="2880" step="0.01" required placeholder="Ex.: 12"></label>
      <label>Motivo<input id="bcmdMotivo" maxlength="500" placeholder="Motivo do lançamento"></label>
      <label class="full">Observação<textarea id="bcmdObs" maxlength="2000" placeholder="Observação complementar"></textarea></label>
      <button id="bcmdSalvar" class="primary full" type="submit">Registrar movimentação</button>
      <div id="bcmdMsg" class="full request-message" role="status"></div>
    </form>`;
  marker.parentNode.insertBefore(card,marker);
  $('bcmdTipo').addEventListener('change',updateAutoFields);
  $('bcmdData').addEventListener('change',updateAutoFields);
  $('formBancoComandoV133').addEventListener('submit',submitMovement);
  updateAutoFields();return true;
}
async function submitMovement(e){
  e.preventDefault();
  const btn=$('bcmdSalvar'),msg=$('bcmdMsg');if(!btn||btn.disabled)return;
  const horas=Number($('bcmdHoras').value||0),minutos=Math.round(horas*60);
  const movement={guarda_id:Number($('bcmdGcm').value||0),competencia:$('bcmdComp').value,data_fato:$('bcmdData').value,tipo:$('bcmdTipo').value,natureza:$('bcmdNatureza').value,classe:$('bcmdClasse').value,minutos,motivo:$('bcmdMotivo').value.trim(),observacao:$('bcmdObs').value.trim()};
  if(!movement.guarda_id){msg.textContent='Selecione o GCM.';return}
  if(!movement.competencia||!movement.data_fato){msg.textContent='Informe competência e data do fato.';return}
  if(!Number.isInteger(minutos)||minutos<=0){msg.textContent='Informe uma quantidade de horas válida.';return}
  btn.disabled=true;btn.textContent='Registrando...';msg.textContent='';
  try{
    const r=await post(BANK_API,'create',{movement,client_change_id:`bank-command-v133:${crypto.randomUUID()}`,device_id:'bank-command-v133-online'});
    msg.textContent=`✓ ${r.message||'Movimentação registrada.'} Classe aplicada: ${r.movement?.classe||movement.classe}%.`;
    $('bcmdHoras').value='';$('bcmdMotivo').value='';$('bcmdObs').value='';
    setTimeout(()=>{try{$('syncAgoraOnline')?.click()}catch{}},250);
  }catch(err){msg.textContent=String(err?.message||err||'Falha ao registrar movimentação.')}
  finally{btn.disabled=false;btn.textContent='Registrar movimentação'}
}
async function tryMount(){
  if(mounted||!token())return;
  try{await loadContext();if(renderCard())mounted=true}catch{}
}
function boot(){
  tryMount();
  const app=$('appTela');if(app)new MutationObserver(()=>tryMount()).observe(app,{attributes:true,attributeFilter:['class']});
  setInterval(()=>{if(!mounted)tryMount()},4000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
