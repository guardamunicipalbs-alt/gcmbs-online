/**
 * GCMBS Sync V2 — aplicacao atomica de uma pagina, prototipo de contrato de
 * armazenamento. Sem dependencias de browser ou Android e SEM I/O de producao.
 *
 * store.transaction(async tx => ...):
 *   tx.read(key) -> { records: Map, cursor: string|null, done: boolean } | null
 *   tx.write(key, state) -> void|Promise<void>
 * O driver SQLite/IndexedDB deve CONFIRMAR ou ROLLBACK toda a transacao.
 * Esta rotina so garante atomicidade por pagina. NAO fornece snapshot congelado,
 * jornal de eventos transacional, revogacao de ACL nem delta definitivo.
 */
import { mergeSnapshotPage } from "./merge-snapshot.mjs";

function requireString(x, label) {
  if (typeof x !== "string" || !x.length) throw new Error(label + ": obrigatorio");
  return x;
}
export async function commitSnapshotPage({
  store,
  response,
  guardaId,
  entity,
  expectedAfterKey = null,
}) {
  if (!store || typeof store.transaction !== "function") throw new TypeError("Armazenamento sem transacao");
  if (!Number.isSafeInteger(guardaId) || guardaId <= 0) throw new Error("Usuario invalido");
  requireString(entity, "entity");
  if (!response || response.contract !== "GCMBS_SYNC_V2_LAB") throw new Error("Contrato invalido");
  if (Number(response.guarda_id) !== guardaId) throw new Error("Resposta de outro usuario");
  if (response.entity !== entity) throw new Error("Resposta de outra entidade");
  if (expectedAfterKey !== null && typeof expectedAfterKey !== "string") throw new Error("Cursor de requisicao invalido");
  if (typeof response.has_more !== "boolean") throw new Error("has_more invalido");
  if (!Array.isArray(response.records)) throw new Error("Pagina sem records");
  const rows = response.records;
  if (response.has_more && !rows.length) throw new Error("Pagina vazia com mais dados");
  let previousKey = expectedAfterKey;
  for (const row of rows) {
    if (typeof row?.key !== "string" || !row.key.length) throw new Error("record_key invalida");
    if (previousKey !== null && row.key <= previousKey) throw new Error("Ordem de pagina invalida");
    previousKey = row.key;
  }
  if (response.has_more && response.next_after_key !== rows[rows.length - 1].key) {
    throw new Error("Cursor nao corresponde a ultima chave");
  }
  if (!response.has_more && response.next_after_key !== null && response.next_after_key !== undefined) {
    throw new Error("Cursor terminal deveria ser nulo");
  }

  // A separacao por GCM garante que nunca se misturem caches de sessoes distintas.
  const cacheKey = "gcmbs:sync-v2:" + guardaId + ":" + entity;
  return store.transaction(async (tx) => {
    const prior = await tx.read(cacheKey);
    const state = prior ?? { records: new Map(), cursor: null, done: false };
    if (!(state.records instanceof Map)) throw new Error("Estado local corrompido");
    if (state.cursor !== expectedAfterKey) throw new Error("Checkpoint divergente: reiniciar captura");
    if (state.done) throw new Error("Captura ja finalizada: novo bootstrap requerido");
    const applied = mergeSnapshotPage(state.records, response);
    const cursor = response.has_more ? response.next_after_key : null;
    await tx.write(cacheKey, {
      records: applied.records,
      cursor,
      done: !response.has_more,
    });
    return {
      applied: applied.applied,
      unchanged: applied.unchanged,
      cursor,
      done: !response.has_more,
      totalCached: applied.records.size,
    };
  });
}
