// GCMBS 10.0.62 — estabilização de carga Online.
// 1) Impede o observer auto-recursivo de Permutas.
// 2) Evita salto desnecessário por Edge Functions intermediárias quando a API v6
//    já possui exatamente a mesma rota, autenticação e CORS.
// Não altera regras de negócio, dados ou Gerador de Escala.

const GCMBS_EDGE_BASE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const GCMBS_API_CORS=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6-cors';
const GCMBS_API_V6=GCMBS_EDGE_BASE+'gcmbs-mobile-api-v6';
const GCMBS_QUADRO_V62=GCMBS_EDGE_BASE+'gcmbs-quadro-v62';
const GCMBS_ACOES_EXCLUSIVAS_CORS=new Set([
  'entity_catalog',
  'entity_list',
  'entity_mutate',
  'frequency_services'
]);

function gcmbsBloquearObserverRecursivoPermutas(){
  const host=document.getElementById('listaPermutasSolicitadas');
  if(!host)return false;
  // v62-sync-ui só instala o MutationObserver quando este marcador não existe.
  if(!host.dataset.v62obs)host.dataset.v62obs='loop-guard';
  return true;
}

if(!gcmbsBloquearObserverRecursivoPermutas() && document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',gcmbsBloquearObserverRecursivoPermutas,{once:true});
}

// Roteamento de baixa pressão: as chamadas que o wrapper apenas encaminharia
// seguem diretamente para a API v6. Rotas com contrato/proteção próprios continuam
// obrigatoriamente no gcmbs-mobile-api-v6-cors.
if(!window.__gcmbsLowPressureFetch){
  window.__gcmbsLowPressureFetch=true;
  const nativeFetch=window.fetch.bind(window);

  window.fetch=async function(input,init){
    const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
    let destino=url;
    let action='';

    try{
      if(typeof init?.body==='string') action=String(JSON.parse(init.body||'{}')?.action||'').toLowerCase();
    }catch{}

    if(url===GCMBS_API_CORS && action && !GCMBS_ACOES_EXCLUSIVAS_CORS.has(action)){
      destino=GCMBS_API_V6;
    }else if(url===GCMBS_QUADRO_V62 && action==='quadro_operacional'){
      destino=GCMBS_API_V6;
    }

    return nativeFetch(destino,init);
  };
}

console.info('[GCMBS] proteção anti-loop e roteamento de baixa pressão ativos');
