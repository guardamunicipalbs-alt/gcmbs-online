import test from "node:test";
import assert from "node:assert/strict";
import {webcrypto} from "node:crypto";
import {
  snapshotDigest, verifySnapshotAttestation, _snapshotSignatureBytesForTests,
} from "../client/snapshot-attestation.mjs";
import {_signedBytesForContractTests} from "../client/signed-offline-lease.mjs";
import {readAuthorizedOfflineCache} from "../client/authorized-cache-reader.mjs";

const subtle=webcrypto.subtle;
const nowMs=Date.parse("2026-11-01T12:00:00.000Z");
const deviceId="gcmbs-test-android-01";
const cacheKey="gcmbs:sync-v2:staged:7:escalas:active";
const captureId="capture_ficticio_20261101";
let keypair, trustedJwks;
test.before(async()=>{
  keypair=await subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},false,["sign","verify"]);
  trustedJwks={"institutional-test":await subtle.exportKey("jwk",keypair.publicKey)};
});
const b64=buffer=>Buffer.from(buffer).toString("base64url");
function activeState() {
  return {
    captureId,paginationCompleted:true,serverSnapshotConsistent:true,
    records:new Map([
      ["escalas:001",{revision:"1",deleted:false,updated_at:"2026-11-01T10:00:00.000Z",
        data:{turno:"A",nome_guerra:"EXEMPLO"}}],
      ["escalas:002",{revision:"2",deleted:true,updated_at:"2026-11-01T10:00:00.000Z",
        data:null}],
    ]),
  };
}
async function signBody(envelope,bytes) {
  const sig=await subtle.sign({name:"ECDSA",hash:"SHA-256"},keypair.privateKey,bytes);
  return {...envelope,signature:b64(sig)};
}
async function lease() {
  const base={
    version:1,alg:"ES256",keyId:"institutional-test",
    claims:{
      issuer:"GCMBS",audience:"gcmbs-android-offline",
      guardaId:7,deviceId,entities:["escalas"],
      classifications:{escalas:"PERSONAL"},aclRevision:12,
      issuedAt:"2026-11-01T10:00:00.000Z",
      expiresAt:"2026-11-02T10:00:00.000Z",
    },
  };
  return signBody(base,_signedBytesForContractTests(base));
}
async function proof(active=activeState()){
  const base={
    version:1,alg:"ES256",keyId:"institutional-test",
    claims:{
      issuer:"GCMBS",audience:"gcmbs-sync-snapshot",
      guardaId:7,deviceId,entity:"escalas",captureId,
      recordsDigest:await snapshotDigest(active,"escalas",subtle),
      issuedAt:"2026-11-01T11:00:00.000Z",expiresAt:"2026-11-01T17:00:00.000Z",
    },
  };
  return signBody(base,_snapshotSignatureBytesForTests(base));
}
function store(active){
  const data=new Map([[cacheKey,active]]);
  return {async transaction(fn){return fn({read:async key=>data.get(key)});}};
}
async function read({active=activeState(),signedLease,attestation,guard=7,device=deviceId,
  unlock=async()=>true,clock=async()=>nowMs,aclRevision=12,
  lastSync="2026-11-01T11:00:00.000Z"}={}){
  return readAuthorizedOfflineCache({
    store:store(active),guardaId:guard,deviceId:device,entity:"escalas",
    deviceUnlock:unlock,trustedClock:clock,
    signedLease:signedLease??await lease(),trustedJwks,
    lastKnownAclRevision:aclRevision,lastSyncAt:lastSync,
    attestation:attestation??await proof(active),subtle,

  });
}
test("assinatura de snapshot valida e digest correto",async()=>{
  const active=activeState(),attestation=await proof(active);
  assert.equal(await verifySnapshotAttestation({
    attestation,active,guardaId:7,deviceId,entity:"escalas",nowMs,trustedJwks,subtle,
  }),true);
});
test("recusa alteracao silenciosa de dados apos assinatura",async()=>{
  const active=activeState(),attestation=await proof(active);
  active.records.get("escalas:001").data.turno="B";
  const result=await read({active,attestation});
  assert.equal(result.ok,false);
  assert.equal(result.reason,"CAPTURE_ATTESTATION_INVALID");
  assert.equal(result.records.length,0);
});
test("tombstones nao reaparecem na consulta offline",async()=>{
  const r=await read();
  assert.equal(r.ok,true);
  assert.equal(r.records.length,1);
  assert.equal(r.records[0].key,"001");
  assert.equal(r.records[0].data.turno,"A");
});
test("snapshot incompleto jamais e exibido",async()=>{
  const active=activeState();active.paginationCompleted=false;
  const r=await read({active});
  assert.equal(r.ok,false);
  assert.equal(r.reason,"CAPTURE_NOT_VERIFIED");
});
test("snapshot paginado do laboratorio nao passa por consistente",async()=>{
  const active=activeState();active.serverSnapshotConsistent=false;
  const r=await read({active});
  assert.equal(r.ok,false);
  assert.equal(r.records.length,0);
});
test("outro aparelho nao recebe os dados",async()=>{
  const r=await read({device:"gcmbs-test-android-02"});
  assert.equal(r.ok,false);
  assert.equal(r.records.length,0);
});
test("outra revisao de permissao bloqueia acesso",async()=>{
  const r=await read({aclRevision:13});
  assert.equal(r.reason,"ACL_REVISION_MISMATCH");
});
test("sem desbloqueio local nao ha leitura",async()=>{
  const r=await read({unlock:async()=>false});
  assert.equal(r.reason,"LOCAL_UNLOCK_DENIED");
});
test("sem relogio confiavel nao ha leitura",async()=>{
  const r=await read({clock:null});
  assert.equal(r.reason,"TRUSTED_CLOCK_REQUIRED");
});
test("lease expirado nao autoriza consulta",async()=>{
  const r=await read({clock:async()=>Date.parse("2026-11-05T00:00:00.000Z")});
  assert.equal(r.ok,false);
  assert.equal(r.reason,"LEASE_EXPIRED");
});
test("atestacao de captura de outro GCM e rejeitada",async()=>{
  const attestation=await proof();
  attestation.claims.guardaId=8;
  const r=await read({attestation});
  assert.equal(r.ok,false);
  assert.equal(r.records.length,0);
});
test("assinatura de atestacao adulterada e rejeitada",async()=>{
  const attestation=await proof();
  attestation.signature=attestation.signature.slice(0,-1)+(attestation.signature.endsWith("A")?"B":"A");
  const r=await read({attestation});
  assert.equal(r.ok,false);
});
