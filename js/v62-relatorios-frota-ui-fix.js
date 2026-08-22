// GCMBS 10.0.62 — paridade funcional de Relatórios da Frota com o Desktop.
// Somente leitura: não cria, altera ou exclui registros.

const RF_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-mobile-api-v6-cors';
const RF_BLOQUEADOS=new Set([
  'MANUTENCAO','MANUTENÇÃO','EM MANUTENCAO','EM MANUTENÇÃO',
  'INDISPONIVEL','INDISPONÍVEL','BAIXADA','INATIVA','FORA DE SERVICO','FORA DE SERVIÇO'
]);
let rfState={viaturas:[],manutencoes:[],abastecimentos:[],refs:{viaturas:[],guardas:[]},errors:{}};
let rfLoading=null;
let rfObserver=null;

const rfEsc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rfNorm=v=>String(v??'').trim().toUpperCase();
const rfIso=v=>String(v||'').slice(0,10);
const rfBr=v=>{const s=rfIso(v);if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return String(v||'');const [a,m,d]=s.split('-');return `${d}/${m}/${a}`;};
const rfHoje=()=>new Date().toLocaleDateString('en-CA',{timeZone:'America/Fortaleza'});
const rfInicioMes=()=>rfHoje().slice(0,8)+'01';

async function rfCall(action,payload={}){
  const token=localStorage.getItem('gcmbs.mobile.token');
  if(!token)throw new Error('Sessão online não autenticada.');
  const r=await fetch(RF_API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...payload}),cache:'no-store'});
  let b={};try{b=await r.json()}catch{}
  if(!r.ok)throw new Error(b.message||`Erro ${r.status}`);
  return b;
}
async function rfEntity(entity){
  try{const b=await rfCall('entity_list',{entity,limit:5000,offset:0});return {rows:(b.records||[]).map(r=>r.data||{}),error:null};}
  catch(e){return {rows:[],error:e?.message||String(e)};}
}

