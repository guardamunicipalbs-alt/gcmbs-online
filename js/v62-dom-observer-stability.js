// GCMBS 10.0.62 — protege o observador visual global contra tempestade de mutações.
// O app.js registra gcmbsAgendarAjustesVisuais em document.documentElement. Em módulos
// com renderização extensa (ex.: Ofícios), centenas de childList/characterData podem
// disparar varreduras integrais do DOM em sequência. Somente esse callback é agrupado.
(function installGCMBSMutationObserverStability(){
  const NativeMutationObserver=window.MutationObserver;
  if(!NativeMutationObserver||NativeMutationObserver.__gcmbsV62Wrapped)return;

  class GCMBSMutationObserver extends NativeMutationObserver{
    constructor(callback){
      if(typeof callback==='function'&&callback.name==='gcmbsAgendarAjustesVisuais'){
        let timer=null;
        const debounced=(mutations,observer)=>{
          if(timer!==null)clearTimeout(timer);
          timer=setTimeout(()=>{
            timer=null;
            try{callback(mutations,observer);}catch(err){console.error('[GCMBS] ajuste visual global',err);}
          },90);
        };
        super(debounced);
        return;
      }
      super(callback);
    }
  }

  Object.defineProperty(GCMBSMutationObserver,'__gcmbsV62Wrapped',{value:true});
  Object.defineProperty(GCMBSMutationObserver,'__gcmbsNative',{value:NativeMutationObserver});
  window.MutationObserver=GCMBSMutationObserver;
})();
