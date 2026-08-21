// GCMBS 10.0.62 — resiliência do Quadro Operacional e deduplicação do botão de sincronização.
// Não altera banco, regras de negócio nem Gerador de Escala.

let gcmbsQuadroRetryCount=0;
let gcmbsQuadroRetryTimer=null;
let gcmbsObserverScheduled=false;

function gcmbsDeduplicarSync(){
  const funcional=document.getElementById('onlineSyncNow');
  const estatico=document.getElementById('syncAgoraOnline');
  if(funcional&&estatico&&funcional!==estatico) estatico.remove();
}

function gcmbsQuadroPareceFalha(){
  const ativo=document.getElementById('qAtivos');
  const frota=document.getElementById('qViaturasTotal');
  const data=document.getElementById('quadroData');
  const app=document.getElementById('appTela');
  if(!ativo||!frota||!data||!app||app.classList.contains('hidden')) return false;
  const badge=String(document.getElementById('syncStatus')?.textContent||'');
  const token=localStorage.getItem('gcmbs.mobile.token');
  return !!token && /Última sincronização/i.test(badge) && String(ativo.textContent||'').trim()==='0' && String(frota.textContent||'').trim()==='0';
}

function gcmbsAgendarRetryQuadro(){
  if(gcmbsQuadroRetryTimer||gcmbsQuadroRetryCount>=4||!gcmbsQuadroPareceFalha()) return;
  const atrasos=[1200,2500,5000,9000];
  const atraso=atrasos[gcmbsQuadroRetryCount]||9000;
  gcmbsQuadroRetryTimer=setTimeout(()=>{
    gcmbsQuadroRetryTimer=null;
    if(!gcmbsQuadroPareceFalha()) return;
    gcmbsQuadroRetryCount++;
    const q=document.getElementById('quadroData');
    if(q){
      const aviso=document.getElementById('qAviso');
      if(aviso) aviso.textContent='Conexão temporariamente ocupada. Atualizando o Quadro Operacional automaticamente...';
      q.dispatchEvent(new Event('change',{bubbles:true}));
    }
    gcmbsAgendarRetryQuadro();
  },atraso);
}

function gcmbsNormalizarTela(){
  gcmbsDeduplicarSync();
  if(!gcmbsQuadroPareceFalha()){
    if(Number(document.getElementById('qAtivos')?.textContent||0)>0) gcmbsQuadroRetryCount=0;
    return;
  }
  gcmbsAgendarRetryQuadro();
}

function gcmbsScheduleNormalize(){
  if(gcmbsObserverScheduled)return;
  gcmbsObserverScheduled=true;
  queueMicrotask(()=>{
    gcmbsObserverScheduled=false;
    gcmbsNormalizarTela();
  });
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',gcmbsNormalizarTela,{once:true});
}else{
  gcmbsNormalizarTela();
}

window.addEventListener('load',gcmbsNormalizarTela,{once:true});
new MutationObserver(gcmbsScheduleNormalize).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
setTimeout(gcmbsNormalizarTela,800);
setTimeout(gcmbsNormalizarTela,2500);
