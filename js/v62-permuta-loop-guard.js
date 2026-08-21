// GCMBS 10.0.62 — proteção contra loop de renderização em Permutas.
// v62-sync-ui.js instala um MutationObserver em #listaPermutasSolicitadas e a própria
// renderização altera esse mesmo elemento. O observer acabava disparando uma nova carga
// da API após cada render, gerando um ciclo contínuo de requisições.
//
// Marcamos o host antes da inicialização do v62-sync-ui para impedir somente a instalação
// desse observer auto-recursivo. A atualização normal continua ocorrendo ao abrir a tela,
// trocar a competência e após ações explícitas do usuário.

function gcmbsBloquearObserverRecursivoPermutas(){
  const host=document.getElementById('listaPermutasSolicitadas');
  if(!host)return false;
  if(!host.dataset.v62obs)host.dataset.v62obs='loop-guard';
  return true;
}

if(!gcmbsBloquearObserverRecursivoPermutas() && document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',gcmbsBloquearObserverRecursivoPermutas,{once:true});
}

console.info('[GCMBS] proteção anti-loop de Permutas ativa');
