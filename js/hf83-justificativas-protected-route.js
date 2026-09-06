/*
 * GCMBS 10.0.76 — HF83
 * Corrige conflito entre communication-workflows-v74 e data-provider:
 * o wrapper legado voltava a enviar justificativas_faltas para entity_mutate
 * no gateway v74, sobrescrevendo a rota protegida gcmbs-justificativas-v68.
 *
 * Esta camada reimpõe a rota protegida para CREATE/UPDATE/CANCEL sem alterar
 * eventos, permutas, banco, Gerador de Escala, permissões ou payloads de outras entidades.
 */
(()=>{
  'use strict';

  const JUSTIFICATIVAS_API='https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-justificativas-v68';
  let ProviderClass=null;

  function networkMessage(err){
    const msg=String(err?.message||err||'');
    if(err instanceof TypeError||/failed to fetch|networkerror|network request failed|load failed/i.test(msg)){
      return 'Falha de comunicação com o servidor de Justificativa de Faltas. Nenhuma alteração foi confirmada.';
    }
    return msg||'Falha de comunicação com o servidor de Justificativa de Faltas.';
  }

  function isJustificativaEntity(entity){
    return /justificativ/.test(String(entity||'').toLowerCase());
  }

  function normalizeData(data){
    const d=data&&typeof data==='object'?{...data}:{};
    if(d.arquivo_dados){
      let raw=String(d.arquivo_dados||'');
      if(raw.length>8*1024*1024)throw new Error('O documento da justificativa excede o limite permitido.');
      if(!d.arquivo_tipo)d.arquivo_tipo='application/octet-stream';
      if(!raw.startsWith('data:'))raw=`data:${d.arquivo_tipo};base64,${raw}`;
      d.arquivo_dados=raw;
    }
    return d;
  }

  async function protectedMutate(recordKey,operation,data){
    const token=localStorage.getItem('gcmbs.mobile.token');
    if(!token)throw new Error('Sessão online não autenticada. Entre novamente no GCMBS.');

    const op=String(operation||'UPSERT').toUpperCase();
    const key=String(recordKey||'').trim();
    const action=op==='DELETE'?'cancel':key?'update':'create';
    const d=normalizeData(data);
    const payload=action==='cancel'?{action,record_key:key}:{action,record_key:key,...d};

    let response;
    try{
      response=await fetch(JUSTIFICATIVAS_API,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${token}`
        },
        body:JSON.stringify(payload),
        cache:'no-store'
      });
    }catch(err){
      throw new Error(networkMessage(err));
    }

    let body={};
    try{body=await response.json()}catch{}
    if(!response.ok)throw new Error(body.message||`Erro ${response.status} ao processar a justificativa.`);
    return {...body,record_key:body.record_key||key,protected_write:true,hf83:true};
  }

  function install(){
    const C=ProviderClass;
    if(!C?.prototype)return;
    const current=C.prototype.entityMutate;
    if(typeof current!=='function'||current.__gcmbs_hf83)return;

    const wrapped=async function(entity,record_key,operation,data,client_change_id=''){
      if(isJustificativaEntity(entity)){
        return protectedMutate(record_key,operation,data);
      }
      return current.call(this,entity,record_key,operation,data,client_change_id);
    };
    wrapped.__gcmbs_hf83=true;
    wrapped.__gcmbs_hf83_base=current;
    C.prototype.entityMutate=wrapped;
    console.info('[GCMBS] HF83 rota protegida de Justificativa de Faltas ativa');
  }

  async function boot(){
    try{
      const script=document.currentScript?.src||location.href;
      const providerUrl=new URL('data-provider.js?v=100083',script).href;
      const mod=await import(providerUrl);
      ProviderClass=mod.AuthenticatedProvider;
      install();
      setTimeout(install,150);
      setTimeout(install,800);
      setTimeout(install,1800);
    }catch(err){
      console.warn('[GCMBS] HF83 não pôde instalar a rota protegida de justificativas',err);
    }
  }

  // Reinstala imediatamente antes das ações da tela. Isso garante precedência mesmo
  // se outro módulo legado substituir o prototype depois do carregamento inicial.
  document.addEventListener('click',event=>{
    const t=event.target instanceof Element?event.target:null;
    if(!t)return;
    const action=t.closest('[data-online-del],[data-online-edit],#onlineNovo,#onlineSalvar');
    if(!action)return;
    const title=String(document.getElementById('onlineTitulo')?.textContent||document.getElementById('onlineModuloTitulo')?.textContent||'');
    if(/Justificativa de Faltas/i.test(title))install();
  },true);

  window.addEventListener('load',()=>setTimeout(install,0),{once:true});
  boot();
})();
