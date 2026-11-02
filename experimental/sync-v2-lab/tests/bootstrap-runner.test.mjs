import test from "node:test";
import assert from "node:assert/strict";
import { resumeBootstrap } from "../client/bootstrap-runner.mjs";
import { ReadRetryGate } from "../client/read-retry-gate.mjs";

function memoryStore() {
  const table=new Map();
  let serialization=Promise.resolve();
  return {
    table,
    async transaction(callback) {
      // Mock serializa transacoes. SQLite REAL precisara garantir isto.
      const prior=serialization;let done;
      serialization=new Promise(resolve=>{done=resolve});
      await prior;
      const staged=new Map();
      try{
        const tx={
          read:async k=>structuredClone(staged.has(k)?staged.get(k):table.get(k)),
          write:async(k,v)=>{staged.set(k,structuredClone(v))},
        };
        const result=await callback(tx);
        for(const[k,v]of staged)table.set(k,v);
        return result;
      }finally{done()}
    }
  };
}
const row=(key)=>({key,revision:"1",updated_at:"2026-11-01T00:00:00Z",deleted:false,data:{key}});
const page=(rows,hasMore=false,next=null)=>({
  contract:"GCMBS_SYNC_V2_LAB",guarda_id:7,entity:"escalas",
  has_more:hasMore,next_after_key:next,records:rows
});
const key="gcmbs:sync-v2:7:escalas";
test("conclui bootstrap paginado e nao faz re-download",async()=>{
  const store=memoryStore();
  let calls=0;
  const fetchPage=async({afterKey})=>{
    calls++;
    return afterKey===null?page([row("1")],true,"1"):page([row("2")]);
  };
  const first=await resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas",maxPages:1});
  assert.equal(first.status,"MORE_PAGES");
  assert.equal(store.table.get(key).cursor,"1");
  const second=await resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas"});
  assert.equal(second.status,"COMPLETE");
  assert.equal(store.table.get(key).records.size,2);
  assert.equal(calls,2);
  const again=await resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas"});
  assert.equal(again.status,"COMPLETE");
  assert.equal(calls,2);
});
test("HTTP 402 interrompe novas consultas e conserva cursor",async()=>{
  const store=memoryStore();
  let now=0,calls=0;
  const gate=new ReadRetryGate({now:()=>now});
  const fetchPage=async({afterKey})=>{
    calls++;
    if(!afterKey)return page([row("1")],true,"1");
    if(calls===2)throw Object.assign(new Error("quota"),{status:402});
    return page([row("2")]);
  };
  const first=await resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas",gate});
  assert.equal(first.status,"UNAVAILABLE");
  assert.equal(store.table.get(key).records.size,1);
  assert.equal(store.table.get(key).cursor,"1");
  assert.equal(calls,2);
  const blocked=await resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas",gate});
  assert.equal(blocked.status,"BLOCKED");
  assert.equal(calls,2);
  now+=3600000;
  const recovered=await resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas",gate});
  assert.equal(recovered.status,"COMPLETE");
  assert.equal(store.table.get(key).records.size,2);
  assert.equal(calls,3);
});
test("timeout nao avancara checkpoint",async()=>{
  const store=memoryStore(),gate=new ReadRetryGate({now:()=>0});
  const r=await resumeBootstrap({
    store,guardaId:7,entity:"escalas",gate,
    fetchPage:async()=>{throw new TypeError("Failed to fetch")},
  });
  assert.equal(r.status,"UNAVAILABLE");
  assert.equal(store.table.size,0);
  assert.ok(r.retryInMs>0);
});
test("401 nao e tratado como queda temporaria",async()=>{
  const store=memoryStore();
  const r=await resumeBootstrap({
    store,guardaId:7,entity:"escalas",
    fetchPage:async()=>{throw Object.assign(new Error("unauthenticated"),{status:401})},
  });
  assert.equal(r.status,"AUTH_REQUIRED");
  assert.equal(store.table.size,0);
});
test("resposta assinada para outro GCM e rejeitada sem gravar",async()=>{
  const store=memoryStore();
  await assert.rejects(
    resumeBootstrap({store,guardaId:7,entity:"escalas",
      fetchPage:async()=>({...page([row("1")]),guarda_id:8})}),/outro usuario/
  );
  assert.equal(store.table.size,0);
});
test("resposta excessivamente grande nao sera armazenada",async()=>{
  const store=memoryStore();
  await assert.rejects(
    resumeBootstrap({store,guardaId:7,entity:"escalas",maxResponseBytes:1024,
      fetchPage:async()=>page([{...row("1"),data:{big:"X".repeat(3000)}}])}),/acima do limite/
  );
  assert.equal(store.table.size,0);
});
test("cursor falso nao avanca",async()=>{
  const store=memoryStore();
  await assert.rejects(
    resumeBootstrap({store,guardaId:7,entity:"escalas",
      fetchPage:async()=>page([row("1")],true,"unexpected")}),/Cursor nao corresponde/
  );
  assert.equal(store.table.size,0);
});


test("duas capturas simultaneas nao podem sobrescrever checkpoint",async()=>{
  const store=memoryStore();
  let arrived=0,release;
  const ready=new Promise(resolve=>{release=resolve});
  const fetchPage=async()=>{
    arrived++;
    if(arrived===2) release();
    await ready;
    return page([row("1")],true,"1");
  };
  const outputs=await Promise.allSettled([
    resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas",maxPages:1}),
    resumeBootstrap({store,fetchPage,guardaId:7,entity:"escalas",maxPages:1}),
  ]);
  assert.equal(outputs.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(outputs.filter(x=>x.status==="rejected").length,1);
  assert.match(String(outputs.find(x=>x.status==="rejected").reason),/Checkpoint divergente/);
  const saved=store.table.get(key);
  assert.equal(saved.cursor,"1");
  assert.equal(saved.records.size,1);
});
