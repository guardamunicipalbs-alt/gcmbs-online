/*
 * GCMBS V134 — Justificativa de Faltas
 * Libera o campo de documento comprobatório para qualquer formato de arquivo.
 * Preserva o limite existente de 5 MB e o fluxo protegido de gravação.
 */
(()=>{
  'use strict';

  const INPUT_ID='onlineArquivoJustificativa';

  function ajustarCampoArquivo(){
    const input=document.getElementById(INPUT_ID);
    if(!input)return;

    // Sem o atributo accept, o navegador/Android permite selecionar qualquer formato.
    if(input.hasAttribute('accept'))input.removeAttribute('accept');
    input.dataset.gcmbsAnyFile='1';

    const label=input.closest('label');
    if(!label)return;

    for(const node of label.childNodes){
      if(node.nodeType===Node.TEXT_NODE && /Documento\s+comprobat[oó]rio/i.test(String(node.nodeValue||''))){
        node.nodeValue='Documento comprobatório (qualquer formato)';
        break;
      }
    }

    if(!label.querySelector('[data-gcmbs-any-file-note]')){
      const note=document.createElement('small');
      note.className='muted';
      note.dataset.gcmbsAnyFileNote='1';
      note.textContent='Qualquer formato de arquivo é aceito · máximo 5 MB.';
      input.insertAdjacentElement('afterend',note);
    }
  }

  let scheduled=false;
  function agendarAjuste(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(()=>{
      scheduled=false;
      ajustarCampoArquivo();
    });
  }

  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target:null;
    if(!target)return;
    if(target.closest('#onlineNovo,[data-online-edit],#onlineSalvar')){
      setTimeout(ajustarCampoArquivo,0);
    }
  },true);

  const root=document.getElementById('appTela')||document.body;
  if(root){
    new MutationObserver(agendarAjuste).observe(root,{
      childList:true,
      subtree:true,
      attributes:true,
      attributeFilter:['accept']
    });
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ajustarCampoArquivo,{once:true});
  }else{
    ajustarCampoArquivo();
  }

  console.info('[GCMBS] V134 — anexos de Justificativa liberados para qualquer formato');
})();