function rfViatura(id){
  const n=Number(id);
  return rfState.viaturas.find(v=>Number(v.id)===n)||rfState.refs.viaturas.find(v=>Number(v.id)===n)||null;
}
function rfGuarda(id){
  const n=Number(id),g=rfState.refs.guardas.find(x=>Number(x.id)===n||Number(x.guarda_id)===n);
  return g?.nome_guerra||g?.nome_completo||'';
}
function rfManutencaoAberta(vid){
  return rfState.manutencoes.some(m=>Number(m.viatura_id)===Number(vid)&&Number(m.consertado||0)!==1&&['ATIVA','ABERTA','EM ANDAMENTO','EM MANUTENCAO','EM MANUTENÇÃO'].includes(rfNorm(m.status||'ABERTA')));
}
function rfStatusViatura(v){
  if(rfManutencaoAberta(v.id))return 'MANUTENÇÃO';
  const s=rfNorm(v.situacao_operacional||v.status||v.situacao||'ATIVA');
  if(['MANUTENCAO','EM MANUTENCAO'].includes(s))return 'MANUTENÇÃO';
  if(s==='INDISPONIVEL')return 'INDISPONÍVEL';
  if(s==='FORA DE SERVICO')return 'FORA DE SERVIÇO';
  return s||'ATIVA';
}
function rfStatusManutencao(m){
  if(Number(m.consertado||0)===1)return 'CONCLUIDA';
  const s=rfNorm(m.status||'ABERTA');
  if(['CONCLUIDA','CONCLUÍDA','FINALIZADA'].includes(s))return 'CONCLUIDA';
  if(s==='EM ANDAMENTO')return 'EM ANDAMENTO';
  return 'ABERTA';
}
function rfPeriodoOk(row,campo){
  const d=rfIso(row?.[campo]),ini=document.getElementById('gcmbsRfIni')?.value||'',fim=document.getElementById('gcmbsRfFim')?.value||'';
  if(!d)return !ini&&!fim;
  return (!ini||d>=ini)&&(!fim||d<=fim);
}
function rfTabela(titulo,cols,linhas){
  const t=document.getElementById('gcmbsRfTituloResultado'),h=document.getElementById('gcmbsRfHead'),b=document.getElementById('gcmbsRfBody'),s=document.getElementById('gcmbsRfResumo');
  if(t)t.textContent=titulo;
  if(h)h.innerHTML='<tr>'+cols.map(c=>`<th>${rfEsc(c)}</th>`).join('')+'</tr>';
  if(b)b.innerHTML=linhas.length?linhas.map(l=>'<tr>'+l.map(v=>`<td>${rfEsc(v==null?'':v)}</td>`).join('')+'</tr>').join(''):`<tr><td colspan="${Math.max(1,cols.length)}" class="empty">Nenhum registro encontrado para os filtros informados.</td></tr>`;
  if(s)s.textContent=`${linhas.length} registro(s) encontrado(s).`;
}
function rfAtualizarFiltros(){
  const tipo=document.getElementById('gcmbsRfTipo')?.value||'viaturas',datas=tipo!=='viaturas',status=tipo!=='abastecimentos';
  document.getElementById('gcmbsRfIniLabel')?.classList.toggle('hidden',!datas);
  document.getElementById('gcmbsRfFimLabel')?.classList.toggle('hidden',!datas);
  document.getElementById('gcmbsRfStatusLabel')?.classList.toggle('hidden',!status);
  const sel=document.getElementById('gcmbsRfStatus');if(!sel)return;
  const atual=sel.value;
  const opts=tipo==='viaturas'?['','ATIVA','DISPONÍVEL','EM USO','INDISPONIVEL','MANUTENÇÃO','BAIXADA']:tipo==='manutencoes'?['','ABERTA','EM ANDAMENTO','CONCLUIDA']:[''];
  sel.innerHTML=opts.map(x=>`<option value="${rfEsc(x)}">${rfEsc(x||'Todos')}</option>`).join('');
  if(opts.includes(atual))sel.value=atual;
}
function rfGerar(){
  const tipo=document.getElementById('gcmbsRfTipo')?.value||'viaturas',status=rfNorm(document.getElementById('gcmbsRfStatus')?.value||'');
  if(tipo==='viaturas'){
    if(rfState.errors.viaturas)return rfTabela('Relatório de Viaturas Cadastradas',['Situação'],[[rfState.errors.viaturas]]);
    let dados=rfState.viaturas.slice().sort((a,b)=>Number(a.ordem_operacional||9999)-Number(b.ordem_operacional||9999)||String(a.prefixo||'').localeCompare(String(b.prefixo||''),'pt-BR'));
    if(status)dados=dados.filter(v=>rfNorm(rfStatusViatura(v))===status||rfNorm(v.status)===status||rfNorm(v.situacao)===status);
    rfTabela('Relatório de Viaturas Cadastradas',['Prefixo','Placa','Marca / Modelo','Tipo','Ano','Status','Ordem'],dados.map(v=>[
      v.prefixo||'',v.placa||'',[v.marca,v.modelo].filter(Boolean).join(' / '),v.tipo||'',v.ano_modelo||v.ano_fabricacao||'',rfStatusViatura(v),v.ordem_operacional||''
    ]));
    return;
  }
  if(tipo==='manutencoes'){
    if(rfState.errors.manutencoes)return rfTabela('Relatório de Manutenções da Frota',['Situação'],[[rfState.errors.manutencoes]]);
    let dados=rfState.manutencoes.filter(x=>rfPeriodoOk(x,'data_manutencao')).sort((a,b)=>rfIso(b.data_manutencao).localeCompare(rfIso(a.data_manutencao))||Number(b.id||0)-Number(a.id||0));
    if(status)dados=dados.filter(x=>{const st=rfStatusManutencao(x);return st===status||(status==='EM ANDAMENTO'&&st==='ABERTA');});
    rfTabela('Relatório de Manutenções da Frota',['Data','Viatura','Descrição','Km','Atendente','Encaminhado por','Situação','Retorno','Recebido por'],dados.map(m=>{
      const v=rfViatura(m.viatura_id);return [rfBr(m.data_manutencao),v?.prefixo||'',m.descricao||'',m.quilometragem||'',m.atendente_oficina||'',m.encaminhado_por_nome||rfGuarda(m.encaminhado_por),Number(m.consertado||0)===1?'CONCLUÍDA':'EM ANDAMENTO',rfBr(m.data_retorno),m.recebido_por_nome||rfGuarda(m.recebido_por)];
    }));
    return;
  }
  if(rfState.errors.abastecimentos)return rfTabela('Relatório de Abastecimentos da Frota',['Situação'],[[rfState.errors.abastecimentos]]);
  const dados=rfState.abastecimentos.filter(x=>rfPeriodoOk(x,'data_abastecimento')).sort((a,b)=>rfIso(b.data_abastecimento).localeCompare(rfIso(a.data_abastecimento))||Number(b.id||0)-Number(a.id||0));
  rfTabela('Relatório de Abastecimentos da Frota',['Data','Viatura','Placa','Motorista','Litros','Quilometragem','Observação'],dados.map(a=>{const v=rfViatura(a.viatura_id);return [rfBr(a.data_abastecimento),v?.prefixo||'',v?.placa||'',a.motorista||rfGuarda(a.motorista_id),a.litros??'',a.quilometragem??'',a.observacao||''];}));
}

