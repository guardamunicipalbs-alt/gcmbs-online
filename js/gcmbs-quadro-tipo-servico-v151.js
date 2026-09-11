/* GCMBS V151 — Quadro Operacional: identifica visualmente serviço Ordinário/Extra nas relações A/B.
 * Camada exclusivamente visual. Não altera contagem, alocação nem lógica do Gerador de Escala.
 */
(()=>{
  'use strict';
  if(window.__GCMBS_V151_QUADRO_TIPO_SERVICO__)return;
  window.__GCMBS_V151_QUADRO_TIPO_SERVICO__=true;

  const STYLE_ID='gc151-quadro-tipo-servico-style';
  if(!document.getElementById(STYLE_ID)){
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #quadroModalLista .item.gc151-servico-item strong{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}
      .gc151-service-type{display:inline-flex;align-items:center;justify-content:center;min-height:22px;padding:2px 9px;border-radius:999px;font-size:11px;line-height:1;font-weight:800;letter-spacing:.02em;text-transform:none;white-space:nowrap;border:1px solid transparent}
      .gc151-service-type.gc151-ordinario{background:#eaf2ff;color:#174ea6;border-color:#bfd3f6}
      .gc151-service-type.gc151-extra{background:#fff2d8;color:#8a4b00;border-color:#f2cf8e}
      @media (max-width:640px){.gc151-service-type{font-size:10px;padding:2px 7px}}
    `;
    document.head.appendChild(style);
  }

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  function ehModalServicoAB(){
    const titulo=norm(document.getElementById('quadroModalTitulo')?.textContent);
    return titulo.includes('servico a')||titulo.includes('servico b');
  }
  function classificar(item){
    const detalhe=norm(item.querySelector('span')?.textContent);
    return /(^|\b)extra(\b|$)/i.test(detalhe)?'EXTRA':'ORDINARIO';
  }
  function aplicar(){
    const lista=document.getElementById('quadroModalLista');
    if(!lista||!ehModalServicoAB())return;
    lista.querySelectorAll('.item').forEach(item=>{
      const nome=item.querySelector('strong');
      if(!nome)return;
      item.classList.add('gc151-servico-item');
      let badge=nome.querySelector('.gc151-service-type');
      if(!badge){badge=document.createElement('span');badge.className='gc151-service-type';nome.appendChild(badge);}
      const tipo=classificar(item);
      badge.textContent=tipo==='EXTRA'?'Extra':'Ordinário';
      badge.classList.toggle('gc151-extra',tipo==='EXTRA');
      badge.classList.toggle('gc151-ordinario',tipo!=='EXTRA');
      badge.setAttribute('aria-label',`Tipo de serviço: ${badge.textContent}`);
    });
  }

  let timer;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(aplicar,20)};
  function boot(){
    schedule();
    const modal=document.getElementById('quadroModal');
    if(modal)new MutationObserver(schedule).observe(modal,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',e=>{if(e.target?.closest?.('[data-quadro-detalhe],#quadroModal'))schedule();},true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
