/**
 * GCMBS Sync V2 - politica experimental de acesso offline, SOMENTE LEITURA.
 *
 * APLICACAO REAL AINDA BLOQUEADA:
 * - A funcao verifyLease DEVE validar assinatura/verificacao criptografica com
 *   chave publica confiavel integrada ao aplicativo (nunca aceitar um campo
 *   booleano armazenado no cache como comprovante de permissao).
 * - O token do Supabase nao e prova offline. Nao usar segredo service_role no APK.
 * - O lease deve ser emitido por servico autorizado e conter ligacao ao aparelho,
 *   usuario, permissoes, revisao de ACL e prazo. Revogacao pode nao chegar offline.
 * - O armazenamento de dados privados requer criptografia e desbloqueio local.
 * - "CACHE_STALE" e "NOT_AUTHORIZED" nao sao equivalentes.
 */
const HOUR = 60 * 60 * 1000;
export const CLASSIFICATION = Object.freeze({
  PUBLIC: "PUBLIC",
  INSTITUTIONAL: "INSTITUTIONAL",
  PERSONAL: "PERSONAL",
  SENSITIVE: "SENSITIVE",
});
// Sao limites conservadores EXPERIMENTAIS, nao decisao final da GCMBS.
const MAX_OFFLINE_AGE = Object.freeze({
  INSTITUTIONAL: 72 * HOUR,
  PERSONAL: 24 * HOUR,
  SENSITIVE: 6 * HOUR,
});
function validPositiveId(id) {
  return Number.isSafeInteger(id) && id > 0;
}
function safeTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ?
    Date.parse(value) : NaN;
}
export async function authorizeOfflineRead({
  guardaId,
  deviceId,
  classification,
  entity,
  nowMs,
  lease,
  verifiedLease,
  verifyLease,
  lastSyncAt,
  requireConsistentSnapshot = false,
  serverSnapshotConsistent = false,
} = {}) {
  // O retorno NAO contem dados ou credenciais.
  const deny = reason => Object.freeze({allowed:false,reason,stale:true});
  if (!validPositiveId(guardaId) || typeof deviceId !== "string" || deviceId.length < 12)
    return deny("INVALID_CONTEXT");
  if (typeof entity !== "string" || !/^[a-z_]{2,70}$/.test(entity))
    return deny("INVALID_ENTITY");
  if (!Number.isFinite(nowMs)) return deny("INVALID_CLOCK");
  if (!Object.values(CLASSIFICATION).includes(classification)) return deny("INVALID_CLASSIFICATION");
  if (classification === CLASSIFICATION.PUBLIC) {
    // O conteudo PUBLICO deve ser efetivamente publicado por uma fonte
    // aberta autorizada. Este guard nao autoriza divulga-lo publicamente.
    return deny("PUBLIC_REQUIRES_SEPARATE_POLICY");
  }
  if (!lease || typeof lease !== "object" || typeof verifyLease !== "function")
    return deny("UNVERIFIED_LEASE");
  if (verifiedLease !== undefined) return deny("UNTRUSTED_VERIFICATION_FLAG");
  let verified = false;
  try {
    // Verificador externo usa assinatura + chave publica pinada ao aplicativo.
    // Retorna true SOMENTE se a autenticidade de TODO objeto lease for comprovada.
    verified = (await verifyLease(lease)) === true;
  } catch {
    return deny("VERIFICATION_ERROR");
  }
  if (!verified) return deny("INVALID_SIGNATURE");
  if (lease.guardaId !== guardaId || lease.deviceId !== deviceId)
    return deny("LEASE_SUBJECT_MISMATCH");
  if (!Array.isArray(lease.entities) || !lease.entities.includes(entity))
    return deny("ENTITY_NOT_AUTHORIZED");
  const issuedAt = safeTimestamp(lease.issuedAt);
  const expiresAt = safeTimestamp(lease.expiresAt);
  const lastSyncMs = safeTimestamp(lastSyncAt);
  if (![issuedAt, expiresAt, lastSyncMs].every(Number.isFinite))
    return deny("INVALID_TIMESTAMPS");
  if (issuedAt > nowMs || expiresAt <= issuedAt || nowMs >= expiresAt)
    return deny("LEASE_EXPIRED");
  if (lastSyncMs > nowMs || lastSyncMs < issuedAt)
    return deny("INVALID_LAST_SYNC");
  const offlineAgeMs = nowMs - lastSyncMs;
  if (offlineAgeMs > MAX_OFFLINE_AGE[classification])
    return deny("CACHE_STALE");
  if (requireConsistentSnapshot && serverSnapshotConsistent !== true)
    return deny("SNAPSHOT_NOT_CONSISTENT");
  return Object.freeze({
    allowed:true, reason:"AUTHORIZED_CACHED_READ", stale:offlineAgeMs>0,
    lastSyncAt, expiresAt:lease.expiresAt, consistencyVerified:serverSnapshotConsistent===true,
  });
}
