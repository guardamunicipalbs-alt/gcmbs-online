// Ajuste da Central de Pendencias.
// Registros com falha terminal pertencem ao historico do modulo de origem
// e nao devem ser contabilizados como pendencias atuais.
const TERMINAIS_ERRO=new Set(['ERRO','FALHA']);

function statusTerminalErro(valor){
  const s=String(valor||'').trim().toUpperCase();
  return TERMINAIS_ERRO.has(s)||s.startsWith('ERRO_')||s.startsWith('FALHA_');
}

function corrigirCentralPendencias(){
  const host=document.getElementById('pendenciasLista');
  if(!host)return;

  const cards=[...host.querySelectorAll('.pending-card')];
  for(const card of cards){
    const status=card.querySelector('.status-pill')?.textContent||'';
    if(statusTerminalErro(status))card.remove();
  }

  const restantes=[...host.querySelectorAll('.pending-card')];
  let solicitacoes=0;
  let avisos=0;

  for(const card of restantes){
    const tipo=String(card.querySelector('small')?.textContent||'').trim().toUpperCase();
    if(tipo.startsWith('SOLICITAÇÃO'))solicitacoes++;
    else if(tipo.startsWith('AVISO'))avisos++;
  }

  const total=document.getElementById('pTotal');
  const solic=document.getElementById('pSolic');
  const av=document.getElementById('pAvisos');
  if(total)total.textContent=String(restantes.length);
  if(solic)solic.textContent=String(solicitacoes);
  if(av)av.textContent=String(avisos);

  if(!restantes.length&&!host.querySelector('.empty')){
    host.innerHTML='<div class="empty">Nenhuma pendência visível para seu perfil.</div>';
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
