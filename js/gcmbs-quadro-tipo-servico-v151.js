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
      #quadroModalLista{gap:6px!important}
      #quadroModalLista .item.gc151-servico-item{
        display:grid!important;
        grid-template-columns:minmax(175px,230px) minmax(0,1fr)!important;
        align-items:center!important;
        column-gap:10px!important;
        row-gap:3px!important;
        min-height:40px!important;
        padding:8px 11px!important;
        border-radius:10px!important;
      }
      #quadroModalLista .item.gc151-servico-item strong{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;line-height:1.2}
      #quadroModalLista .item.gc151-servico-item>span{line-height:1.25!important;margin:0!important}
      .gc151-service-type{display:inline-flex;align-items:center;justify-content:center;min-height:19px;padding:2px 7px;border-radius:999px;font-size:10px;line-height:1;font-weight:800;letter-spacing:.01em;text-transform:none;white-space:nowrap;border:1px solid transparent}
      .gc151-service-type.gc151-ordinario{background:#eaf2ff;color:#174ea6;border-color:#bfd3f6}
      .gc151-service-type.gc151-extra{background:#fff2d8;color:#8a4b00;border-color:#f2cf8e}
      @media (max-width:640px){
        #quadroModalLista{gap:5px!important}
        #quadroModalLista .item.gc151-servico-item{grid-template-columns:1fr!important;padding:8px 10px!important;row-gap:4px!important}
        .gc151-service-type{font-size:10px;padding:2px 7px}
      }
    `;
    document.head.appendChild(style);
  }

  const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  function ehModalServicoAB(){
    const titulo=norm(document.getElementById('quadroModalTitulo')?.textContent);
    return titulo.includes('servico a')||titulo.includes('servico b');
  }
  function classificar(item){
    // Não usar item.querySelector('span'): depois que o badge é inserido,
    // o primeiro <span> passa a ser o próprio badge ("Ordinário"/"Extra"),
    // fazendo um extra real ficar preso como Ordinário.
    const detalheEl=item.querySelector(':scope > span');
    const detalhe=norm(detalheEl?.textContent||'');
    const textoCompleto=norm(
      Array.from(item.childNodes)
        .filter(n=>n!==item.querySelector('strong'))
        .map(n=>n.textContent||'')
        .join(' ')
    );

    const s=(detalhe+' '+textoCompleto).trim();
    const ehExtra=
      /\bextra\b/i.test(s) ||
      /extra\s+automatic/i.test(s) ||
      /extra\s+por\s+evento/i.test(s) ||
      /servico\s+extra/i.test(s);

    return ehExtra?'EXTRA':'ORDINARIO';
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
