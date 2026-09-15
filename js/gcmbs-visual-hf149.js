/* GCMBS Online 10.0.160 - HF158 R2 / Android 10.0.148 - HF160 */
(()=>{
'use strict';

if(window.__GCMBS_VISUAL_HF149_R3__) return;
window.__GCMBS_VISUAL_HF149_R3__=true;

const ONLINE_VERSION='10.0.160';
const ONLINE_HF='HF158 R2';
const ANDROID_VERSION='10.0.148';
const ANDROID_HF='HF160';

function nativeAndroid(){
  try{
    return Boolean(
      globalThis.Capacitor?.isNativePlatform?.() ||
      globalThis.Capacitor?.getPlatform?.()==='android'
    );
  }catch{
    return false;
  }
}

function versaoPrincipal(){
  return nativeAndroid()
    ? `Android · ${ANDROID_VERSION} · ${ANDROID_HF}`
    : `Online · ${ONLINE_VERSION} · ${ONLINE_HF}`;
}

function textoVersao(v){
  const s=String(v||'').trim();

  return (
    /10\.0\.\d+/.test(s) &&
    /^(?:Online|Offline|Android|Online\/App)(?:\s*[·-]\s*(?:Online|Offline|Android))?/i.test(s)
  );
}

function corrigirVersaoPrincipal(){

  const el=document.getElementById('onlineVersao');

  if(el){
    const correto=versaoPrincipal();

    if(el.textContent!==correto){
      el.textContent=correto;
    }
  }

  document.documentElement.dataset.gcmbsVersion=nativeAndroid()?ANDROID_VERSION:ONLINE_VERSION;
}

function corrigirEstados(){

  const candidatos=[
    ...document.querySelectorAll('small,span')
  ];

  for(const el of candidatos){

    if(el.children.length) continue;

    const atual=String(el.textContent||'').trim();

    if(!textoVersao(atual)) continue;

    /*
      onlineVersao já é tratado separadamente.
    */
    if(el.id==='onlineVersao') continue;

    let estado='Online';

    if(/^Offline/i.test(atual)){
      estado='Offline';
    }
    else if(/^Android/i.test(atual)){
      estado='Android';
    }

    const versao=estado==='Android'?ANDROID_VERSION:ONLINE_VERSION;
    const hf=estado==='Android'?ANDROID_HF:ONLINE_HF;
    const correto=`${estado} · ${versao} · ${hf}`;

    if(atual!==correto){
      el.textContent=correto;
    }
  }
}

function corrigirCardAtualizacao(){

  const card=document.getElementById('appAtualizacaoCard');

  if(!card) return;

  const negritos=[...card.querySelectorAll('b,strong')];

  for(const el of negritos){

    const t=String(el.textContent||'').trim();

    if(/^10\.0\.\d+$/.test(t) && t!==ANDROID_VERSION){
      el.textContent=ANDROID_VERSION;
    }
  }
}

function corrigirFecharModal(){

  const modal=document.getElementById('quadroModal');

  if(!modal) return;

  const botoes=[...modal.querySelectorAll('button')];

  for(const b of botoes){

    const txt=String(b.textContent||'').trim();

    if(
      txt==='Ã' ||
      txt==='Ã—' ||
      txt==='Â×' ||
      txt==='×' ||
      /^(?:Ã.|Â.)$/.test(txt)
    ){
      if(txt!=='×'){
        b.textContent='×';
      }

      b.setAttribute('aria-label','Fechar');
      b.setAttribute('title','Fechar');
      break;
    }
  }
}

function aplicar(){
  corrigirVersaoPrincipal();
  corrigirEstados();
  corrigirCardAtualizacao();
  corrigirFecharModal();
}

function iniciar(){

  aplicar();

  let ocupado=false;

  new MutationObserver(()=>{

    if(ocupado) return;

    ocupado=true;

    queueMicrotask(()=>{
      ocupado=false;
      aplicar();
    });

  }).observe(document.documentElement,{
    childList:true,
    subtree:true,
    characterData:true
  });

  /*
    Camadas legadas possuem timers próprios.
    Esta verificação garante o estado final sem alterar
    os contratos ou módulos antigos.
  */
  setInterval(aplicar,1000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',iniciar,{once:true});
}else{
  iniciar();
}

})();