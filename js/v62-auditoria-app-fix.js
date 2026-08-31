import './hf8-utf8.js?v=20260823hf8r3';
import './hf7-paridade.js?v=20260831hf10r16r2';

// HF10 R10 — proteção contra carregamento infinito Online/App.
// Não altera banco, payloads, regras funcionais ou o Gerador de Escala.
const HF10_R10='20260824hf10r10';
const API_TIMEOUT_MS=20000;
const UI_TIMEOUT_MS=24000;
const SUPABASE_FUNCTIONS=/^https:\/\/cxtayxzvilqrfczjlufk\.supabase\.co\/functions\/v1\//i;

// 1) Toda chamada às Edge Functions passa a ter limite de tempo.
// Evita Promise pendente indefinidamente no WebView Android e no navegador.
if(!window.__gcmbsHf10R10Fetch){
  const nativeFetch=window.fetch.bind(window);
  window.__gcmbsHf10R10Fetch=true;
  window.fetch=async function(input,init={}){
    const url=typeof input==='string'?input:String(input?.url||'');
    if(!SUPABASE_FUNCTIONS.test(url)||init?.signal)return nativeFetch(input,init);
    const ctl=new AbortController();
    const timer=setTimeout(()=>ctl.abort(),API_TIMEOUT_MS);
    try{
      return await nativeFetch(input,{...init,signal:ctl.signal});
    }catch(err){
      if(err?.name==='AbortError'){
        throw new Error('Tempo limite ao carregar dados do GCMBS Online. Verifique a conexão e tente novamente.');
      }
      throw err;
    }finally{
      clearTimeout(timer);
    }
  };
}

