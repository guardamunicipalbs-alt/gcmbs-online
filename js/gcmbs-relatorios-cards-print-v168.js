/* GCMBS HF168 — impressão dos relatórios em cartões; preserva a impressão compacta.
 * Somente interface web: não altera registros ou chama APIs.
 */
(()=>{
  'use strict';
  if (window.__GCMBS_RELATORIOS_CARDS_PRINT_V168__) return;
  window.__GCMBS_RELATORIOS_CARDS_PRINT_V168__ = true;
  if (/^(capacitor|file):/i.test(location.protocol) || window.Capacitor?.isNativePlatform?.()) return;

  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const text = value => String(value ?? '').replace(/\s+/g,' ').trim();

  // Executar na captura da janela, antes da rotina legada de impressão no documento.
  window.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('#relatoriosImprimir,#relatoriosImprimirV129');
    if (!button) return;
    const report = $('section[data-view="relatorios"]');
    if (!report || report.classList.contains('hidden')) return;
    // A matriz, quando presente, já é tratada pela correção V167.
    if (report.querySelector('table[data-gc129-desktop="1"]')) return;
    const cards = [...report.querySelectorAll('#relatoriosLista article.record-card')]
      .filter(card => !card.hidden && card.style.display !== 'none');
    if (!cards.length) return; // A mensagem original continua adequada para relatório vazio.

    event.preventDefault();
    event.stopImmediatePropagation();
    // Tudo é extraído da tela já filtrada, sem nova consulta ou alteração de dados.
    const rows = cards.map(card => {
      const date = text(card.querySelector('.record-card-head span')?.textContent);
      const guard = text(card.querySelector('.record-card-head strong')?.textContent);
      const meta = text(card.querySelector('.record-meta')?.textContent);
      const separator = meta.lastIndexOf(' · ');
      const station = separator >= 0 ? meta.slice(0,separator) : meta;
      const shift = separator >= 0 ? meta.slice(separator+3) : '';
      const detail = text(card.querySelector('.record-meta')?.nextElementSibling?.textContent);
      return `<tr><td>${esc(date)}</td><td>${esc(guard)}</td><td>${esc(station)}</td><td>${esc(shift)}</td><td>${esc(detail)}</td></tr>`;
    }).join('');
    const start = $('#relatoriosIni')?.value || '';
    const end = $('#relatoriosFim')?.value || '';
    const guard = $('#relatoriosGcm')?.selectedOptions?.[0]?.textContent || 'Todos os GCMs';
    const station = $('#relatoriosPosto')?.selectedOptions?.[0]?.textContent || 'Todos os postos';
    const summary = `Período: ${start || 'início'} a ${end || 'fim'} · ${guard} · ${station}`;

    const popup = window.open('', '_blank');
    if (!popup) { alert('O navegador bloqueou a impressão. Autorize a abertura de janelas para este site.'); return; }
    try {
      popup.opener = null;
      popup.document.open();
      popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>GCMBS — Relatório institucional de escalas</title><style>
@page{size:landscape;margin:9mm}body{font:11px Arial,sans-serif;color:#172d43}
h1{font-size:17px;margin:0 0 8px}p{margin:3px 0 9px;font-size:10px}
table{width:100%;border-collapse:collapse}thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}th,td{border:1px solid #9cb1c2;padding:4px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
th{background:#eaf1f8}td:first-child{white-space:nowrap;width:85px}
</style></head><body><h1>GCMBS — Relatório institucional de escalas</h1>
<p>${esc(summary)}</p><p>${cards.length} registro(s) atualmente exibido(s)</p>
<table><thead><tr><th>Data</th><th>GCM</th><th>Posto</th><th>Horário</th><th>Detalhes (motorista, viatura, extra)</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
      popup.document.close();
      popup.focus();
      setTimeout(() => { try { if (!popup.closed) popup.print(); } catch (error) { console.warn('[GCMBS HF168] impressão:',error); } },300);
    } catch (error) {
      console.warn('[GCMBS HF168] falha na impressão:',error);
      try { popup.close(); } catch {}
      alert('Não foi possível preparar a impressão do relatório.');
    }
  },true);
  console.info('[GCMBS HF168] impressão de relatórios em cartões habilitada');
})();
