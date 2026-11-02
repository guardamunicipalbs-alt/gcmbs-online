import test from "node:test";
import assert from "node:assert/strict";
import { mergeSnapshotPage, visibleRecords } from "../client/merge-snapshot.mjs";

const pg = (records) => ({
  contract:"GCMBS_SYNC_V2_LAB", entity:"permutas", records,
  has_more:false, next_after_key:null,
});
test("aplica uma unica vez", () => {
  const page=pg([{key:"a",revision:"1",deleted:false,data:{status:"PENDENTE"}}]);
  const first=mergeSnapshotPage(new Map(),page);
  assert.equal(first.applied,1);
  const second=mergeSnapshotPage(first.records,page);
  assert.equal(second.applied,0);
  assert.equal(second.unchanged,1);
});
test("nao restaura valor antigo", () => {
  const current=new Map([["permutas:a",{revision:"2",updated_at:null,deleted:false,data:{status:"APROVADA"}}]]);
  const r=mergeSnapshotPage(current,pg([{key:"a",revision:"1",deleted:false,data:{status:"PENDENTE"}}]));
  assert.equal(r.records.get("permutas:a").data.status,"APROVADA");
});
test("tombstone impede ressurreicao", () => {
  const p1=pg([{key:"a",revision:"5",deleted:true,data:null}]);
  const r=mergeSnapshotPage(new Map(),p1);
  const old=mergeSnapshotPage(r.records,pg([{key:"a",revision:"4",deleted:false,data:{status:"ATIVA"}}]));
  assert.equal(visibleRecords(old.records,"permutas").length,0);
});
test("revisao igual com conteudo divergente falha", () => {
  const current=new Map([["permutas:a",{revision:"1",updated_at:null,deleted:false,data:{x:1}}]]);
  assert.throws(()=>mergeSnapshotPage(current,pg([{key:"a",revision:"1",deleted:false,data:{x:2}}])),/Conflito/);
});
test("rejeita chave repetida na mesma pagina", () => {
  assert.throws(()=>mergeSnapshotPage(new Map(),pg([{key:"a",revision:"1",data:{}},{key:"a",revision:"1",data:{}}])),/repetida/);
});
