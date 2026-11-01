import test from "node:test";
import assert from "node:assert/strict";
import {
  STATES,newPendingOperation,prepareRetry,
  acknowledgeServer,finalizeAfterReconciliation
} from "../client/offline-outbox-state.mjs";
const id="f4ccfe8e-0123-4123-a777-7bd9367f2e21";
const pending=()=>newPendingOperation({
  clientChangeId:id,guardaId:7,type:"PERMUTA",
  payload:{modalidade:"ASSUNCAO",servico:"FICTICIO"},
  createdAt:"2026-11-01T00:00:00.000Z",
});
test("reenvio conserva identificador de idempotencia",()=>{
  const first=pending();
  const retry=prepareRetry(first);
  assert.equal(first.client_change_id,retry.client_change_id);
  assert.equal(retry.attempts,1);
  assert.equal(first.attempts,0);
});
test("ACK e espera pelo Desktop nao implicam aprovacao",()=>{
  const ack=acknowledgeServer(pending(),{
    clientChangeId:id,serverId:123,pendingDesktop:true,
  });
  assert.equal(ack.status,STATES.AWAITING_DESKTOP);
  assert.notEqual(ack.status,STATES.FINAL_CONFIRMED);
});
test("mesmo ACK pode ser reaplicado sem criar outro ID",()=>{
  const first=acknowledgeServer(pending(),{clientChangeId:id,serverId:123});
  const again=acknowledgeServer(first,{clientChangeId:id,serverId:123});
  assert.equal(again.server_id,123);
  assert.equal(again.status,STATES.SERVER_RECEIVED);
});
test("ACK desconhecido nao se associa a permuta",()=>{
  assert.throws(()=>acknowledgeServer(pending(),{
    clientChangeId:"aaaaaaaa-0123-4123-a777-7bd9367f2e21",serverId:123
  }),/ACK/);
});
test("reenvio apos ACK proibido pela fila",()=>{
  const ack=acknowledgeServer(pending(),{clientChangeId:id,serverId:123});
  assert.throws(()=>prepareRetry(ack),/nao pendente/);
});
test("aprovacao final exige comprovante de servidor",()=>{
  assert.throws(()=>finalizeAfterReconciliation(pending(),{serverId:123,outcome:"CONFIRMED"}),/comprovante/);
  const ack=acknowledgeServer(pending(),{clientChangeId:id,serverId:123,pendingDesktop:true});
  assert.throws(()=>finalizeAfterReconciliation(ack,{serverId:888,outcome:"CONFIRMED"}),/diferente/);
  assert.equal(finalizeAfterReconciliation(ack,{serverId:123,outcome:"CONFIRMED"}).status,STATES.FINAL_CONFIRMED);
});
test("conflito permanece distinguivel de recusa",()=>{
  const ack=acknowledgeServer(pending(),{clientChangeId:id,serverId:123});
  assert.equal(finalizeAfterReconciliation(ack,{serverId:123,outcome:"CONFLICT"}).status,STATES.CONFLICT);
  assert.equal(finalizeAfterReconciliation(ack,{serverId:123,outcome:"REJECTED"}).status,STATES.REJECTED);
});
