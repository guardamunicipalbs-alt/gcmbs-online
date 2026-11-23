/** GCMBS V360 - feriados em Extras: a classe 100% POR FERIADO depende da data de inicio.
 * Domingos seguem regras independentes. Codigo puro: sem gravação ou sincronizacao.
 */
function dataISO(valor) {
  if (typeof valor !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(valor)) throw new TypeError('DATA_INICIO_INVALIDA');
  const d = new Date(valor + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== valor) throw new TypeError('DATA_INICIO_INVALIDA');
  return valor;
}
export function classificacaoFeriadoExtra(dataInicio, datasFeriados = []) {
  const inicio = dataISO(dataInicio);
  if (!Array.isArray(datasFeriados) && !(datasFeriados instanceof Set)) throw new TypeError('FERIADOS_INVALIDOS');
  const feriados = new Set([...datasFeriados].map(dataISO));
  return Object.freeze({dataInicio: inicio, inicioEmFeriado: feriados.has(inicio), classePorFeriado: feriados.has(inicio) ? '100' : null});
}
export function mesmaClasseFeriadoEmTodaJornada(dataInicio, dataFim, datasFeriados = []) {
  const inicio = dataISO(dataInicio), fim = dataISO(dataFim);
  if (fim < inicio) throw new RangeError('JORNADA_INVALIDA');
  const classe = classificacaoFeriadoExtra(inicio, datasFeriados);
  return Object.freeze({...classe, dataFim: fim, classeConstanteNaJornada: classe.classePorFeriado});
}
