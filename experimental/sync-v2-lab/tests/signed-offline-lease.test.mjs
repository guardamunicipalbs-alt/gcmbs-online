import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { authorizeSignedOfflineRead,verifySignedOfflineLease,_signedBytesForContractTests } from "../client/signed-offline-lease.mjs";
const subtle=webcrypto.subtle;
const issuedAt="2026-11-01T09:00:00.000Z";
const expiresAt="2026-11-03T09:00:00.000Z";
const nowMs=Date.parse("2026-11-01T12:00:00.000Z");
const deviceId="android-device-test-001";
let pair,trust;
test.before(async()=>{
  pair=await subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]);
  const jwk=await subtle.exportKey("jwk",pair.publicKey);
  // A chave PRIVADA nao sai deste teste nem do runner.
  trust=Object.freeze({"institutional-test-key":jwk});
});
function claims(){
  return {
    issuer:"GCMBS",audience:"gcmbs-android-offline",guardaId:7,
    deviceId,entities:["escalas","permutas"],
    classifications:{escalas:"PERSONAL",permutas:"SENSITIVE"},aclRevision:12,
    issuedAt,expiresAt,
  };
}
async function signedLease(changes={}){
  const envelope={version:1,alg:"ES256",keyId:"institutional-test-key",
    claims:{...claims(),...changes},signature:""};
  const bytes=_signedBytesForContractTests(envelope);
  const sig=new Uint8Array(await subtle.sign({name:"ECDSA",hash:"SHA-256"},pair.privateKey,bytes));
  envelope.signature=Buffer.from(sig).toString("base64url");
  return envelope;
}
const context=()=>({
  guardaId:7,deviceId,entity:"escalas",classification:"PERSONAL",
  nowMs,lastSyncAt:"2026-11-01T10:00:00.000Z",
  lastKnownAclRevision:12,trustedJwks:trust,subtle,
});
test("lease assinado ES256 autoriza leitura pessoal valida",async()=>{
  const lease=await signedLease();
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:trust,subtle}),true);
  const result=await authorizeSignedOfflineRead({...context(),signedLease:lease});
  assert.equal(result.allowed,true);
});
test("mudanca de GCM apos assinatura invalida criptografia",async()=>{
  const lease=await signedLease();
  lease.claims.guardaId=9;
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:trust,subtle}),false);
  const result=await authorizeSignedOfflineRead({...context(),signedLease:lease});
  assert.equal(result.allowed,false);
});
test("adulteracao da lista de entidades invalida a assinatura",async()=>{
  const lease=await signedLease();
  lease.claims.entities=["banco_horas_movimentacoes","escalas","permutas"];
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:trust,subtle}),false);
});
test("kid e algoritmo desconhecidos nao sao aceitos",async()=>{
  const lease=await signedLease();
  assert.equal(await verifySignedOfflineLease({...lease,keyId:"unauthorized"},{trustedJwks:trust,subtle}),false);
  assert.equal(await verifySignedOfflineLease({...lease,alg:"none"},{trustedJwks:trust,subtle}),false);
});
test("chave privada nunca e aceita como fonte JWK de verificacao",async()=>{
  const lease=await signedLease();
  // A chave publica do teste e valida. O material privado nao pode entrar em trustedJwks.
  const jwk=await subtle.exportKey("jwk",pair.publicKey);
  const malformed={...jwk,d:"NOT_ALLOWED"};
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:{"institutional-test-key":malformed},subtle}),false);
});
test("outro aparelho nao pode ler cache do GCM titular",async()=>{
  const lease=await signedLease();
  const result=await authorizeSignedOfflineRead({
    ...context(),deviceId:"android-device-test-002",signedLease:lease,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,"LEASE_SUBJECT_MISMATCH");
});
test("revogacao observada pela revisao de ACL impede leitura",async()=>{
  const lease=await signedLease();
  const result=await authorizeSignedOfflineRead({
    ...context(),lastKnownAclRevision:13,signedLease:lease,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,"ACL_REVISION_MISMATCH");
});
test("sem revisao confiavel de ACL acesso e negado",async()=>{
  const lease=await signedLease();
  const result=await authorizeSignedOfflineRead({
    ...context(),lastKnownAclRevision:undefined,signedLease:lease,
  });
  assert.equal(result.allowed,false);
});
test("lease expirado nunca autoriza leitura",async()=>{
  const lease=await signedLease();
  const result=await authorizeSignedOfflineRead({
    ...context(),nowMs:Date.parse("2026-11-05T12:00:00.000Z"),signedLease:lease,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,"LEASE_EXPIRED");
});
test("nao admite sequer assinar lease acima do limite de 72 horas",async()=>{
  await assert.rejects(
    signedLease({expiresAt:"2026-11-06T12:00:00.000Z"}),
    /Claims invalidas/
  );
});
test("claims extras nao assinadas sao rejeitadas",async()=>{
  const lease=await signedLease();
  lease.claims.isAdmin=true;
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:trust,subtle}),false);
});
test("envelope com atributos inesperados rejeitado",async()=>{
  const lease=await signedLease();
  lease.unsafeOverride=true;
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:trust,subtle}),false);
});
test("entidades duplicadas ou sem ordem canonica rejeitadas",async()=>{
  const lease=await signedLease();
  lease.claims.entities=["permutas","escalas"];
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:trust,subtle}),false);
});
test("nao permitir ser usada como aprovacao de permuta offline",async()=>{
  const lease=await signedLease();
  const r=await authorizeSignedOfflineRead({
    ...context(),entity:"autorizar_permuta",signedLease:lease,
  });
  assert.equal(r.allowed,false);
});

test("categoria de dados alterada depois da assinatura e rejeitada",async()=>{
  const lease=await signedLease();
  lease.claims.classifications.escalas="INSTITUTIONAL";
  assert.equal(await verifySignedOfflineLease(lease,{trustedJwks:trust,subtle}),false);
});
test("chamador nao pode ampliar prazo de dados pessoais como institucionais",async()=>{
  const lease=await signedLease();
  const result=await authorizeSignedOfflineRead({
    ...context(),classification:"INSTITUTIONAL",signedLease:lease,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,"CLASSIFICATION_MISMATCH");
});
test("entidade sensivel assinada adota prazo de 6 horas, nao 24",async()=>{
  const lease=await signedLease({issuedAt:"2026-10-31T18:00:00.000Z"});
  const result=await authorizeSignedOfflineRead({
    ...context(),entity:"permutas",classification:"SENSITIVE",
    lastSyncAt:"2026-11-01T04:00:00.000Z",signedLease:lease,
  });
  assert.equal(result.allowed,false);
  assert.equal(result.reason,"CACHE_STALE");
});
test("lista e classificacoes divergentes nunca geram lease valido",async()=>{
  await assert.rejects(
    signedLease({classifications:{escalas:"PERSONAL"}}),
    /Claims invalidas/
  );
});
