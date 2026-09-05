// GCMBS 10.0.75 - compatibilidade com camadas legadas
// Protege apenas o indicador visual de versao contra camadas legadas 10.0.62.
// Nao altera dados, permissoes, payloads ou regras operacionais.
(function(){
  const corrigir=v=>String(v??'').replace(/10\.0\.(?:62|68|69)/g,'10.0.75');

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
  console.info('[GCMBS] Proteção de versão 10.0.75 ativa');
})();
