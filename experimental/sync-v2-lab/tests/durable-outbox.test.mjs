import test from "node:test";
import assert from "node:assert/strict";
import {
  enqueueDurably, loadDurably, markAttemptDurably,
  acknowledgeDurably, finalizeDurably, outboxKey,
} from "../client/durable-outbox.mjs";
import { STATES } from "../client/offline-outbox-state.mjs";

const ID="014aa1ac-2d85-49c4-b567-912345678911";
const request={
  guardaId:7,clientChangeId:ID,type:"PERMUTA",
  payload:{servico:"FICTICIO",turno:"A"},
  createdAt:"2026-11-01T00:00:00.000Z",
};
function mockStore({ fail=false }={}) {
  const rows=new Map();
  let sequence=Promise.resolve();
  return {
    rows,
    async transaction(fn) {
      let release;
      const done=new Promise(r => {release=r});
      const previous=sequence;
      sequence=done;
      await previous;
      try {
        const staged=structuredClone(rows);
        const tx={
          read:async key=>structuredClone(staged.get(key)),
          write:async(key,value)=>staged.set(key,structuredClone(value)),
        };
        const result=await fn(tx);
        if(fail)throw new Error("SIMULATED_DISK_FAILURE");
        rows.clear();
        for(const [key,value] of staged)rows.set(key,value);
        return result;
      } finally { release(); }
    },
  };
}
test("enqueue atomico nao insere duas vezes mesmo change ID",async()=>{
  const store=mockStore();
  const a=await enqueueDurably({store,...request});
  const b=await enqueueDurably({store,...request});
  assert.equal(a.inserted,true);
  assert.equal(b.inserted,false);
  assert.equal(store.rows.size,1);
  assert.equal((await loadDurably({store,guardaId:7,clientChangeId:ID})).status,STATES.PENDING_SEND);
});
test("reuso de ID com operacao diferente e proibido",async()=>{
  const store=mockStore();
  await enqueueDurably({store,...request});
  await assert.rejects(
    enqueueDurably({store,...request,payload:{turno:"B"}}),/payload diferente/
  );
  assert.equal(store.rows.size,1);
});
test("falha de disco nao registra operacao parcialmente",async()=>{
  const store=mockStore({fail:true});
  await assert.rejects(enqueueDurably({store,...request}),/SIMULATED_DISK_FAILURE/);
  assert.equal(store.rows.size,0);
});
test("reenvio nao muda identificador nem permite reenvio apos ACK",async()=>{
  const store=mockStore();
  await enqueueDurably({store,...request});
  const retry=await markAttemptDurably({store,guardaId:7,clientChangeId:ID});
  assert.equal(retry.attempts,1);
  assert.equal(retry.client_change_id,ID);
  const received=await acknowledgeDurably({store,guardaId:7,clientChangeId:ID,serverId:11});
  assert.equal(received.record.status,STATES.SERVER_RECEIVED);
  await assert.rejects(markAttemptDurably({store,guardaId:7,clientChangeId:ID}),/nao pendente/);
});
test("ACK atrasado nao rebaixa AWAITING_DESKTOP",async()=>{
  const store=mockStore();
  await enqueueDurably({store,...request});
  await acknowledgeDurably({store,guardaId:7,clientChangeId:ID,serverId:11,pendingDesktop:true});
  const late=await acknowledgeDurably({store,guardaId:7,clientChangeId:ID,serverId:11,pendingDesktop:false});
  assert.equal(late.record.status,STATES.AWAITING_DESKTOP);
  assert.equal(late.duplicate,true);
});
test("ACK depois de CONFIRMED preserva estado final",async()=>{
  const store=mockStore();
  await enqueueDurably({store,...request});
  await acknowledgeDurably({store,guardaId:7,clientChangeId:ID,serverId:11});
  const confirmed=await finalizeDurably({
    store,guardaId:7,clientChangeId:ID,serverId:11,outcome:"CONFIRMED",
  });
  assert.equal(confirmed.record.status,STATES.FINAL_CONFIRMED);
  const duplicate=await acknowledgeDurably({store,guardaId:7,clientChangeId:ID,serverId:11});
  assert.equal(duplicate.record.status,STATES.FINAL_CONFIRMED);
  assert.equal(duplicate.duplicate,true);
});
test("duplicidade de resultado final e aceita apenas se identica",async()=>{
  const store=mockStore();
  await enqueueDurably({store,...request});
  await acknowledgeDurably({store,guardaId:7,clientChangeId:ID,serverId:11});
  await finalizeDurably({store,guardaId:7,clientChangeId:ID,serverId:11,outcome:"REJECTED"});
  const duplicate=await finalizeDurably({store,guardaId:7,clientChangeId:ID,serverId:11,outcome:"REJECTED"});
  assert.equal(duplicate.duplicate,true);
  await assert.rejects(finalizeDurably({store,guardaId:7,clientChangeId:ID,serverId:11,outcome:"CONFIRMED"}),/conflitante/);
});
test("GCM diferente nao enxerga nem confirma operacao de outro usuario",async()=>{
  const store=mockStore();
  await enqueueDurably({store,...request});
  assert.equal(await loadDurably({store,guardaId:9,clientChangeId:ID}),null);
  await assert.rejects(acknowledgeDurably({store,guardaId:9,clientChangeId:ID,serverId:11}),/ausente/);
  assert.equal(store.rows.has(outboxKey(7,ID)),true);
});
test("duas chamadas simultaneas de enqueue so gravam uma operacao",async()=>{
  const store=mockStore();
  const [a,b]=await Promise.all([
    enqueueDurably({store,...request}),
    enqueueDurably({store,...request}),
  ]);
  assert.equal(Number(a.inserted)+Number(b.inserted),1);
  assert.equal(store.rows.size,1);
});
test("operacao continua apos processo reiniciar, caso driver seja persistente",async()=>{
  const store=mockStore();
  await enqueueDurably({store,...request});
  await acknowledgeDurably({store,guardaId:7,clientChangeId:ID,serverId:11,pendingDesktop:true});
  // Simula processo novo lendo o mesmo backend persistente.
  const reload=await loadDurably({store,guardaId:7,clientChangeId:ID});
  assert.equal(reload.status,STATES.AWAITING_DESKTOP);
  assert.equal(reload.server_id,11);
});
