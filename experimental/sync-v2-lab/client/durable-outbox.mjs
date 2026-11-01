/**
 * GCMBS Sync V2 — registro transacional experimental da fila offline.
 *
 * Dependencias de armazenamento, rede e geracao de ID sao injetadas.
 * Nao utiliza servicos externos nem grava dados operacionais.
 *
 * CONTRATO DO DRIVER:
 *   store.transaction(async tx => { tx.read(key), tx.write(key,value) })
 * O driver REAL deve serializar escritas concorrentes por chave, confirmar
 * DURAVELMENTE todas as alteracoes ao final e fazer ROLLBACK no erro.
 * Nao confundir ACK de recebimento com aprovacao do Comando.
 *
 * IMPORTANTE: nao autoriza novas modalidades de permuta nem altera saldos.
 * Exige idempotencia transacional correspondente no servidor/desktop.
 */
import {
  STATES, newPendingOperation, prepareRetry,
  acknowledgeServer, finalizeAfterReconciliation,
} from "./offline-outbox-state.mjs";

function validUser(guardaId) {
  if (!Number.isSafeInteger(guardaId) || guardaId <= 0) throw new Error("GCM invalido");
  return guardaId;
}
function validChangeId(id) {
  if (typeof id !== "string" || !/^[0-9a-fA-F-]{20,80}$/.test(id))
    throw new Error("client_change_id invalido");
  return id;
}
export function outboxKey(guardaId, clientChangeId) {
  return `gcmbs:outbox-v2:${validUser(guardaId)}:${validChangeId(clientChangeId)}`;
}
function verifyStore(store) {
  if (!store || typeof store.transaction !== "function") throw new TypeError("store transacional obrigatorio");
}
function matchesOriginal(current, fresh) {
  // Identificador reutilizado para operacao DIFERENTE deve gerar conflito.
  // O servidor ainda precisa rejeitar a mesma duplicidade em sua propria fila.
  return current.guarda_id === fresh.guarda_id
    && current.client_change_id === fresh.client_change_id
    && current.type === fresh.type
    && current.created_at === fresh.created_at
    && JSON.stringify(current.payload) === JSON.stringify(fresh.payload);
}
export async function enqueueDurably({store, ...newRequest}) {
  verifyStore(store);
  const candidate = newPendingOperation(newRequest);
  const key = outboxKey(candidate.guarda_id,candidate.client_change_id);
  return store.transaction(async tx => {
    const existing = await tx.read(key);
    if (existing) {
      if (!matchesOriginal(existing,candidate))
        throw new Error("Identificador reutilizado com payload diferente");
      return { record:existing, inserted:false };
    }
    await tx.write(key,candidate);
    return { record:candidate, inserted:true };
  });
}
export async function loadDurably({store,guardaId,clientChangeId}) {
  verifyStore(store);
  const key=outboxKey(guardaId,clientChangeId);
  const result=await store.transaction(tx => tx.read(key));
  return result ?? null;
}
export async function markAttemptDurably({store,guardaId,clientChangeId}) {
  verifyStore(store);
  const key=outboxKey(guardaId,clientChangeId);
  return store.transaction(async tx => {
    const current=await tx.read(key);
    if (!current || current.guarda_id!==guardaId) throw new Error("Operacao ausente");
    const next=prepareRetry(current);
    await tx.write(key,next);
    return next;
  });
}
export async function acknowledgeDurably({
  store, guardaId, clientChangeId, serverId, pendingDesktop=false,
}) {
  verifyStore(store);
  const key=outboxKey(guardaId,clientChangeId);
  return store.transaction(async tx => {
    const current=await tx.read(key);
    if (!current || current.guarda_id!==guardaId) throw new Error("Operacao ausente");
    // ACK repetido para estado terminal nao pode reabrir a solicitacao.
    if ([STATES.FINAL_CONFIRMED, STATES.REJECTED, STATES.CONFLICT].includes(current.status)) {
      if (current.server_id!==serverId) throw new Error("Identidade oficial divergente");
      return { record:current,duplicate:true };
    }
    const next=acknowledgeServer(current,{clientChangeId,serverId,pendingDesktop});
    await tx.write(key,next);
    return { record:next,duplicate:current.server_id===serverId };
  });
}
export async function finalizeDurably({store,guardaId,clientChangeId,serverId,outcome}) {
  verifyStore(store);
  const key=outboxKey(guardaId,clientChangeId);
  return store.transaction(async tx => {
    const current=await tx.read(key);
    if (!current || current.guarda_id!==guardaId) throw new Error("Operacao ausente");
    const terminal = outcome==="CONFIRMED"?STATES.FINAL_CONFIRMED:
      outcome==="REJECTED"?STATES.REJECTED:
      outcome==="CONFLICT"?STATES.CONFLICT:null;
    if (!terminal) throw new Error("Resultado desconhecido");
    // Somente repeticao identica do MESMO resultado final e aceitavel.
    if ([STATES.FINAL_CONFIRMED,STATES.REJECTED,STATES.CONFLICT].includes(current.status)) {
      if (current.server_id!==serverId || current.status!==terminal)
        throw new Error("Resultado oficial conflitante: conciliacao manual");
      return { record:current,duplicate:true };
    }
    const next=finalizeAfterReconciliation(current,{serverId,outcome});
    await tx.write(key,next);
    return { record:next,duplicate:false };
  });
}
