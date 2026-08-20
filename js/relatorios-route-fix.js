// Corrige a separacao visual entre Relatorios e Gerenciar Escalas.
// A base/filtros continuam compartilhados; no modulo Relatorios a tela e somente consulta.
function relatoriosAtivo(){
  const nav=document.querySelector('#mainNav [data-module="relatorios"].active');
  const view=document.querySelector('[data-view="escala"]');
  return !!nav && !!view && !view.classList.contains('hidden');
}

function aplicarRelatoriosSomenteConsulta(){
  if(!relatoriosAtivo())return;

  const titulo=document.getElementById('escalaTitulo');
  const subtitulo=document.getElementById('escalaSubtitulo');
  const aviso=document.getElementById('escalaComandoAviso');

  if(titulo && titulo.textContent!=='Relatório de Escala')titulo.textContent='Relatório de Escala';
  if(subtitulo && subtitulo.textContent!=='Consulta institucional da escala por posto e horário, sem alterações administrativas.'){
    subtitulo.textContent='Consulta institucional da escala por posto e horário, sem alterações administrativas.';
  }
  if(aviso && !aviso.classList.contains('hidden'))aviso.classList.add('hidden');

  document.querySelectorAll('[data-scale-edit]').forEach(btn=>{
    if(!btn.hidden)btn.hidden=true;
    btn.setAttribute('aria-hidden','true');
    btn.tabIndex=-1;
  });
}

let agendado=false;
function agendarCorrecao(){
  if(agendado)return;
  agendado=true;
  requestAnimationFrame(()=>{
    agendado=false;
    aplicarRelatoriosSomenteConsulta();
  });
}

function iniciar(){
  aplicarRelatoriosSomenteConsulta();
  const alvo=document.getElementById('appTela')||document.body;
  new MutationObserver(agendarCorrecao).observe(alvo,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('#mainNav [data-module="relatorios"]'))setTimeout(aplicarRelatoriosSomenteConsulta,0);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});
else iniciar();