function rfAjustarAtalhos(){
  const host=document.getElementById('frotaRelatorioAtalhos');if(!host)return;
  host.closest('.card')?.setAttribute('id','gcmbsRfAtalhosCard');
  host.querySelector('[data-frota-open="checklist_viaturas"]')?.remove();
}
function rfAtualizarCards(){
  const total=document.getElementById('rfTotal'),ativas=document.getElementById('rfAtivas');
  if(total)total.textContent=String(rfState.viaturas.length);
  const n=rfState.viaturas.filter(v=>!RF_BLOQUEADOS.has(rfNorm(rfStatusViatura(v)))).length;
  if(ativas)ativas.textContent=String(n);
  const card=ativas?.closest('.dashboard-card');
  if(card){const span=card.querySelector('span'),small=card.querySelector('small');if(span)span.textContent='Ativas operacionais';if(small)small.textContent='Ativas fora de manutenção/baixa';}
}
function rfEnsureUi(){
  const view=document.querySelector('[data-view="relatoriosFrota"]');if(!view)return null;
  rfAjustarAtalhos();
  if(document.getElementById('gcmbsRfRelatorioDesktop'))return view;
  const card=document.createElement('section');card.id='gcmbsRfRelatorioDesktop';card.className='card';
  card.innerHTML=`
    <div class="toolbar"><div><h2>Relatório da frota</h2><small class="muted">Mesmos três relatórios funcionais do Desktop, usando somente dados sincronizados.</small></div><button id="gcmbsRfImprimir" class="secondary" type="button">Imprimir / PDF</button></div>
    <div class="report-filters" style="margin-top:12px">
      <label>Relatório<select id="gcmbsRfTipo"><option value="viaturas">Viaturas cadastradas</option><option value="manutencoes">Manutenções</option><option value="abastecimentos">Abastecimentos</option></select></label>
      <label id="gcmbsRfIniLabel" class="hidden">Data inicial<input id="gcmbsRfIni" type="date" value="${rfInicioMes()}"></label>
      <label id="gcmbsRfFimLabel" class="hidden">Data final<input id="gcmbsRfFim" type="date" value="${rfHoje()}"></label>
      <label id="gcmbsRfStatusLabel">Status<select id="gcmbsRfStatus"></select></label>
      <button id="gcmbsRfGerar" class="primary" type="button">Gerar relatório</button><button id="gcmbsRfLimpar" class="secondary" type="button">Limpar filtros</button>
    </div>
    <div class="report-summary" style="margin-top:14px"><strong id="gcmbsRfResumo">Carregando dados da frota...</strong></div>
    <h2 id="gcmbsRfTituloResultado" style="margin-top:16px">Relatório de Viaturas Cadastradas</h2>
    <div class="matrix-wrap"><table class="report-matrix" id="gcmbsRfTabela"><thead id="gcmbsRfHead"></thead><tbody id="gcmbsRfBody"><tr><td>Carregando...</td></tr></tbody></table></div>`;
  const atalhos=document.getElementById('gcmbsRfAtalhosCard');if(atalhos)view.insertBefore(card,atalhos);else view.appendChild(card);
  document.getElementById('gcmbsRfTipo')?.addEventListener('change',()=>{rfAtualizarFiltros();rfGerar();});
  document.getElementById('gcmbsRfGerar')?.addEventListener('click',rfGerar);
  document.getElementById('gcmbsRfLimpar')?.addEventListener('click',()=>{const t=document.getElementById('gcmbsRfTipo');if(t)t.value='viaturas';const i=document.getElementById('gcmbsRfIni'),f=document.getElementById('gcmbsRfFim'),s=document.getElementById('gcmbsRfStatus');if(i)i.value=rfInicioMes();if(f)f.value=rfHoje();rfAtualizarFiltros();if(s)s.value='';rfGerar();});
  document.getElementById('gcmbsRfImprimir')?.addEventListener('click',()=>window.print());
  rfAtualizarFiltros();
  if(!document.getElementById('gcmbsRfPrintStyle')){const st=document.createElement('style');st.id='gcmbsRfPrintStyle';st.textContent='@media print{body *{visibility:hidden!important}[data-view="relatoriosFrota"],[data-view="relatoriosFrota"] *{visibility:visible!important}[data-view="relatoriosFrota"]{display:block!important;position:absolute!important;left:0;top:0;width:100%;background:#fff}header,#mainNav,#navBackdrop,#gcmbsRfAtalhosCard,#gcmbsRfImprimir,#gcmbsRfGerar,#gcmbsRfLimpar{display:none!important}.matrix-wrap{overflow:visible!important}.report-matrix{min-width:0!important;font-size:10px}}';document.head.appendChild(st);}
  return view;
}

