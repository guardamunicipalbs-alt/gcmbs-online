// GCMBS 10.0.68 — HF10 R24.1
// Roteia SOMENTE operações de escrita da Folha para a Edge Function dedicada.
// Leitura, cálculo e renderização permanecem nas rotas canônicas existentes.
const HF10_R24_1='20260831hf10r24_1';
const WRITE_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-folha-write-v68';

if(!window.__gcmbsFolhaWriteV68){
  window.__gcmbsFolhaWriteV68=true;
  const anterior=window.fetch.bind(window);

  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:String(input?.url||'');
    const bodyTxt=typeof init?.body==='string'?init.body:'';
    let body=null;
    try{body=bodyTxt?JSON.parse(bodyTxt):null;}catch{}
    const action=String(body?.action||'').toLowerCase();

    const antigaFolha=url.includes('/gcmbs-folha-v62') && ['save_config','save_adjustments'].includes(action);
    const antigaCompetencia=url.includes('/gcmbs-folha-competencia-v62') && ['close','reopen'].includes(action);

    if(!(antigaFolha||antigaCompetencia))return anterior(input,init);

    const payload=body&&typeof body==='object'?{...body}:{};
    if(action==='save_config')payload.config={...(payload.config||{}),max_horas:84};

    return anterior(WRITE_API,{
      ...init,
      method:'POST',
      body:JSON.stringify(payload),
      cache:'no-store'
    });
  };
}

console.info('[GCMBS] HF10 R24.1 escrita protegida da Folha ativa',HF10_R24_1);
