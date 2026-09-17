/* GCMBS V167 — reparos isolados de interface, sem alterar banco ou regras operacionais.
 * Aplica-se apenas no Online. Todas as impressoes usam a matriz ja renderizada,
 * preservando filtros, marcação de motorista e serviços extras da fonte original.
 */
(()=>{
  'use strict';
  if (window.__GCMBS_SAFE_UI_AUDIT_V167__) return;
  window.__GCMBS_SAFE_UI_AUDIT_V167__ = true;
  if (window.Capacitor?.isNativePlatform?.()) return;

  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const normalize = value => String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  function applyPendingFilters(){
    const view = $('section[data-view="pendencias"]');
    const host = $('#pendenciasLista');
    if (!view || !host) return;
    const query = normalize($('#gc102PendSearch')?.value);
    const filter = view.dataset.gc102Filter || 'all';
    host.querySelectorAll('.pending-card').forEach(card => {
      const label = normalize(card.querySelector('small')?.textContent || '');
      const notice = label.startsWith('aviso');
      const categoryMatches = filter === 'all' ||
        (filter === 'avisos' ? notice : !notice);
      const visible = categoryMatches && (!query || normalize(card.textContent).includes(query));
      const display = visible ? '' : 'none';
      if (card.style.display !== display) card.style.display = display;
    });
  }

  function safeCell(cell){
    if (!cell) return '<td>—</td>';
    const copy = cell.cloneNode(true);
    copy.querySelectorAll('button,input,textarea,select,script,iframe,form').forEach(x=>x.remove());
    copy.querySelectorAll('*').forEach(el=>{
      for (const attr of [...el.attributes]) {
        if (/^on/i.test(attr.name) || /^(href|src|srcdoc)$/i.test(attr.name)) el.removeAttribute(attr.name);
      }
    });
    return copy.outerHTML;
  }

  function printCurrentMatrix(type){
    const report = type === 'escala'
      ? $('section[data-view="escala"]')
      : $('section[data-view="relatorios"]');
    const table = type === 'escala'
      ? report?.querySelector('table.report-matrix')
      : report?.querySelector('table[data-gc129-desktop="1"]');
    const title = type === 'escala' ? 'Escala — impressão compacta' : 'Relatório institucional de escalas';
    const heading = [...(table?.tHead?.rows?.[0]?.cells || [])];
    const rows = [...(table?.tBodies?.[0]?.rows || [])];
    if (!table || heading.length < 2 || !rows.some(row => row.cells.length > 1)) {
      alert('Gere um relatório com registros antes de imprimir.');
      return;
    }
    const description = type === 'escala'
      ? $('#escalaInfo')?.textContent || ''
      : $('#relatoriosStatus')?.textContent || '';
    const filterInfo = type === 'escala' ? $('#escalaFiltroAtivo')?.textContent || '' : '';
    const daysPerPage = 8;
    const blocks = [];
    for (let start=1; start<heading.length; start+=daysPerPage) {
      const end = Math.min(heading.length, start+daysPerPage);
      const cells = heading.slice(start,end);
      const body = rows.map(row => {
        if (row.cells.length < end) return '';
        return '<tr>' + safeCell(row.cells[0]) +
          [...row.cells].slice(start,end).map(safeCell).join('') + '</tr>';
      }).join('');
      blocks.push('<section class="page"><p class="period">' +
        escapeHtml(cells[0]?.textContent || '') + ' a ' +
        escapeHtml(cells[cells.length-1]?.textContent || '') + '</p><table><thead><tr>' +
        safeCell(heading[0]) + cells.map(safeCell).join('') +
        '</tr></thead><tbody>' + body + '</tbody></table></section>');
    }
    // A abertura ocorre diretamente dentro do clique: evita bloqueio de pop-up.
    // Sem o recurso "noopener" em window.open: navegadores devolvem null nesse caso.
    const popup = window.open('', '_blank');
    if (!popup) { alert('O navegador bloqueou a impressão. Autorize a abertura de janelas para este site.'); return; }
    try {
      popup.opener = null;
      popup.document.open();
      popup.document.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>' +
        escapeHtml(title) + '</title><style>' +
        '@page{size:landscape;margin:8mm}body{font:10px Arial,sans-serif;color:#122b43}' +
        'h1{font-size:16px;margin:0 0 5px}p{margin:3px 0 7px}.period{font-weight:700}' +
        '.page{page-break-after:always}.page:last-child{page-break-after:auto}' +
        'table{border-collapse:collapse;width:100%;table-layout:fixed}' +
        'th,td{border:1px solid #9bb2c6;padding:3px;vertical-align:top;overflow-wrap:anywhere}' +
        'th:first-child{width:135px;text-align:left}thead th{background:#edf4fa}' +
        'td div{margin-bottom:3px}.gcm-linha b{display:block}.tag-driver,.tag-extra{display:block;font-size:8px}' +
        '</style></head><body><h1>' + escapeHtml(title) + '</h1><p>' +
        escapeHtml(description) + '</p><p>' + escapeHtml(filterInfo) + '</p>' +
        blocks.join('') + '</body></html>');
      popup.document.close();
      popup.focus();
      setTimeout(()=>{try{if (!popup.closed) popup.print();}catch(err){console.warn('[GCMBS] impressão:',err);}},300);
    } catch (err) {
      console.warn('[GCMBS] falha ao preparar impressão:',err);
      try{popup.close();}catch{}
      alert('Não foi possível preparar a impressão neste navegador.');
    }
  }

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (target.closest('#sair')) {
      // Lembrar usuário não significa manter sessão ativa depois de Sair.
      // O handler original fará logout no servidor e apagará o token local.
      localStorage.setItem('gcmbs.login.remember','0');
      return;
    }
    const print = target.closest('#escalaImprimir,#relatoriosImprimir,#relatoriosImprimirV129');
    if (print) {
      event.preventDefault();
      event.stopImmediatePropagation();
      printCurrentMatrix(print.id === 'escalaImprimir' ? 'escala' : 'relatorios');
    }
  }, true);

  document.addEventListener('input', event => {
    if (event.target?.id === 'gc102PendSearch') applyPendingFilters();
  });
  document.addEventListener('click', event => {
    if (event.target?.closest?.('section[data-view="pendencias"] .dashboard-card')) {
      applyPendingFilters();
    }
  });
  const init = () => {
    const host = $('#pendenciasLista');
    if (host && !host.dataset.gc167Observer) {
      host.dataset.gc167Observer='1';
      new MutationObserver(applyPendingFilters).observe(host,{childList:true});
    }
    applyPendingFilters();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  console.info('[GCMBS] V167 correções seguras de impressão, filtros e saída carregadas');
})();
