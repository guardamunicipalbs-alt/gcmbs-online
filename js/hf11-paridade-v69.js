// GCMBS 10.0.69 — paridade de impressão Desktop, Online e App.
// A tabela é dividida em páginas equilibradas de até oito dias, sem página final vazia.
(function(){
  const MAX_DIAS=8;
  const $=id=>document.getElementById(id);

  function relatoriosAtivo(){
    const nav=document.querySelector('#mainNav [data-module="relatorios"].active');
    const view=document.querySelector('[data-view="escala"]');
    return Boolean(nav&&view&&!view.classList.contains('hidden'));
  }

  function dividir(total){
    if(total<=0)return[];
    const paginas=Math.ceil(total/MAX_DIAS),base=Math.floor(total/paginas),extras=total%paginas;
    const blocos=[];let inicio=0;
    for(let i=0;i<paginas;i++){
      const tamanho=base+(i<extras?1:0);
      blocos.push({inicio,fim:inicio+tamanho});
      inicio+=tamanho;
    }
    return blocos;
  }

  function textoSeguro(v){return String(v||'').replace(/\s+/g,' ').trim();}

  function criarTabela(origem,inicio,fim){
    const tabela=document.createElement('table');
    tabela.className='gcmbs-print-matrix';
    const thead=document.createElement('thead'),hrow=document.createElement('tr');
    const headers=[...origem.querySelectorAll('thead tr:first-child > *')];
    if(headers[0])hrow.appendChild(headers[0].cloneNode(true));
    for(const h of headers.slice(1+inicio,1+fim))hrow.appendChild(h.cloneNode(true));
    thead.appendChild(hrow);tabela.appendChild(thead);

    const tbody=document.createElement('tbody');
    for(const linha of origem.querySelectorAll('tbody tr')){
      const cells=[...linha.children],tr=document.createElement('tr');
      if(cells[0])tr.appendChild(cells[0].cloneNode(true));
      for(const c of cells.slice(1+inicio,1+fim)){
        const clone=c.cloneNode(true);
        clone.querySelectorAll('button,[data-scale-edit]').forEach(x=>x.remove());
        tr.appendChild(clone);
      }
      tbody.appendChild(tr);
    }
    tabela.appendChild(tbody);
    return tabela;
  }

  function prepararImpressao(){
    if(!relatoriosAtivo())return;
    const origem=document.querySelector('[data-view="escala"] .report-matrix');
    const total=Math.max(0,(origem?.querySelectorAll('thead tr:first-child > *').length||0)-1);
    if(!origem||total===0){alert('Gere o relatório antes de imprimir.');return;}

    let area=$('gcmbsScalePrintArea');
    if(!area){area=document.createElement('div');area.id='gcmbsScalePrintArea';document.body.appendChild(area);}
    area.replaceChildren();
    const info=textoSeguro($('escalaInfo')?.textContent),filtro=textoSeguro($('escalaFiltroAtivo')?.textContent);
    const blocos=dividir(total);
    blocos.forEach((bloco,i)=>{
      const pagina=document.createElement('section');pagina.className='gcmbs-print-page';
      const header=document.createElement('header');header.innerHTML='<h1>ESCALA DE SERVIÇO</h1>';
      const p=document.createElement('p');p.textContent=[info,filtro].filter(Boolean).join(' · ');header.appendChild(p);
      pagina.appendChild(header);pagina.appendChild(criarTabela(origem,bloco.inicio,bloco.fim));
      const footer=document.createElement('footer');footer.textContent=`GCMBS 10.0.69 · Página ${i+1} de ${blocos.length}`;pagina.appendChild(footer);
      area.appendChild(pagina);
    });
    document.body.classList.add('gcmbs-print-scale');
    requestAnimationFrame(()=>window.print());
  }

  function finalizar(){document.body.classList.remove('gcmbs-print-scale');}

  function atualizarBotao(){
    const btn=$('escalaImprimir');if(!btn)return;
    btn.hidden=!relatoriosAtivo();
    if(btn.dataset.gcmbsPrintReady!=='1'){
      btn.dataset.gcmbsPrintReady='1';
      btn.addEventListener('click',prepararImpressao);
    }
  }

  function instalar(){
    const style=document.createElement('style');style.id='gcmbsPrintScaleStyle';style.textContent=`
      #gcmbsScalePrintArea{display:none}
      @media print{
        @page{size:A4 landscape;margin:4mm}
        body.gcmbs-print-scale{margin:0!important;padding:0!important;background:#fff!important}
        body.gcmbs-print-scale> *:not(#gcmbsScalePrintArea){display:none!important}
        body.gcmbs-print-scale #gcmbsScalePrintArea{display:block!important;margin:0!important;padding:0!important}
        .gcmbs-print-page{margin:0!important;padding:0!important;page-break-after:always;break-after:page}
        .gcmbs-print-page:last-child{page-break-after:auto!important;break-after:auto!important}
        .gcmbs-print-page header{text-align:center;margin:0 0 1.2mm}
        .gcmbs-print-page h1{font:800 11pt Inter,Segoe UI,Arial,sans-serif;margin:0 0 .6mm}
        .gcmbs-print-page header p{font:6pt Inter,Segoe UI,Arial,sans-serif;color:#334155;margin:0}
        .gcmbs-print-matrix{border-collapse:collapse;width:100%;table-layout:fixed;background:#fff}
        .gcmbs-print-matrix th,.gcmbs-print-matrix td{border:.2mm solid #cbd5e1!important;padding:.55mm .45mm!important;vertical-align:top!important;font:5.5pt/1.02 Inter,Segoe UI,Arial,sans-serif!important;min-width:0!important;position:static!important;white-space:normal!important;overflow-wrap:anywhere}
        .gcmbs-print-matrix thead th{background:#e2e8f0!important;font-weight:800!important;text-align:center!important}
        .gcmbs-print-matrix th:first-child{width:24mm!important;text-align:left!important;background:#f8fafc!important}
        .gcmbs-print-matrix tr{page-break-inside:avoid;break-inside:avoid}
        .gcmbs-print-matrix .posto-linha span{display:block;font-size:5pt!important;margin-top:.2mm!important}
        .gcmbs-print-matrix .gcm-linha{padding:0!important;margin:0 0 .25mm!important;border:0!important;white-space:normal!important}
        .gcmbs-print-matrix .tag-driver,.gcmbs-print-matrix .tag-extra{display:block;font-size:4.7pt!important;margin:0!important}
        .gcmbs-print-page footer{text-align:right;margin:.5mm 0 0;font:5pt Inter,Segoe UI,Arial,sans-serif;color:#64748b}
      }`;
    document.head.appendChild(style);
    atualizarBotao();
    new MutationObserver(atualizarBotao).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    window.addEventListener('afterprint',finalizar);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)finalizar();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalar,{once:true});
  else instalar();
})();
