/**
 * GCMBS Sync V2 — verificador EXPERIMENTAL de lease OFFLINE de leitura.
 *
 * Somente a chave PUBLICA (SPKI/JWK sem "d") pode ser embutida no APK.
 * Chaves privadas NUNCA devem ir para cliente, GitHub ou Edge Function fonte.
 * O emissor real e a revogacao de permissoes nao estao implementados.
 *
 * O verificador recusa assinaturas invalidas, alg diferente de ES256, chave
 * desconhecida, claims extras, dispositivos diferentes e revisao ACL antiga.
 * Android deve usar uma origem confiavel para trustedKeys e lastKnownAclRevision.
 * Nao habilitar acesso offline por periodo longo enquanto nao houver politica
 * institucional de validade, relogio e revogacao de acesso.
 */
import { authorizeOfflineRead } from "./offline-view-policy.mjs";

const FORMAT_VERSION=1;
const EXPECTED_ISSUER="GCMBS";
const EXPECTED_AUDIENCE="gcmbs-android-offline";
const MAX_DURATION_MS=72*60*60*1000;
const FIELDS=["issuer","audience","guardaId","deviceId","entities",
              "classifications","aclRevision","issuedAt","expiresAt"];
const CLASSIFICATION_LEVELS=["INSTITUTIONAL","PERSONAL","SENSITIVE"];
const HEADER_FIELDS=["version","alg","keyId","claims","signature"];
const textEncoder=new TextEncoder();

function exactFields(obj, names) {
  if(!obj || typeof obj!=="object" || Array.isArray(obj)) return false;
  const actual=Object.keys(obj);
  return actual.length===names.length && actual.every(k=>names.includes(k));
}
function validDate(s) {
  if(typeof s!=="string" ||
     !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)) return false;
  const ms=Date.parse(s);
  return Number.isFinite(ms) && new Date(ms).toISOString()===s;
}
function validClaims(claims) {
  if(!exactFields(claims,FIELDS)) return false;
  if(claims.issuer!==EXPECTED_ISSUER || claims.audience!==EXPECTED_AUDIENCE) return false;
  if(!Number.isSafeInteger(claims.guardaId) || claims.guardaId<=0 ||
     !Number.isSafeInteger(claims.aclRevision) || claims.aclRevision<1) return false;
  if(typeof claims.deviceId!=="string" ||
     !/^[A-Za-z0-9._:-]{12,128}$/.test(claims.deviceId)) return false;
  if(!Array.isArray(claims.entities) || claims.entities.length<1 || claims.entities.length>50 ||
     !claims.entities.every(e=>typeof e==="string" && /^[a-z_]{2,70}$/.test(e))) return false;
  // Enforce uma unica representacao canonica das permissoes.
  const canonical=[...new Set(claims.entities)].sort();
  if(JSON.stringify(canonical)!==JSON.stringify(claims.entities)) return false;
  if(!claims.classifications || typeof claims.classifications!=="object" ||
     Array.isArray(claims.classifications)) return false;
  const classKeys=Object.keys(claims.classifications).sort();
  if(JSON.stringify(classKeys)!==JSON.stringify(canonical)) return false;
  if(!canonical.every(entity=>CLASSIFICATION_LEVELS.includes(claims.classifications[entity])))
    return false;
  if(!validDate(claims.issuedAt) || !validDate(claims.expiresAt)) return false;
  const duration=Date.parse(claims.expiresAt)-Date.parse(claims.issuedAt);
  return duration>0 && duration<=MAX_DURATION_MS;
}
function base64urlBytes(value) {
  if(typeof value!=="string" || !/^[A-Za-z0-9_-]{86}$/.test(value)) return null;
  try {
    const base64=value.replace(/-/g,"+").replace(/_/g,"/");
    const bytes=Uint8Array.from(atob(base64+"=="),x=>x.charCodeAt(0));
    if(bytes.length!==64)return null;
    let raw="";
    for(const b of bytes)raw+=String.fromCharCode(b);
    const canonical=btoa(raw).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
    return canonical===value ? bytes : null;
  } catch { return null; }
}
function signedBytes(envelope) {
  // Campos fixos e ordenados; nenhum dado extra e incorporado silenciosamente.
  const claims={};
  for(const key of FIELDS) {
    if(key==="classifications") {
      // Canoniza a ordem das chaves para assinaturas identicas entre JS/Android.
      claims[key]=Object.fromEntries(
        envelope.claims.entities.map(entity=>[entity,envelope.claims.classifications[entity]])
      );
    } else claims[key]=envelope.claims[key];
  }
  const canonical=JSON.stringify({
    version:FORMAT_VERSION,alg:"ES256",keyId:envelope.keyId,claims,
  });
  return textEncoder.encode("GCMBS_OFFLINE_LEASE_V1\n"+canonical);
}
/**
 * Retorna true somente para documento genuinamente assinado por uma das
 * chaves confiaveis aprovadas. trustedJwks e de origem EMBUTIDA e protegida
 * da aplicacao; NUNCA aceita de uma resposta de rede.
 */
