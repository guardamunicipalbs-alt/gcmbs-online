import test from "node:test";
import assert from "node:assert/strict";
import { ReadRetryGate } from "../client/read-retry-gate.mjs";

test("402 suspende so polling automatico por uma hora",()=>{
  let t=100;
  const gate=new ReadRetryGate({now:()=>t});
  assert.equal(gate.automaticReadAllowed(),true);
  assert.equal(gate.fail({status:402}),3_600_000);
  assert.equal(gate.lastReason,"quota");
  assert.equal(gate.automaticReadAllowed(),false);
  t+=3_600_000;
  assert.equal(gate.automaticReadAllowed(),true);
});
test("sucesso remove bloqueio e falhas acumuladas",()=>{
  const gate=new ReadRetryGate({now:()=>0});
  gate.fail({status:500});
  assert.equal(gate.automaticReadAllowed(),false);
  gate.success();
  assert.equal(gate.automaticReadAllowed(),true);
  assert.equal(gate.transientFailures,0);
});
test("falhas transitorias aumentam intervalo com limite",()=>{
  const gate=new ReadRetryGate({now:()=>0,maxWaitMs:70_000});
  assert.equal(gate.fail({status:500}),15_000);
  assert.equal(gate.fail({status:500}),30_000);
  assert.equal(gate.fail({status:500}),60_000);
  assert.equal(gate.fail({status:500}),70_000);
  assert.equal(gate.fail({status:500}),70_000);
});
test("429 respeita Retry-After limitado",()=>{
  const gate=new ReadRetryGate({now:()=>0});
  assert.equal(gate.fail({status:429,retryAfterMs:90_000}),90_000);
});
test("400 nao ativa circuit breaker",()=>{
  const gate=new ReadRetryGate({now:()=>0});
  assert.equal(gate.fail({status:400}),0);
  assert.equal(gate.automaticReadAllowed(),true);
});
test("401 exige tratamento de sessao e nao se confunde com quota",()=>{
  const gate=new ReadRetryGate({now:()=>0});
  gate.fail({status:401});
  assert.equal(gate.lastReason,"authorization");
  assert.equal(gate.remainingMs(),300_000);
});
