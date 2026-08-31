// GCMBS 10.0.68 - HF10 R21D
// Protege apenas o indicador visual de versao contra camadas legadas 10.0.62.
// Nao altera dados, permissoes, payloads ou regras operacionais.
(function(){
  const corrigir=v=>String(v??'').replaceAll('10.0.62','10.0.68');

  function instalar(){
    const el=document.getElementById('onlineVersao');
    if(!el||el.dataset.hf10R21dVersionGuard==='1')return;
    el.dataset.hf10R21dVersionGuard='1';

    const desc=Object.getOwnPropertyDescriptor(Node.prototype,'textContent');
    if(desc?.get&&desc?.set){
      Object.defineProperty(el,'textContent',{
        configurable:true,
        enumerable:false,
        get(){return desc.get.call(this);},
        set(v){return desc.set.call(this,corrigir(v));}
      });
      el.textContent=corrigir(el.textContent);
      return;
    }

    let busy=false;
    const normalizar=()=>{
      if(busy)return;
      const atual=String(el.textContent||'');
      const novo=corrigir(atual);
      if(novo===atual)return;
      busy=true;el.textContent=novo;busy=false;
    };
    new MutationObserver(normalizar).observe(el,{childList:true,subtree:true,characterData:true});
    normalizar();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalar,{once:true});
  else instalar();
  console.info('[GCMBS] HF10 R21D protecao de versao 10.0.68 ativa');
})();