export async function verifySignedOfflineLease(envelope,{
  trustedJwks,
  subtle=globalThis.crypto?.subtle,
}={}) {
  if(!exactFields(envelope,HEADER_FIELDS) ||
     envelope.version!==FORMAT_VERSION || envelope.alg!=="ES256" ||
     typeof envelope.keyId!=="string" || !/^[A-Za-z0-9._-]{1,48}$/.test(envelope.keyId) ||
     !validClaims(envelope.claims) || !subtle) return false;
  const signature=base64urlBytes(envelope.signature);
  if(!signature) return false;
  if(!trustedJwks || typeof trustedJwks!=="object" ||
     !Object.prototype.hasOwnProperty.call(trustedJwks,envelope.keyId)) return false;
  const jwk=trustedJwks[envelope.keyId];
  if(!jwk || jwk.kty!=="EC" || jwk.crv!=="P-256" ||
     typeof jwk.d!=="undefined" || typeof jwk.x!=="string" ||
     typeof jwk.y!=="string") return false;
  try {
    const key=await subtle.importKey(
      "jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]
    );
    return await subtle.verify(
      {name:"ECDSA",hash:"SHA-256"},key,signature,signedBytes(envelope)
    )===true;
  }catch { return false; }
}
/**
 * Integra o verificador com a politica de leitura. O usuario e a entidade
 * devem vir do CONTEXTO ATIVO do aplicativo, nunca do registro em cache.
 *
 * lastKnownAclRevision deve vir de estado confiavel; se for simplesmente
 * obtido do proprio envelope ele nao oferece protecao contra revogacao.
 */
export async function authorizeSignedOfflineRead({
  signedLease, trustedJwks, lastKnownAclRevision, subtle,
  ...requestContext
}={}) {
  const deny=reason=>Object.freeze({allowed:false,reason,stale:true});
  if(!Number.isSafeInteger(lastKnownAclRevision) || lastKnownAclRevision<1)
    return deny("MISSING_TRUSTED_ACL_REVISION");
  if(!signedLease || !validClaims(signedLease.claims))
    return deny("INVALID_LEASE");
  if(signedLease.claims.aclRevision!==lastKnownAclRevision)
    return deny("ACL_REVISION_MISMATCH");
  const claims=signedLease.claims;
  const permittedClassification=claims.classifications[requestContext.entity];
  if(!CLASSIFICATION_LEVELS.includes(permittedClassification))
    return deny("UNCLASSIFIED_ENTITY");
  // O chamador nao pode reclassificar "SENSITIVE" como "INSTITUTIONAL".
  if(requestContext.classification!==undefined &&
     requestContext.classification!==permittedClassification)
    return deny("CLASSIFICATION_MISMATCH");
  return authorizeOfflineRead({
    ...requestContext,
    guardaId:requestContext.guardaId,
    deviceId:requestContext.deviceId,
    classification:permittedClassification,
    lease:claims,
    verifyLease:async candidate=>
      candidate===claims && await verifySignedOfflineLease(
        signedLease,{trustedJwks,subtle}
      ),
  });
}

/** Somente testes: exposicao de bytes assinaveis. Nao assina e nao gera keys. */
export function _signedBytesForContractTests(envelope) {
  if(!envelope || !validClaims(envelope.claims)) throw Error("Claims invalidas");
  return signedBytes(envelope);
}
