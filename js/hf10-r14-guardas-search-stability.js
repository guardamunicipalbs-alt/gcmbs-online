// GCMBS 10.0.67 - HF10 R14
// Pesquisa estável do Cadastro de Guardas após renovação forçada de cache.
// Não altera banco, payloads, permissões nem regras do Desktop.
const HF10_R14='20260825hf10r14';
let hf10r14Frame=0;
function hf10r14GuardasAtivo(){
  const botao=document.querySelector('#mainNav [data-module="cadastro_guardas"].active');
  const view=document.querySelector('[data-view="online"]');
  const titulo=String(document.getElementById('onlineTitulo')?.textContent||'');
  return !!botao&&!!view&&!view.classList.contains('hidden')&&/cadastro de guardas/i.test(titulo);
}
function hf10r14NormalizarTexto(v){const s=String(v??'');try{return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}catch{return s.toLowerCase()}}
function hf10r14Digitos(v){return String(v??'').replace(/\D/g,'');}
function hf10r14Combina(card,consulta){
  const q=hf10r14NormalizarTexto(consulta).trim();if(!q)return true;
  if(hf10r14NormalizarTexto(card.textContent||'').includes(q))return true;
  const qd=hf10r14Digitos(consulta);if(qd.length<3)return false;
  for(const span of card.querySelectorAll('.online-kv span'))if(hf10r14Digitos(span.textContent||'').includes(qd))return true;
  return false;
}
function hf10r14Vazio(host,mostrar){let vazio=host.querySelector('[data-hf10-r14-empty]');if(!vazio){vazio=document.createElement('div');vazio.className='empty';vazio.dataset.hf10R14Empty='1';vazio.textContent='Nenhum GCM encontrado para esta pesquisa.';vazio.hidden=true;host.appendChild(vazio);}vazio.hidden=!mostrar;}
function hf10r14AplicarFiltro(){
  hf10r14Frame=0;if(!hf10r14GuardasAtivo())return;
  const input=document.getElementById('onlineFiltro'),host=document.getElementById('onlineRegistros');if(!input||!host)return;
  const cards=[...host.querySelectorAll('[data-online-key]')];if(!cards.length)return;
  const consulta=input.value||'';let visiveis=0;
  for(const card of cards){const ok=hf10r14Combina(card,consulta);card.style.display=ok?'':'none';if(ok)visiveis++;}
  hf10r14Vazio(host,!!consulta.trim()&&visiveis===0);
  const filtrados=document.getElementById('onlineFiltrados');if(filtrados)filtrados.textContent=consulta.trim()?`${visiveis} encontrado(s)`:'Todos os registros';
  const versao=document.getElementById('onlineVersao');if(versao)versao.textContent='Online/App 10.0.75';
}
function hf10r14Agendar(){if(!hf10r14Frame)hf10r14Frame=requestAnimationFrame(hf10r14AplicarFiltro);}
document.addEventListener('input',ev=>{if(ev.target?.id!=='onlineFiltro'||!hf10r14GuardasAtivo())return;ev.stopImmediatePropagation();hf10r14Agendar();},true);
function hf10r14ObservarLista(){const host=document.getElementById('onlineRegistros');if(!host||host.dataset.hf10R14Observed)return;host.dataset.hf10R14Observed='1';new MutationObserver(()=>{if(hf10r14GuardasAtivo())hf10r14Agendar();}).observe(host,{childList:true});}
function hf10r14Inicializar(){hf10r14ObservarLista();hf10r14Agendar();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hf10r14Inicializar,{once:true});else hf10r14Inicializar();
document.addEventListener('click',ev=>{if(ev.target.closest?.('#mainNav [data-module="cadastro_guardas"]')){setTimeout(hf10r14Inicializar,0);setTimeout(hf10r14Agendar,700);setTimeout(hf10r14Agendar,1800);}},true);
window.addEventListener('pageshow',()=>setTimeout(hf10r14Inicializar,0));
console.info('[GCMBS] HF10 R14 pesquisa estável de Guardas carregada',HF10_R14);
