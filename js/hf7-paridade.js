// GCMBS 10.0.62 HF7 — paridade Desktop ↔ Online/App.
// Quadro: Extra por Evento exclusivo, logo após Serviço B, sem dupla contagem A/B.
// Folha: teto fixo 84h, prioridade 100%, FJ nos dias ordinários justificados e observação por período.

const HF7_EDGE='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/';
const HF7_QUADRO=HF7_EDGE+'gcmbs-quadro-hf7';
const HF7_FOLHA=HF7_EDGE+'gcmbs-folha-hf7-r3';
let hf7UltimoQuadro=null;
const hf7Esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hf7DataBr=v=>{const m=String(v||'').slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:String(v||'');};

function hf7AbrirExtrasEvento(){
  const itens=hf7UltimoQuadro?.efetivo?.detalhes?.extrasEvento||[];
  const titulo=document.getElementById('quadroModalTitulo'),meta=document.getElementById('quadroModalMeta'),lista=document.getElementById('quadroModalLista'),modal=document.getElementById('quadroModal');
  if(!titulo||!meta||!lista||!modal)return;
  titulo.textContent='Extra por Evento';
  const data=hf7UltimoQuadro?.data||document.getElementById('quadroData')?.value||'';
  meta.textContent=`Data de referência: ${hf7DataBr(data)} · ${itens.length} trecho(s) extra(s)`;
  lista.innerHTML=itens.length?itens.map(x=>`<div class="item"><strong>${hf7Esc(x.nome||'-')}</strong><span>${hf7Esc(x.complemento||'')}</span></div>`).join(''):'<div class="empty">Nenhum GCM possui trecho realmente extra gerado por evento nesta data.</div>';
  modal.classList.remove('hidden');
}

function hf7GarantirCardExtrasEvento(){
  const b=document.getElementById('qServicoB')?.closest?.('.dashboard-card');
  if(!b)return null;
  let card=document.getElementById('hf7ExtrasEventoCard');
  if(!card){
    card=document.createElement('button');
    card.id='hf7ExtrasEventoCard';
    card.className='dashboard-card';
    card.type='button';
    card.dataset.quadroDetail='efetivo.extrasEvento';
    card.dataset.title='Extra por Evento';
    card.innerHTML='<span>Extra por Evento</span><b id="qExtrasEvento">0</b><small>Somente trecho livre gerado pelo evento</small>';
    card.addEventListener('click',e=>{e.stopImmediatePropagation();hf7AbrirExtrasEvento();});
  }
  if(b.nextElementSibling!==card)b.insertAdjacentElement('afterend',card);
  return card;
}

function hf7AtualizarQuadro(data){
  if(!data?.efetivo)return;
  hf7UltimoQuadro=data;
  hf7GarantirCardExtrasEvento();
  const el=document.getElementById('qExtrasEvento');
  if(el)el.textContent=String(Number(data.efetivo.extrasEvento||0));
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

if(!window.__gcmbsHF7Fetch){
  window.__gcmbsHF7Fetch=true;
  const anterior=window.fetch.bind(window);
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:(input instanceof Request?input.url:String(input));
    const bodyTxt=typeof init?.body==='string'?init.body:'';
    let body=null;try{body=bodyTxt?JSON.parse(bodyTxt):null}catch{}
    const action=String(body?.action||'').toLowerCase();
    let destino=url,novaInit=init;

    if(action==='quadro_operacional'&&url!==HF7_QUADRO&&(url.includes('/gcmbs-mobile-api-v6')||url.includes('/gcmbs-quadro-v62'))){
      destino=HF7_QUADRO;
    }else if(url.includes('/gcmbs-folha-v62')&&url!==HF7_FOLHA){
      destino=HF7_FOLHA;
      if(action==='save_config'){
        body={...(body||{}),config:{...(body?.config||{}),max_horas:84}};
        novaInit={...init,body:JSON.stringify(body)};
      }
    }

    const r=await anterior(destino,novaInit);
    if(action==='quadro_operacional')r.clone().json().then(hf7AtualizarQuadro).catch(()=>{});
    return r;
  };
}

function hf7Aplicar(){hf7GarantirCardExtrasEvento();hf7AjustarFolhaVisual();}
let hf7Pendente=false;
const hf7Obs=new MutationObserver(()=>{if(hf7Pendente)return;hf7Pendente=true;requestAnimationFrame(()=>{hf7Pendente=false;hf7Aplicar();});});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{hf7Aplicar();hf7Obs.observe(document.body,{childList:true,subtree:true});},{once:true});
else{hf7Aplicar();hf7Obs.observe(document.body,{childList:true,subtree:true});}
window.addEventListener('gcmbs:push-received',()=>setTimeout(hf7Aplicar,0));
