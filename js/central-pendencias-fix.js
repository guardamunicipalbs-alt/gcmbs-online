// GCMBS 10.0.62 — ajuste da Central de Pendências.
// A Central deve exibir somente pendências atuais para o usuário.
// Estados encerrados pertencem ao histórico do módulo de origem. Para o Comando,
// troca/assunção de extra em AGUARDANDO_ACEITE ainda pertence ao GCM contraparte
// e só deve chegar à Central depois da autorização expressa.
const TERMINAIS=new Set([
  'APROVADA','RECUSADA','REPROVADA','NEGADA','CANCELADA','CONCLUIDA',
  'EXCLUIDA','EXCLUIDO','ERRO','FALHA'
]);
const PRE_COMANDO=new Set([
  'AGUARDANDO_ACEITE','AGUARDANDO AUTORIZACAO','AGUARDANDO AUTORIZAÇÃO',
  'AGUARDANDO_AUTORIZACAO','AGUARDANDO_AUTORIZAÇÃO'
]);

function normalizarStatus(valor){
  return String(valor||'').trim().toUpperCase();
}
function statusTerminal(valor){
  const s=normalizarStatus(valor);
  return TERMINAIS.has(s)||s.startsWith('ERRO_')||s.startsWith('FALHA_');
}
function usuarioGestor(){
  const role=normalizarStatus(document.getElementById('perfilRole')?.textContent);
  return role==='COMANDANTE'||role==='SUBCOMANDANTE';
}
function tipoCard(card){
  return normalizarStatus(card?.querySelector('small')?.textContent).split('·')[0].trim();
}
function statusCard(card){
  return normalizarStatus(card?.querySelector('.status-pill')?.textContent);
}
function deveOcultar(card){
  if(tipoCard(card)!=='SOLICITAÇÃO')return false;
  const status=statusCard(card);
  if(statusTerminal(status))return true;
  // O Comando não deve receber como "aguardando análise" uma troca/assunção
  // que ainda depende do aceite do GCM originalmente escalado/contraparte.
  if(usuarioGestor()&&PRE_COMANDO.has(status))return true;
  return false;
}

function atualizarLegenda(){
  const solic=document.getElementById('pSolic');
  const card=solic?.closest('.dashboard-card');
  const small=card?.querySelector('small');
  if(small)small.textContent=usuarioGestor()?'Aguardando análise / processamento':'Solicitações em andamento';
}

function corrigirCentralPendencias(){
  const host=document.getElementById('pendenciasLista');
  if(!host)return;

  const cards=[...host.querySelectorAll('.pending-card')];
  for(const card of cards){
    if(deveOcultar(card))card.remove();
  }

  const restantes=[...host.querySelectorAll('.pending-card')];
  let solicitacoes=0;
  let avisos=0;

  for(const card of restantes){
    const tipo=tipoCard(card);
    if(tipo==='SOLICITAÇÃO')solicitacoes++;
    else if(tipo==='AVISO')avisos++;
  }

  const total=document.getElementById('pTotal');
  const solic=document.getElementById('pSolic');
  const av=document.getElementById('pAvisos');
  if(total)total.textContent=String(restantes.length);
  if(solic)solic.textContent=String(solicitacoes);
  if(av)av.textContent=String(avisos);
  atualizarLegenda();

  if(!restantes.length){
    const texto=usuarioGestor()
      ?'Nenhuma solicitação aguardando sua análise e nenhum aviso não lido.'
      :'Nenhuma pendência visível para seu perfil.';
    const vazio=host.querySelector('.empty');
    if(vazio)vazio.textContent=texto;
    else host.innerHTML=`<div class="empty">${texto}</div>`;
  }
}

function instalarCorrecaoCentralPendencias(){
  const host=document.getElementById('pendenciasLista');
  if(!host)return;

  let agendado=false;
  const executar=()=>{
    if(agendado)return;
    agendado=true;
    queueMicrotask(()=>{
      agendado=false;
      corrigirCentralPendencias();
    });
  };

  new MutationObserver(executar).observe(host,{childList:true,subtree:true});
  executar();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',instalarCorrecaoCentralPendencias,{once:true});
}else{
  instalarCorrecaoCentralPendencias();
}
