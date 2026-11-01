/**
 * GCMBS Sync V2 - motor experimental de leitura paginada.
 * Funcoes de rede e banco injetadas para permitir testes sem usar producao.
 * NAO deve substituir ainda a API principal nem sincronizacao oficial.
 */
import { commitSnapshotPage } from "./atomic-page-commit.mjs";
import { ReadRetryGate } from "./read-retry-gate.mjs";

function ensureUserAndEntity(guardaId, entity) {
  if (!Number.isSafeInteger(guardaId) || guardaId <= 0) throw new Error("GCM invalido");
  if (typeof entity !== "string" || !/^[a-z_]{2,70}$/.test(entity)) throw new Error("Entidade invalida");
}
export async function resumeBootstrap({
  store,
  fetchPage,
  guardaId,
  entity,
  gate = new ReadRetryGate(),
  maxPages = 3,
  maxResponseBytes = 128 * 1024,
} = {}) {
  ensureUserAndEntity(guardaId, entity);
  if (!store || typeof store.transaction !== "function") throw new TypeError("store transacional obrigatorio");
  if (typeof fetchPage !== "function") throw new TypeError("fetchPage obrigatorio");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10) throw new Error("maxPages invalido");
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1024 || maxResponseBytes > 256 * 1024)
    throw new Error("maxResponseBytes invalido");

  const key = `gcmbs:sync-v2:${guardaId}:${entity}`;
  let committed = 0, applied = 0;
  for (; committed < maxPages;) {
    // Uma operacao presencial/manualmente iniciada segue fluxo diferente.
    // Este bloqueio aplica-se SOMENTE a leitura automatica do bootstrap.
    if (!gate.automaticReadAllowed()) {
      return { status:"BLOCKED", pages:committed, applied, retryInMs:gate.remainingMs() };
    }
    const state = await store.transaction(tx => tx.read(key));
    if (state?.done === true) return { status:"COMPLETE", pages:committed, applied };
    const cursor = state?.cursor ?? null;
    let response;
    try {
      response = await fetchPage({ entity, guardaId, afterKey:cursor, limit:25 });
    } catch (error) {
      const code=Number(error?.status || error?.httpStatus || 0);
      const retryInMs = gate.fail({ status:code, retryAfterMs:error?.retryAfterMs ?? null });
      // Nao remover sessao, registros ou cursor depois de timeout/402.
      return { status:code===401||code===403?"AUTH_REQUIRED":"UNAVAILABLE",
        pages:committed,applied,retryInMs };
    }
    const size = new TextEncoder().encode(JSON.stringify(response)).length;
    if (size > maxResponseBytes) throw new Error("Resposta acima do limite local");
    const result = await commitSnapshotPage({
      store, response, guardaId, entity, expectedAfterKey:cursor,
    });
    gate.success();
    committed++;
    applied+=result.applied;
    if (result.done) return { status:"COMPLETE", pages:committed, applied };
  }
  return { status:"MORE_PAGES",pages:committed,applied };
}
