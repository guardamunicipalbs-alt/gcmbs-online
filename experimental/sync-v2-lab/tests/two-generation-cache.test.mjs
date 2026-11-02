import test from "node:test";
import assert from "node:assert/strict";
import {
 startCapture,commitCapturePage,inspectCapture,discardStaging
} from "../client/two-generation-cache.mjs";

function store({failCommit=false}={}) {
  const values=new Map();
  let queue=Promise.resolve();
  return {
    values,
    async transaction(fn) {
      const previous=queue;let done;
      queue=new Promise(resolve=>{done=resolve;});
      await previous;
      try {
        const working=structuredClone(values);
        const tx={
          read:async k=>structuredClone(working.get(k)),
          write:async(k,v)=>working.set(k,structuredClone(v)),
          delete:async k=>working.delete(k),
        };
        const result=await fn(tx);
        if(failCommit)throw new Error("SIMULATED_STORAGE_FAILURE");
        values.clear();
        for(const [k,v] of working)values.set(k,v);
        return result;
      }finally{done();}
    },
  };
}
const captureA="capture_alpha_20261101",captureB="capture_bravo_20261101";
const page=(records,more=false,next=null,user=7)=>({
 contract:"GCMBS_SYNC_V2_LAB",guarda_id:user,entity:"escalas",
 records:records.map(key=>({key,revision:"1",deleted:false,updated_at:"2026-11-01T00:00:00Z",data:{key}})),
 has_more:more,next_after_key:next,
});
const args=(s,captureId)=>({store:s,guardaId:7,entity:"escalas",captureId});

test("primeira captura so vira ativa apos ultima pagina",async()=>{
 const s=store();
 await startCapture(args(s,captureA));
 await commitCapturePage({...args(s,captureA),response:page(["A"],true,"A")});
 let view=await inspectCapture({store:s,guardaId:7,entity:"escalas"});
 assert.equal(view.activeCaptureId,null);
 assert.equal(view.pendingCursor,"A");
 const result=await commitCapturePage({...args(s,captureA),expectedAfterKey:"A",response:page(["B"])});
 assert.equal(result.status,"PROMOTED");
 view=await inspectCapture({store:s,guardaId:7,entity:"escalas"});
 assert.equal(view.activeCaptureId,captureA);
 assert.equal(view.pendingCaptureId,null);
 assert.equal(view.activeRecords,2);
 assert.equal(view.serverSnapshotConsistent,false);
});
test("quota interrompe segunda captura sem perder cache anterior",async()=>{
 const s=store();
 await startCapture(args(s,captureA));
 await commitCapturePage({...args(s,captureA),response:page(["A"])});
 await startCapture(args(s,captureB));
 await commitCapturePage({...args(s,captureB),response:page(["B"],true,"B")});
 let view=await inspectCapture({store:s,guardaId:7,entity:"escalas"});
 assert.equal(view.activeCaptureId,captureA);
 assert.equal(view.activeRecords,1);
 assert.equal(view.pendingCaptureId,captureB);
 await commitCapturePage({...args(s,captureB),expectedAfterKey:"B",response:page(["C"])});
 view=await inspectCapture({store:s,guardaId:7,entity:"escalas"});
 assert.equal(view.activeCaptureId,captureB);
 assert.equal(view.activeRecords,2);
 assert.equal(view.pendingCaptureId,null);
});
test("captura concorrente de identidade diferente e bloqueada",async()=>{
 const s=store();
 await startCapture(args(s,captureA));
 await assert.rejects(startCapture(args(s,captureB)),/anterior pendente/);
 assert.equal((await inspectCapture({store:s,guardaId:7,entity:"escalas"})).pendingCaptureId,captureA);
});
test("reenvio da mesma pagina nao duplica nem modifica estado",async()=>{
 const s=store();await startCapture(args(s,captureA));
 const body={...args(s,captureA),response:page(["A"],true,"A")};
 await commitCapturePage(body);
 await assert.rejects(commitCapturePage(body),/Checkpoint concorrente/);
 assert.equal((await inspectCapture({store:s,guardaId:7,entity:"escalas"})).pendingCursor,"A");
});
test("captureId anterior nao altera geracao nova",async()=>{
 const s=store();await startCapture(args(s,captureA));await discardStaging(args(s,captureA));
 await startCapture(args(s,captureB));
 await assert.rejects(commitCapturePage({...args(s,captureA),response:page(["A"])}),/desatualizada/);
 assert.equal((await inspectCapture({store:s,guardaId:7,entity:"escalas"})).pendingCaptureId,captureB);
});
test("exclusao do staging exige identidade e preserva active",async()=>{
 const s=store();await startCapture(args(s,captureA));await commitCapturePage({...args(s,captureA),response:page(["A"])});
 await startCapture(args(s,captureB));
 assert.equal(await discardStaging(args(s,captureA)),false);
 assert.equal(await discardStaging(args(s,captureB)),true);
 const view=await inspectCapture({store:s,guardaId:7,entity:"escalas"});
 assert.equal(view.activeCaptureId,captureA);
 assert.equal(view.pendingCaptureId,null);
});
test("outro guarda nao pode publicar captura no cache do titular",async()=>{
 const s=store();await startCapture(args(s,captureA));
 await assert.rejects(commitCapturePage({...args(s,captureA),response:page(["A"],false,null,99)}),/usuario\/entidade/);
 assert.equal((await inspectCapture({store:s,guardaId:7,entity:"escalas"})).activeCaptureId,null);
});
test("falha de commit conserva versao antiga de maneira atomica",async()=>{
 const s=store();
 await startCapture(args(s,captureA));await commitCapturePage({...args(s,captureA),response:page(["A"])});
 const broken=store({failCommit:true});
 // Faz copia do storage anterior sem tocar nos dados de producao
 for(const [key,value] of s.values)broken.values.set(key,structuredClone(value));
 await assert.rejects(startCapture(args(broken,captureB)),/SIMULATED_STORAGE_FAILURE/);
 const state=await inspectCapture({store:s,guardaId:7,entity:"escalas"});
 assert.equal(state.activeCaptureId,captureA);
 assert.equal(state.activeRecords,1);
 assert.equal(broken.values.size,s.values.size);
});
test("capturas simultaneas serializadas so iniciam uma geracao",async()=>{
 const s=store();
 const res=await Promise.allSettled([startCapture(args(s,captureA)),startCapture(args(s,captureB))]);
 assert.equal(res.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(res.filter(x=>x.status==="rejected").length,1);
});
