/**
 * GCMBS — Checklists de viaturas / Google Forms — R1
 * Integração ADITIVA: não altera nem remove respostas ou checklists do App.
 * Configurar a propriedade de script GCMBS_FORMS_R5_INGEST_TOKEN
 * com o mesmo segredo já usado pelo importador das permutas.
 * Executar instalarTriggerChecklists uma única vez, autorizando o Google.
 */
const GCMBS_CHECKLISTS_R1 = Object.freeze({
  spreadsheetId: '1_gHogPrSvi7Zk9wAla-IxPeGNCq-oVFmu8ziVfPP58Y',
  gid: 1559817879,
  endpoint: 'https://cxtayxzvilqrfczjlufk.supabase.co/functions/v1/gcmbs-forms-checklists-ingest-r1'
});
function enviarChecklistsGCMBS() {
  const mutex = LockService.getScriptLock();
  if (!mutex.tryLock(2000)) return;
  try {
    const key = PropertiesService.getScriptProperties().getProperty('GCMBS_FORMS_R5_INGEST_TOKEN');
    if (!key || key.length < 32) throw new Error('Segredo GCMBS_FORMS_R5_INGEST_TOKEN nao configurado');
    const book = SpreadsheetApp.openById(GCMBS_CHECKLISTS_R1.spreadsheetId);
    const tab = book.getSheets().find(s => s.getSheetId() === GCMBS_CHECKLISTS_R1.gid);
    if (!tab) throw new Error('Aba de respostas nao encontrada');
    const last = tab.getLastRow();
    const rows = last < 2 ? [] : tab.getRange(2, 1, last - 1, 38).getDisplayValues()
      .map((values, i) => ({ source_row: i + 2, values }))
      .filter(r => r.values.some(x => String(x).trim() !== ''));
    if (rows.length > 1000) throw new Error('Mais de 1000 linhas: importacao em lotes sera necessaria');
    const body = JSON.stringify({spreadsheetId:GCMBS_CHECKLISTS_R1.spreadsheetId,gid:GCMBS_CHECKLISTS_R1.gid,rows});
    if (body.length > 600000) throw new Error('Arquivo excede o limite seguro da integracao');
    const response = UrlFetchApp.fetch(GCMBS_CHECKLISTS_R1.endpoint, {
      method:'post', contentType:'application/json', payload:body,
      headers:{'x-gcmbs-forms-token':key}, muteHttpExceptions:true
    });
    const status=response.getResponseCode();
    if (status === 429) { console.log('Modelo B: intervalo minimo de 30 minutos preservado');return; }
    if (status !== 200) throw new Error('Falha no envio (HTTP '+status+'): '+response.getContentText().slice(0,250));
    console.log('Checklists enviados com sucesso: '+rows.length);
  } finally {mutex.releaseLock();}
}
function instalarTriggerChecklists() {
  const existe=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='enviarChecklistsGCMBS');
  if (!existe) ScriptApp.newTrigger('enviarChecklistsGCMBS').timeBased().everyMinutes(30).create();
}
