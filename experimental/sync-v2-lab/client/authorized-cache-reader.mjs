/**
 * GCMBS Sync V2 — barreira experimental de leitura do cache OFFLINE.
 * Nao realiza I/O e nao integra o aplicativo de producao.
 *
 * - O cache so e liberado apos autenticacao LOCAL do operador e verificacoes
 *   de lease assinado, versao ACL, relogio confiavel e atestacao criptografica
 *   de snapshot consistente assinada pelo servidor.
 * - Nenhum callback de verificacao deve ser implementado como `()=>true`
 *   no Android. As dependencias sao injetadas para permitir teste sem acesso
 *   ao GCMBS real.
 * - O laboratorio Sync V2 NAO produz atestacoes de captura; portanto o
 *   bootstrap atual nao consegue satisfazer este contrato em producao.
 * - Uso de dados sensiveis, permissoes e cache offline exige politica formal.
 */
import { authorizeSignedOfflineRead } from "./signed-offline-lease.mjs";

function fail(reason) {
  return Object.freeze({ok:false, reason, records:[], stale:true});
}
function requireDeviceKey(guardaId,entity) {
  if(!Number.isSafeInteger(guardaId)||guardaId<1)throw Error("GCM invalido");
  if(typeof entity!=="string"||!/^[a-z_]{2,70}$/.test(entity))throw Error("Entidade invalida");
  return `gcmbs:sync-v2:staged:${guardaId}:${entity}:active`;
}
function stableRecordRows(state,entity) {
  if(!(state.records instanceof Map) || state.records.size>5000)throw Error("CACHE_CORRUPTED");
  const prefix=entity+":", output=[];
  for(const [key,row] of state.records) {
    if(typeof key!=="string" || !key.startsWith(prefix) ||
       !row || typeof row!=="object" || !/^[1-9][0-9]*$/.test(String(row.revision)))
      throw Error("CACHE_CORRUPTED");
    if(row.deleted===true) {
      if(row.data!==null)throw Error("CACHE_CORRUPTED");
      continue;
    }
    if(row.deleted!==false || !row.data || typeof row.data!=="object" || Array.isArray(row.data))
      throw Error("CACHE_CORRUPTED");
    output.push({key:key.slice(prefix.length),revision:String(row.revision),
      data:structuredClone(row.data)});
  }
  return output;
}

/**
 * `deviceUnlock`: resultado de autenticacao local, sem ser obtido de campos
 * manipulaveis do cache. Deve comprovar o proprio aparelho e a sessao atual.
 * `trustedClock`: obtém horario monotônico protegido por plataforma; nao
 * confiar apenas em Date.now() em dispositivo com relógio retrocedido.
 * `verifySnapshot`: valida assinatura do servidor + digest da captura, GCM,
 * entidade, captureId e autenticidade do watermark. Nao usar boolean de
 * cache como prova. O servidor ainda precisa implementar esse contrato.
 */
export async function readAuthorizedOfflineCache({
  store,guardaId,deviceId,entity,
  deviceUnlock,trustedClock,verifySnapshot,
  signedLease,trustedJwks,lastKnownAclRevision,
  lastSyncAt,attestation,subtle,
}={}) {
  const cacheKey=requireDeviceKey(guardaId,entity);
  if(!store || typeof store.transaction!=="function")return fail("STORE_UNAVAILABLE");
  if(typeof deviceUnlock!=="function")return fail("LOCAL_UNLOCK_REQUIRED");
  if(typeof trustedClock!=="function")return fail("TRUSTED_CLOCK_REQUIRED");
  if(typeof verifySnapshot!=="function")return fail("SNAPSHOT_VERIFIER_REQUIRED");

  let unlocked=false,nowMs=NaN;
  try {
    unlocked=(await deviceUnlock({guardaId,deviceId}))===true;
    if(!unlocked)return fail("LOCAL_UNLOCK_DENIED");
    nowMs=await trustedClock();
    if(!Number.isFinite(nowMs))return fail("CLOCK_UNTRUSTED");
  }catch {return fail("LOCAL_SECURITY_ERROR")}

  // Não ler dados antes de validar o lease assinado.
  const access=await authorizeSignedOfflineRead({
    signedLease,trustedJwks,lastKnownAclRevision,subtle,
    guardaId,deviceId,entity,nowMs,lastSyncAt,
    requireConsistentSnapshot:true,serverSnapshotConsistent:true,
  });
  if(!access.allowed)return fail(access.reason);

  try {
    return await store.transaction(async tx=>{
      const active=await tx.read(cacheKey);
      if(!active)return fail("CACHE_MISSING");
      if(active.paginationCompleted!==true ||
         active.serverSnapshotConsistent!==true ||
         typeof active.captureId!=="string" || !active.captureId)
        return fail("CAPTURE_NOT_VERIFIED");
      if(!attestation || typeof attestation!=="object" ||
         attestation.captureId!==active.captureId ||
         attestation.guardaId!==guardaId ||
         attestation.entity!==entity)
        return fail("CAPTURE_ATTESTATION_MISMATCH");
      // A verificação real DEVE incluir hash dos registros em 'active'.
      const proven=await verifySnapshot({
        attestation,active,guardaId,entity,deviceId,
      });
      if(proven!==true)return fail("CAPTURE_ATTESTATION_INVALID");
      const data=stableRecordRows(active,entity);
      return Object.freeze({ok:true,reason:"AUTHORIZED_OFFLINE",
        records:data,stale:access.stale,asOf:lastSyncAt});
    });
  }catch {return fail("CACHE_READ_ERROR")}
}
