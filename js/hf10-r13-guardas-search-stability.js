// GCMBS 10.0.67 - HF10 R13
// Estabiliza a pesquisa do Cadastro de Guardas no Online/PWA/App.
// Evita reconstruir toda a lista a cada tecla e permite pesquisar CPF com ou sem pontuação.
// Não altera banco, payloads, permissões nem regras do Desktop.
const HF10_R13='20260825hf10r13';
let hf10r13Frame=0;

function hf10r13GuardasAtivo(){
  const botao=document.querySelector('#mainNav [data-module="cadastro_guardas"].active');
  const view=document.querySelector('[data-view="online"]');
  const titulo=String(document.getElementById('onlineTitulo')?.textContent||'');
  return !!botao && !!view && !view.classList.contains('hidden') && /cadastro de guardas/i.test(titulo);
}
function hf10r13NormalizarTexto(v){
  let s=String(v??'');
  try{s=s.normalize('NFD')}catch{}
  return s.replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function hf10r13Digitos(v){return String(v??'').replace(/\D/g,'');}
function hf10r13Combina(card,consulta){
  const q=hf10r13NormalizarTexto(consulta).trim();
  if(!q)return true;
  if(hf10r13NormalizarTexto(card.textContent||'').includes(q))return true;
  const qd=hf10r13Digitos(consulta);
  if(qd.length<3)return false;
  for(const span of card.querySelectorAll('.online-kv span')){
    if(hf10r13Digitos(span.textContent||'').includes(qd))return true;
  }
  return false;
}
function hf10r13Vazio(host,mostrar){
  let vazio=host.querySelector('[data-hf10-r13-empty]');
  if(!vazio){
    vazio=document.createElement('div');
    vazio.className='empty';
    vazio.dataset.hf10R13Empty='1';
    vazio.textContent='Nenhum GCM encontrado para esta pesquisa.';
    vazio.hidden=true;
    host.appendChild(vazio);
  }
  vazio.hidden=!mostrar;
}
function hf10r13AplicarFiltro(){
  hf10r13Frame=0;
  if(!hf10r13GuardasAtivo())return;
  const input=document.getElementById('onlineFiltro');
  const host=document.getElementById('onlineRegistros');
  if(!input||!host)return;
  const cards=[...host.querySelectorAll('[data-online-key]')];
  if(!cards.length)return;
  const consulta=input.value||'';
  let visiveis=0;
  for(const card of cards){
    const ok=hf10r13Combina(card,consulta);
    card.style.display=ok?'':'none';
    if(ok)visiveis++;
  }
  hf10r13Vazio(host,!!consulta.trim()&&visiveis===0);
  const filtrados=document.getElementById('onlineFiltrados');
  if(filtrados)filtrados.textContent=consulta.trim()?`${visiveis} encontrado(s)`:'Todos os registros';
  const versao=document.getElementById('onlineVersao');
  if(versao)versao.textContent='Online/App 10.0.71';
}
function hf10r13Agendar(){
  if(hf10r13Frame)return;
  hf10r13Frame=requestAnimationFrame(hf10r13AplicarFiltro);
}

// Intercepta apenas a pesquisa de Guardas antes do listener legado, que reconstruía
// centenas de nós do DOM em cada tecla e podia deixar Chrome/WebView sem resposta.
document.addEventListener('input',ev=>{
  if(ev.target?.id!=='onlineFiltro'||!hf10r13GuardasAtivo())return;
  ev.stopImmediatePropagation();
  hf10r13Agendar();
},true);

function hf10r13ObservarLista(){
  const host=document.getElementById('onlineRegistros');
  if(!host||host.dataset.hf10R13Observed)return;
  host.dataset.hf10R13Observed='1';
  new MutationObserver(()=>{if(hf10r13GuardasAtivo())hf10r13Agendar();}).observe(host,{childList:true});
}
function hf10r13Inicializar(){
  hf10r13ObservarLista();
  const versao=document.getElementById('onlineVersao');
  if(versao&&/10\.0\.(?:62|67|68)/.test(versao.textContent||''))versao.textContent='Online/App 10.0.71';
  hf10r13Agendar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hf10r13Inicializar,{once:true});else hf10r13Inicializar();
document.addEventListener('click',ev=>{
  if(ev.target.closest?.('#mainNav [data-module="cadastro_guardas"]')){
    setTimeout(hf10r13Inicializar,0);
    setTimeout(hf10r13Agendar,700);
    setTimeout(hf10r13Agendar,1800);
  }
},true);
window.addEventListener('pageshow',()=>setTimeout(hf10r13Inicializar,0));
console.info('[GCMBS] HF10 R13 estabilidade da pesquisa de Guardas carregada',HF10_R13);
