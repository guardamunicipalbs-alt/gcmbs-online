import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { createEncryptedSnapshotStore } from "../client/encrypted-snapshot-store.mjs";
import { startCapture,commitCapturePage,inspectCapture } from "../client/two-generation-cache.mjs";
const crypto=webcrypto;
const enc=new TextEncoder();
function memoryRawStore() {
  const rows=new Map();
  let serial=Promise.resolve();
  return {
    rows,
    async transaction(fn) {
      const prev=serial;let release;
      serial=new Promise(resolve=>{release=resolve});
      await prev;
      try {
        const staged=structuredClone(rows);
        const tx={
          read:async key=>staged.get(key),
          write:async(key,value)=>{staged.set(key,structuredClone(value))},
          delete:async key=>{staged.delete(key)},
        };
        const result=await fn(tx);
        rows.clear();
        for(const [k,v] of staged)rows.set(k,v);
        return result;
      }finally{release()}
    },
  };
}
async function secureStore(rawStore,deviceId="android-device-test-0001",encryptionKey=null) {
  // Chave EFEMERA dos testes, nunca credencial institucional.
  const key=encryptionKey??await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  let calls=0;
  const seal=async (clear,associatedData)=>{
    calls++;
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const body=await crypto.subtle.encrypt({
      name:"AES-GCM",iv,additionalData:associatedData,tagLength:128,
    },key,clear);
    const result=new Uint8Array(iv.length+body.byteLength);
    result.set(iv,0);
    result.set(new Uint8Array(body),iv.length);
    return result;
  };
  const unseal=async (cipher,associatedData)=>{
    if(cipher.length<28)throw Error("Cifra incompleta");
    const plain=await crypto.subtle.decrypt({
      name:"AES-GCM",iv:cipher.slice(0,12),
      additionalData:associatedData,tagLength:128,
    },key,cipher.slice(12));
    return new Uint8Array(plain);
  };
  return {store:createEncryptedSnapshotStore({rawStore,seal,unseal,deviceId}),calls:()=>calls};
}
const k="gcmbs:sync-v2:7:escalas";
const state=()=>({
  cursor:"chave-001",done:false,
  records:new Map([["escalas:chave-001",{
    revision:"3",updated_at:"2026-11-01T00:00:00Z",
    deleted:false,data:{nome_guerra:"SENTINELA_FICTICIA"},
  }]]),
});
test("snapshot armazenado como bytes criptografados, nunca JSON puro",async()=>{
  const raw=memoryRawStore();
  const {store}=await secureStore(raw);
  await store.transaction(tx=>tx.write(k,state()));
  const bytes=raw.rows.get(k);
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(Buffer.from(bytes).includes(Buffer.from("SENTINELA_FICTICIA")),false);
  assert.equal((await store.transaction(tx=>tx.read(k))).records.get("escalas:chave-001").revision,"3");
});
test("cada gravacao utiliza nonce novo mesmo com dados identicos",async()=>{
  const raw=memoryRawStore();
  const {store}=await secureStore(raw);
  await store.transaction(tx=>tx.write(k,state()));
  const a=Buffer.from(raw.rows.get(k));
  await store.transaction(tx=>tx.write(k,state()));
  const b=Buffer.from(raw.rows.get(k));
  assert.notDeepEqual(a,b);
});
test("dados criptografados adulterados sao rejeitados",async()=>{
  const raw=memoryRawStore();
  const {store}=await secureStore(raw);
  await store.transaction(tx=>tx.write(k,state()));
  raw.rows.get(k)[20]^=0x01;
  await assert.rejects(store.transaction(tx=>tx.read(k)));
});
test("ciphertext de um GCM nao pode ser transplantado para outro",async()=>{
  const raw=memoryRawStore();
  const {store}=await secureStore(raw);
  await store.transaction(tx=>tx.write(k,state()));
  const copied=structuredClone(raw.rows.get(k));
  const other="gcmbs:sync-v2:9:escalas";
  raw.rows.set(other,copied);
  await assert.rejects(store.transaction(tx=>tx.read(other)));
});
test("driver sem criptografia deve falhar fechado",()=>{
  const raw=memoryRawStore();
  assert.throws(()=>createEncryptedSnapshotStore({rawStore:raw}),/Criptografia obrigatoria/);
});
test("adaptador criptografado suporta captura de duas geracoes",async()=>{
  const raw=memoryRawStore();
  const {store}=await secureStore(raw);
  const props={store,guardaId:7,entity:"escalas",captureId:"capture_test_20261101"};
  await startCapture(props);
  const response={
    contract:"GCMBS_SYNC_V2_LAB",entity:"escalas",guarda_id:7,
    has_more:false,next_after_key:null,
    records:[{key:"chave-001",revision:"1",updated_at:"2026-11-01T00:00:00Z",
      deleted:false,data:{nome_guerra:"FICTICIO"}}],
  };
  await commitCapturePage({...props,response});
  const view=await inspectCapture({store,guardaId:7,entity:"escalas"});
  assert.equal(view.activeRecords,1);
  assert.equal(view.activeCaptureId,props.captureId);
  assert.equal(view.pendingCaptureId,null);
  assert.equal(raw.rows.size,1);
});

test("mesma chave criptografica em aparelhos diferentes nao permite replay",async()=>{
  const raw=memoryRawStore();
  const shared=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
  const a=await secureStore(raw,"android-device-test-A",shared);
  const b=await secureStore(raw,"android-device-test-B",shared);
  await a.store.transaction(tx=>tx.write(k,state()));
  await assert.rejects(b.store.transaction(tx=>tx.read(k)));
  assert.equal((await a.store.transaction(tx=>tx.read(k))).cursor,"chave-001");
});
test("identidade do aparelho e obrigatoria para armazenamento cifrado",()=>{
  const raw=memoryRawStore();
  const stub=async bytes=>bytes;
  assert.throws(()=>createEncryptedSnapshotStore({rawStore:raw,seal:stub,unseal:stub}),/aparelho obrigatoria/);
});