// Correções de apresentação constatadas na auditoria do app 10.0.62.
const BOOL_LABELS=new Set([
  'autorizado viatura','autorizado motocicleta','disponível para escala','disponivel para escala',
  'pode noite','pode 24h','ativo','ativa','participa do gerador','consertado'
]);
const TECH_LABEL=/^(id|uuid|hash|sha|sha-?256|payload|token|token sha-?256|origem id|referência id|referencia id|entidade id|usuário id|usuario id|escala id|extra id)$/i;
const norm=s=>String(s||'').trim().toLowerCase().replace(/\s+/g,' ');
const boolText=v=>{
  const s=norm(v);
  if(['1','true','sim','yes'].includes(s))return 'Sim';
  if(['0','false','não','nao','no'].includes(s))return 'Não';
  return null;
};
function corrigirPares(root=document){
  root.querySelectorAll?.('.online-kv').forEach(row=>{
    const label=row.querySelector('b');
    if(!label)return;
    const nome=norm(label.textContent);
    if(TECH_LABEL.test(nome)){row.style.display='none';return;}
    if(!BOOL_LABELS.has(nome))return;
    const valor=label.nextElementSibling;
    if(!valor)return;
    const txt=boolText(valor.textContent);
    if(txt!==null)valor.textContent=txt;
  });
}
function corrigirCampos(root=document){
  root.querySelectorAll?.('label').forEach(label=>{
    const texto=norm([...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ')||label.firstChild?.textContent);
    if(TECH_LABEL.test(texto)){label.style.display='none';return;}
    if(!BOOL_LABELS.has(texto))return;
    const select=label.querySelector('select');
    if(select){
      [...select.options].forEach(o=>{
        if(['1','true'].includes(norm(o.value))||['1','true'].includes(norm(o.textContent)))o.textContent='Sim';
        if(['0','false'].includes(norm(o.value))||['0','false'].includes(norm(o.textContent)))o.textContent='Não';
      });
    }
  });
}

// 2) Estado de carregamento/erro uniforme para os menus.
const GENERIC_MODULES=new Set([
  'cadastro_guardas','equipes','postos','tipos_escalas','escala_extra_manual','feriados',
  'justificativas_faltas','eventos_extra','folha_pagamento','viaturas','manutencao_viaturas',
  'abastecimento_viaturas','cautelas','cursos','operacoes_especiais','frequencia','controle_acesso','imagens_gcm'
]);
const DEDICATED_HOST={
  dashboard:'qAviso',checklist_viaturas:'chkLista',ocorrencias:'occLista'
};
let lastModule='';
const loadingHtml='<div class="empty" data-hf10-loading="1">Carregando módulo...</div>';
function isOnlineVisible(){
  const s=document.querySelector('[data-view="online"]');
  return !!s&&!s.classList.contains('hidden');
}
function retryButtonHtml(){
  return '<button type="button" class="mini" data-hf10-retry="1" style="margin-top:10px">Tentar novamente</button>';
}
function showLoadError(host,message){
  if(!host)return;
  const msg=String(message||'Não foi possível carregar este módulo.').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  host.innerHTML=`<div class="notice" data-hf10-load-error="1"><strong>Falha ao carregar</strong><br>${msg}<br>${retryButtonHtml()}</div>`;
  delete host.dataset.hf10LoadingSince;
}
function retryCurrent(){
  const mod=lastModule||document.querySelector('#mainNav [data-module].active')?.dataset.module||'';
  const btn=mod?document.querySelector(`#mainNav [data-module="${CSS.escape(mod)}"]`):null;
  if(btn){btn.click();return;}
  if(isOnlineVisible())location.reload();
}
document.addEventListener('click',ev=>{
  const retry=ev.target.closest?.('[data-hf10-retry]');
  if(retry){ev.preventDefault();retryCurrent();return;}
  const b=ev.target.closest?.('#mainNav [data-module]');
  if(!b)return;
  lastModule=b.dataset.module||'';
  if(GENERIC_MODULES.has(lastModule)){
    const host=document.getElementById('onlineEntidades');
    if(host){host.innerHTML=loadingHtml;host.dataset.hf10LoadingSince=String(Date.now());}
  }else if(DEDICATED_HOST[lastModule]){
    const host=document.getElementById(DEDICATED_HOST[lastModule]);
    if(host){host.innerHTML='Carregando módulo...';host.dataset.hf10LoadingSince=String(Date.now());}
  }
},true);

function findLoadingHosts(){
  return [...document.querySelectorAll('#onlineEntidades,#onlineRegistros,#qAviso,#chkLista,#occLista,#pendenciasLista,#listaModulos')]
    .filter(el=>/carregando(?:\s+m[oó]dulo|\s+quadro|\.{3})?/i.test(String(el.textContent||'')));
}
function armWatchdog(){
  const now=Date.now();
  for(const host of findLoadingHosts()){
    const since=Number(host.dataset.hf10LoadingSince||0)||now;
    if(!host.dataset.hf10LoadingSince)host.dataset.hf10LoadingSince=String(since);
    if(now-since>=UI_TIMEOUT_MS){
      showLoadError(host,'O servidor não respondeu no tempo esperado. Verifique a conexão e toque em “Tentar novamente”.');
    }
  }
  // remove relógio de elementos que já terminaram de carregar
  document.querySelectorAll('[data-hf10-loading-since]').forEach(host=>{
    if(!/carregando/i.test(String(host.textContent||'')))delete host.dataset.hf10LoadingSince;
  });
}
setInterval(armWatchdog,1500);

// 3) Rejeições que antes ficavam apenas no console passam a ficar visíveis.
window.addEventListener('unhandledrejection',ev=>{
  const msg=ev.reason?.message||String(ev.reason||'Erro de comunicação com o servidor.');
  if(isOnlineVisible()){
    const host=findLoadingHosts()[0]||document.getElementById('onlineEntidades')||document.getElementById('onlineRegistros');
    if(host)showLoadError(host,msg);
  }else{
    for(const host of findLoadingHosts())showLoadError(host,msg);
  }
});
window.addEventListener('offline',()=>{
  for(const host of findLoadingHosts())showLoadError(host,'Sem conexão com a internet. Reconecte e tente novamente.');
});

function aplicar(){
  corrigirPares(document);corrigirCampos(document);
  window.hf8CorrigirMojibake&&document.body&&window.hf8CorrigirMojibake(document.body.textContent);
  armWatchdog();
}
let pendente=false;
const obs=new MutationObserver(()=>{
  if(pendente)return;pendente=true;
  requestAnimationFrame(()=>{pendente=false;aplicar();});
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{aplicar();obs.observe(document.body,{childList:true,subtree:true});},{once:true});
else{aplicar();obs.observe(document.body,{childList:true,subtree:true});}

console.info('[GCMBS] HF10 R10 carregamento de menus ativo',HF10_R10);
