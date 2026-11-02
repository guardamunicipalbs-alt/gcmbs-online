/**
 * GCMBS Sync V2 - prototipo de cache de duas geracoes (somente laboratorio).
 *
 * IMPORTANTE:
 * - A geracao "active" permanece inalterada enquanto "staging" e capturada.
 * - A promocao da captura completa ocorre na mesma transacao que elimina staging.
 * - Nao oferece snapshot coerente do SERVIDOR: a API de laboratorio pagina sem
 *   congelar os dados. Nao usar em producao antes de resolver essa lacuna.
 * - tx.read/tx.write/tx.delete devem ser atomicamente serializados e duraveis.
 * - Os dados so podem ser mostrados apos verificar a politica de sessao local,
 *   autorizacao, isolamento e validade do cache.
 */
import { mergeSnapshotPage } from "./merge-snapshot.mjs";

function keyFor(guardaId, entity) {
  if (!Number.isSafeInteger(guardaId) || guardaId <= 0) throw new Error("GCM invalido");
  if (typeof entity !== "string" || !/^[a-z_]{2,70}$/.test(entity)) throw new Error("Entidade invalida");
  return `gcmbs:sync-v2:staged:${guardaId}:${entity}`;
}
function keys(guardaId, entity) {
  const base=keyFor(guardaId, entity);
  return { stage:base+":staging", active:base+":active" };
}
function assertStore(store) {
  if (!store || typeof store.transaction !== "function") throw new TypeError("Transacao obrigatoria");
}
function validateCapture(captureId) {
  if (typeof captureId !== "string" || !/^[A-Za-z0-9_-]{12,96}$/.test(captureId))
    throw new Error("ID de captura invalido");
}
export async function startCapture({ store, guardaId, entity, captureId }) {
  assertStore(store);
  validateCapture(captureId);
  const {stage,active}=keys(guardaId,entity);
  return store.transaction(async tx=>{
    const pending=await tx.read(stage);
    if(pending) {
      if(pending.captureId!==captureId) throw new Error("Captura anterior pendente: resolva antes de iniciar outra");
      return { resumed:true, cursor:pending.cursor, hasActive:!!(await tx.read(active)) };
    }
    await tx.write(stage,{
      captureId, records:new Map(), cursor:null,done:false,
    });
    return { resumed:false, cursor:null, hasActive:!!(await tx.read(active)) };
  });
}
export async function commitCapturePage({
  store, guardaId, entity, captureId, expectedAfterKey=null, response,
}) {
  assertStore(store);
  validateCapture(captureId);
  const {stage,active}=keys(guardaId,entity);
  if(!response || response.contract!=="GCMBS_SYNC_V2_LAB" ||
      response.entity!==entity || response.guarda_id!==guardaId) throw new Error("Resposta de usuario/entidade invalida");
  if(!Array.isArray(response.records) || response.records.length>25 || typeof response.has_more!=="boolean")
    throw new Error("Pagina invalida");
  if(response.has_more && !response.records.length) throw new Error("Mais paginas sem registros");
  let prev=expectedAfterKey;
  for(const row of response.records) {
    if(!row || typeof row.key!=="string" || !row.key || (prev!==null && row.key<=prev))
      throw new Error("Chaves fora de ordem");
    prev=row.key;
  }
  if(response.has_more && response.next_after_key!==prev) throw new Error("Cursor final invalido");
  if(!response.has_more && response.next_after_key!=null) throw new Error("Cursor terminal invalido");
  return store.transaction(async tx=>{
    const pending=await tx.read(stage);
    if(!pending || pending.captureId!==captureId) throw new Error("Captura desatualizada ou inexistente");
    if(pending.cursor!==expectedAfterKey) throw new Error("Checkpoint concorrente ou antigo");
    if(pending.done || !(pending.records instanceof Map)) throw new Error("Captura invalida");
    const delta=mergeSnapshotPage(pending.records,response);
    if(response.has_more) {
      await tx.write(stage,{...pending,records:delta.records,cursor:response.next_after_key});
      return { status:"STAGING",applied:delta.applied,cursor:response.next_after_key };
    }
    // A copia anterior continua intacta em qualquer falha antes do COMMIT desta transacao.
    await tx.write(active,{
      captureId, records:delta.records,
      paginationCompleted:true, serverSnapshotConsistent:false,
    });
    if(typeof tx.delete!=="function") throw new Error("Banco local nao suporta exclusao transacional");
    await tx.delete(stage);
    return { status:"PROMOTED",applied:delta.applied,cursor:null };
  });
}
export async function inspectCapture({ store, guardaId, entity }) {
  assertStore(store);
  const {stage,active}=keys(guardaId,entity);
  return store.transaction(async tx=>{
    const pending=await tx.read(stage);
    const published=await tx.read(active);
    return {
      activeCaptureId:published?.captureId??null,
      paginationCompleted:published?.paginationCompleted===true,
      serverSnapshotConsistent:published?.serverSnapshotConsistent===true,
      activeRecords:published?.records instanceof Map ? published.records.size : 0,
      pendingCaptureId:pending?.captureId??null,
      pendingCursor:pending?.cursor??null,
    };
  });
}
export async function discardStaging({ store, guardaId, entity, captureId }) {
  assertStore(store);
  validateCapture(captureId);
  const {stage}=keys(guardaId,entity);
  return store.transaction(async tx=>{
    const pending=await tx.read(stage);
    if(!pending || pending.captureId!==captureId) return false;
    if(typeof tx.delete!=="function") throw new Error("Banco local nao suporta exclusao transacional");
    await tx.delete(stage);
    return true;
  });
}
