import test from "node:test";
import assert from "node:assert/strict";
import {
  CACHE_CODEC_VERSION,MAX_CACHE_BYTES,encodeCacheState,decodeCacheState,decodeCacheBytes,
} from "../client/cache-json-codec.mjs";
const sample=()=>({
  captureId:"capture_test_20261101",cursor:"r02",done:false,
  records:new Map([
    ["escalas:001",{revision:"4",updated_at:"2026-11-01T12:00:00Z",
      deleted:false,data:{nome_guerra:"EXEMPLO",turno:"A"}}],
    ["escalas:002",{revision:"5",updated_at:null,deleted:true,data:null}],
  ]),
});
test("roundtrip preserva Map, revisoes, tombstones e cursor",()=>{
  const serialized=encodeCacheState(sample());
  const decoded=decodeCacheState(serialized);
  assert.ok(decoded.records instanceof Map);
  assert.equal(decoded.records.size,2);
  assert.equal(decoded.captureId,"capture_test_20261101");
  assert.equal(decoded.cursor,"r02");
  assert.equal(decoded.records.get("escalas:001").revision,"4");
  assert.equal(decoded.records.get("escalas:002").deleted,true);
});
test("versao futura nao e lida por cliente antigo",()=>{
  const input=JSON.parse(encodeCacheState(sample()));
  input.schema=CACHE_CODEC_VERSION+1;
  assert.throws(()=>decodeCacheState(JSON.stringify(input)),/Formato/);
});
test("nao aceita chave duplicada",()=>{
  const input=JSON.parse(encodeCacheState(sample()));
  input.entries.push(input.entries[0]);
  assert.throws(()=>decodeCacheState(JSON.stringify(input)),/duplicado/);
});
test("nao aceita revisao zero ou data parcial",()=>{
  const input=JSON.parse(encodeCacheState(sample()));
  input.entries[0][1].revision="0";
  assert.throws(()=>decodeCacheState(JSON.stringify(input)),/Revisao invalida/);
  input.entries[0][1].revision="4";
  input.entries[0][1].data=null;
  assert.throws(()=>decodeCacheState(JSON.stringify(input)),/sem objeto/);
});
test("tombstone nao pode trazer dados antigos",()=>{
  const input=JSON.parse(encodeCacheState(sample()));
  input.entries[1][1].data={secret:"NAO"};
  assert.throws(()=>decodeCacheState(JSON.stringify(input)),/Tombstone com dados/);
});
test("limite em bytes evita cache excessivamente grande",()=>{
  const input=sample();
  input.records.get("escalas:001").data={text:"Z".repeat(MAX_CACHE_BYTES+10)};
  assert.throws(()=>encodeCacheState(input),/excede limite/);
});
test("nao converte bytes UTF-8 invalidos em dados operacionais",()=>{
  assert.throws(()=>decodeCacheBytes(new Uint8Array([0xFF,0xFE,0xFA])),TypeError);
});
test("metadados desconhecidos sao rejeitados",()=>{
  const input=JSON.parse(encodeCacheState(sample()));
  input.metadata.adminOverride=true;
  assert.throws(()=>decodeCacheState(JSON.stringify(input)),/Metadados desconhecidos/);
});
test("JSON nao oferece sigilo: criptografia exigida no banco real",()=>{
  const serialized=encodeCacheState(sample());
  assert.ok(serialized.includes("EXEMPLO"));
  assert.ok(serialized.includes("turno"));
});