async function rfCarregar(){
  if(rfLoading)return rfLoading;
  rfLoading=(async()=>{
    const view=rfEnsureUi();if(!view)return;
    const resumo=document.getElementById('gcmbsRfResumo');if(resumo)resumo.textContent='Atualizando dados da frota...';
    const [refs,viaturas,manutencoes,abastecimentos]=await Promise.all([
      rfCall('references').catch(()=>({viaturas:[],guardas:[]})),rfEntity('viaturas'),rfEntity('manutencao_viaturas'),rfEntity('abastecimento_viaturas')
    ]);
    rfState={viaturas:viaturas.rows,manutencoes:manutencoes.rows,abastecimentos:abastecimentos.rows,refs,errors:{viaturas:viaturas.error,manutencoes:manutencoes.error,abastecimentos:abastecimentos.error}};
    rfAtualizarCards();rfAjustarAtalhos();rfGerar();
  })().finally(()=>{rfLoading=null;});
  return rfLoading;
}
function rfTelaAtiva(){const v=document.querySelector('[data-view="relatoriosFrota"]');return !!v&&!v.classList.contains('hidden');}
function rfAtivar(){rfEnsureUi();setTimeout(()=>{rfAjustarAtalhos();rfCarregar();},0);}
function rfSetup(){
  rfEnsureUi();
  document.addEventListener('click',e=>{if(e.target?.closest?.('[data-module="relatorios_frota"]'))setTimeout(rfAtivar,0);},true);
  const v=document.querySelector('[data-view="relatoriosFrota"]');if(v){rfObserver=new MutationObserver(()=>{if(rfTelaAtiva())rfAtivar();});rfObserver.observe(v,{attributes:true,attributeFilter:['class']});}
  const h=document.getElementById('frotaRelatorioAtalhos');if(h)new MutationObserver(rfAjustarAtalhos).observe(h,{childList:true});
  if(rfTelaAtiva())rfAtivar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',rfSetup,{once:true});else rfSetup();
