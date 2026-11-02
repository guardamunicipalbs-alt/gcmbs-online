import test from "node:test";
import assert from "node:assert/strict";
import { commitSnapshotPage } from "../client/atomic-page-commit.mjs";

function store({ failCommit = false } = {}) {
  const rows = new Map();
  return {
    rows,
    async transaction(fn) {
      const staged = new Map();
      const tx = {
        read: async key => structuredClone(staged.has(key) ? staged.get(key) : rows.get(key)),
        write: async (key, value) => { staged.set(key, structuredClone(value)); },
      };
      const result = await fn(tx);
      if (failCommit) throw new Error("Falha de gravacao no banco local");
      for (const [key, value] of staged) rows.set(key, value);
      return result;
    },
  };
}
const page=(records,{hasMore=false,next=null,guarda=7,entity="escalas"}={})=>({
  contract:"GCMBS_SYNC_V2_LAB",guarda_id:guarda,entity,records,
  has_more:hasMore,next_after_key:next,
});
const row=(key,revision=1,deleted=false)=>({
  key,revision:String(revision),deleted,
  updated_at:"2026-11-01T00:00:00Z",
  data:deleted?null:{nome_guerra:"EXEMPLO"},
});

test("um bootstrap de duas paginas grava dados e checkpoint juntos",async()=>{
  const s=store();
  let r=await commitSnapshotPage({store:s,entity:"escalas",guardaId:7,response:page([row("1"),row("2")],{hasMore:true,next:"2"})});
  assert.equal(r.done,false);
  assert.equal(s.rows.get("gcmbs:sync-v2:7:escalas").cursor,"2");
  r=await commitSnapshotPage({store:s,entity:"escalas",guardaId:7,expectedAfterKey:"2",response:page([row("3")])});
  assert.equal(r.done,true);
  const state=s.rows.get("gcmbs:sync-v2:7:escalas");
  assert.equal(state.records.size,3);
  assert.equal(state.cursor,null);
  assert.equal(state.done,true);
});
test("falha entre pagina e commit nao altera cursor nem dados",async()=>{
  const s=store({failCommit:true});
  await assert.rejects(commitSnapshotPage({store:s,entity:"escalas",guardaId:7,response:page([row("1")])}),/Falha de gravacao/);
  assert.equal(s.rows.size,0);
});
test("resposta de outro GCM nao grava dados",async()=>{
  const s=store();
  await assert.rejects(commitSnapshotPage({store:s,entity:"escalas",guardaId:7,response:page([row("1")],{guarda:9})}),/outro usuario/);
  assert.equal(s.rows.size,0);
});
test("cursor fora de ordem nao avanca",async()=>{
  const s=store();
  await assert.rejects(commitSnapshotPage({store:s,entity:"escalas",guardaId:7,expectedAfterKey:"50",response:page([row("2")])}),/Ordem de pagina/);
  assert.equal(s.rows.size,0);
});
test("cursor inconsistente nao avanca",async()=>{
  const s=store();
  await assert.rejects(commitSnapshotPage({store:s,entity:"escalas",guardaId:7,response:page([row("1")],{hasMore:true,next:"5"})}),/Cursor nao corresponde/);
  assert.equal(s.rows.size,0);
});
test("repetir pagina parcial nao altera dados nem cursor",async()=>{
  const s=store();
  const first=page([row("1")],{hasMore:true,next:"1"});
  await commitSnapshotPage({store:s,entity:"escalas",guardaId:7,response:first});
  await assert.rejects(commitSnapshotPage({store:s,entity:"escalas",guardaId:7,response:first}),/Checkpoint divergente/);
  assert.equal(s.rows.get("gcmbs:sync-v2:7:escalas").records.size,1);
});
test("falha em validacao nao afeta outro usuario ou entidade",async()=>{
  const s=store();
  await commitSnapshotPage({store:s,entity:"escalas",guardaId:7,response:page([row("1")])});
  await assert.rejects(commitSnapshotPage({store:s,entity:"permutas",guardaId:7,response:page([row("1")])}),/outra entidade/);
  assert.equal(s.rows.get("gcmbs:sync-v2:7:escalas").done,true);
  assert.equal(s.rows.has("gcmbs:sync-v2:7:permutas"),false);
});
