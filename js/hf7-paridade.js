// GCMBS 10.0.68 - HF10 R16.2
// Compatibilidade residual do antigo HF7.
// Quadro Operacional: NAO redirecionar mais para gcmbs-quadro-hf7.
// A rota canonica 10.0.68 (gcmbs-quadro-v62) mantém A/B ordinário nos contadores
// e inclui extras manuais/eventos apenas nos detalhes do turno correspondente.
// Folha: preserva teto fixo de 84h e a Edge Function HF7-R3 já consolidada.

const HF7_EDGE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const HF7_FOLHA=HF7_EDGE+'gcmbs-folha-hf7-r3';

function hf7RemoverCardExtrasEvento(){
  // O card separado era regra temporária do HF7. Desde a 10.0.68, extras devem
  // aparecer dentro dos detalhes de Serviço A/B, sem alterar os contadores.
  document.getElementById('hf7ExtrasEventoCard')?.remove();
}

function hf7AjustarFolhaVisual(){
  const max=document.getElementById('folhaMaxHoras');
  if(max){
    max.value='84';max.disabled=true;max.setAttribute('readonly','');max.title='Limite institucional fixo de 84 horas';
    const label=max.closest('label');
    if(label){const no=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&String(n.nodeValue||'').trim());if(no&&!String(no.nodeValue).includes('(fixo)'))no.nodeValue='Limite máximo de horas (fixo)';}
  }
  document.querySelectorAll('#folhaV62Root .folha-list > div').forEach(el=>{
    const t=String(el.textContent||'').trim();
    if(/^OBS\.\s*[67]\b/i.test(t)||/Excedente do limite de 84h transferido/i.test(t)||/Ajustes decimais 50%/i.test(t)){el.remove();return;}
    if(/^Faltas justificadas:/i.test(t)){
      el.innerHTML=el.innerHTML.replace(/\s*\((\d{2}\/\d{2}\/\d{4}\s+a\s+\d{2}\/\d{2}\/\d{4})\)/g,' — $1');
    }
  });
}

// Mantém somente a interceptação consolidada da Folha.
// IMPORTANTE: quadro_operacional segue para a URL originalmente chamada pelo app.
if(!window.__gcmbsHF7Fetch){
  window.__gcmbsHF7Fetch=true;
  const anterior=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
    const bodyTxt=typeof init?.body==='string'?init.body:'';
    let body=null;try{body=bodyTxt?JSON.parse(bodyTxt):null}catch{}
    const action=String(body?.action||'').toLowerCase();
    let destino=url,novaInit=init;

    if(url.includes('/gcmbs-folha-v62')&&url!==HF7_FOLHA){
      destino=HF7_FOLHA;
      if(action==='save_config'){
        body={...(body||{}),config:{...(body?.config||{}),max_horas:84}};
        novaInit={...init,body:JSON.stringify(body)};
      }
    }

    return await anterior(destino,novaInit);
  };
}

function hf7Aplicar(){hf7RemoverCardExtrasEvento();hf7AjustarFolhaVisual();}
let hf7Pendente=false;
const hf7Obs=new MutationObserver(()=>{if(hf7Pendente)return;hf7Pendente=true;requestAnimationFrame(()=>{hf7Pendente=false;hf7Aplicar();});});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{hf7Aplicar();hf7Obs.observe(document.body,{childList:true,subtree:true});},{once:true});
else{hf7Aplicar();hf7Obs.observe(document.body,{childList:true,subtree:true});}
window.addEventListener('gcmbs:push-received',()=>setTimeout(hf7Aplicar,0));

console.info('[GCMBS] HF10 R16.2 paridade do Quadro ativa: extras em A/B, sem card separado.');
