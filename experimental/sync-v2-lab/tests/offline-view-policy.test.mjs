import test from "node:test";
import assert from "node:assert/strict";
import { authorizeOfflineRead, CLASSIFICATION } from "../client/offline-view-policy.mjs";

const nowMs=Date.parse("2026-11-01T18:00:00.000Z");
const lease={
  guardaId:7,
  deviceId:"device-example-unit-001",
  entities:["escalas","permutas","banco_horas_movimentacoes"],
  issuedAt:"2026-10-31T18:00:00.000Z",
  expiresAt:"2026-11-04T18:00:00.000Z",
};
const base={
  guardaId:7,deviceId:lease.deviceId,classification:CLASSIFICATION.PERSONAL,
  entity:"escalas",nowMs,lease,verifyLease:async()=>true,
  lastSyncAt:"2026-11-01T12:00:00.000Z",
};
async function check(override={}) {
  return authorizeOfflineRead({...base,...override});
}
test("nao autoriza sem verificador criptografico injetado",async()=>{
  const r=await check({verifyLease:undefined});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"UNVERIFIED_LEASE");
});
test("nao aceita assinatura nao verificada",async()=>{
  const r=await check({verifyLease:async()=>false});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"INVALID_SIGNATURE");
});
test("falha fechada quando verificador provoca excecao",async()=>{
  const r=await check({verifyLease:async()=>{throw Error("invalid") }});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"VERIFICATION_ERROR");
});
test("nao permite acesso entre GCMs distintos",async()=>{
  const r=await check({guardaId:8});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"LEASE_SUBJECT_MISMATCH");
});
test("nao permite acesso a partir de outro aparelho",async()=>{
  const r=await check({deviceId:"device-example-unit-002"});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"LEASE_SUBJECT_MISMATCH");
});
test("nao permite entidade fora das permissoes do lease",async()=>{
  const r=await check({entity:"folha_pagamento"});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"ENTITY_NOT_AUTHORIZED");
});
test("nao autoriza depois que o lease expira",async()=>{
  const r=await check({nowMs:Date.parse("2026-11-05T18:00:00.000Z")});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"LEASE_EXPIRED");
});
test("dados pessoais muito antigos exigem nova validacao",async()=>{
  const r=await check({lastSyncAt:"2026-10-31T19:00:00.000Z"});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"CACHE_STALE");
});
test("dados sensiveis tem prazo ainda menor",async()=>{
  const r=await check({classification:CLASSIFICATION.SENSITIVE,
    lastSyncAt:"2026-11-01T10:00:00.000Z"});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"CACHE_STALE");
});
test("nao confunde snapshot paginado com snapshot transacional",async()=>{
  const r=await check({requireConsistentSnapshot:true,serverSnapshotConsistent:false});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"SNAPSHOT_NOT_CONSISTENT");
});
test("consulta pessoal previamente autorizada pode exibir aviso de desatualizacao",async()=>{
  const r=await check();
  assert.equal(r.allowed,true);
  assert.equal(r.stale,true);
  assert.equal(r.consistencyVerified,false);
});
test("verificacao consistente permite operacao apenas de leitura",async()=>{
  const r=await check({requireConsistentSnapshot:true,serverSnapshotConsistent:true});
  assert.equal(r.allowed,true);
  assert.equal(r.consistencyVerified,true);
});
test("booleano copiado do armazenamento nao vale como assinatura",async()=>{
  const r=await check({verifiedLease:true});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"UNTRUSTED_VERIFICATION_FLAG");
});
test("conteudo publico deve seguir politica distinta",async()=>{
  const r=await check({classification:CLASSIFICATION.PUBLIC});
  assert.equal(r.allowed,false);
  assert.equal(r.reason,"PUBLIC_REQUIRES_SEPARATE_POLICY");
});
