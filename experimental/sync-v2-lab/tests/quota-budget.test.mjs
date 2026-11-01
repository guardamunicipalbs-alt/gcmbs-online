import test from "node:test";
import assert from "node:assert/strict";
import { assessEgressBudget, TARGET_EGRESS_BYTES, DEFAULT_EGRESS_LIMIT_BYTES } from "../client/quota-budget.mjs";
const GB=1000**3;
const assess=(x)=>assessEgressBudget({cycleDays:30,...x});
test("nao projeta consumo como certo no primeiro dia",()=>{
 const r=assess({billedBytes:100_000_000,elapsedDays:1});
 assert.equal(r.status,"INSUFFICIENT_SAMPLE");
 assert.equal(r.projectionIsEstimate,true);
});
test("limite real tem prioridade sobre projecao",()=>{
 const r=assess({billedBytes:5*GB,elapsedDays:7});
 assert.equal(r.status,"LIMIT_REACHED");
 assert.equal(r.remainingToLimitBytes,0);
});
test("meta interna preserva margem contra a cota",()=>{
 assert.equal(DEFAULT_EGRESS_LIMIT_BYTES,5*GB);
 assert.equal(TARGET_EGRESS_BYTES,3.5*GB);
 const r=assess({billedBytes:4*GB,elapsedDays:26});
 assert.equal(r.status,"TARGET_REACHED");
});
test("detecta extrapolacao projetada de Egress",()=>{
 const r=assess({billedBytes:1.2*GB,elapsedDays:5});
 assert.equal(r.status,"PROJECTED_LIMIT");
 assert.ok(r.projectedCycleBytes>5*GB);
});
test("alerta ao atingir apenas a meta",()=>{
 const r=assess({billedBytes:1*GB,elapsedDays:5});
 assert.equal(r.status,"PROJECTED_LIMIT");
});
test("identifica tendencia dentro do orcamento",()=>{
 const r=assess({billedBytes:0.2*GB,elapsedDays:10});
 assert.equal(r.status,"WITHIN_TARGET");
});
test("nunca aceita dados negativos ou ciclo invalido",()=>{
 assert.throws(()=>assess({billedBytes:-1,elapsedDays:2}),/invalido/);
 assert.throws(()=>assessEgressBudget({billedBytes:0,elapsedDays:2,cycleDays:40}),/Ciclo invalido/);
});
test("calcula orcamento diario restante sem descontar margem indevidamente",()=>{
 const r=assess({billedBytes:2*GB,elapsedDays:15});
 assert.equal(r.maximumDailyBytesForRemainingTarget,100_000_000);
 assert.equal(r.remainingToTargetBytes,1.5*GB);
});
