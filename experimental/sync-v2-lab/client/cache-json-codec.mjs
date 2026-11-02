/**
 * GCMBS Sync V2 — serializador de cache para futuro adaptador SQLite.
 *
 * ADVERTENCIA: JSON NAO E CRIPTOGRAFIA. O driver real deve proteger os
 * bytes em repouso usando mecanismo institucional/Android Keystore e
 * transacoes duraveis. Nunca persistir em localStorage publico.
 *
 * Preserva Map (chave->revisao/dados), distingue capturas em andamento,
 * rejeita duplicacoes e conteudo corrompido antes da consulta.
 * O formato/schema e experimental e NAO e migracao de banco.
 */
export const CACHE_CODEC_VERSION=1;
export const MAX_CACHE_BYTES=2*1024*1024;
export const MAX_CACHE_RECORDS=5_000;
const enc=new TextEncoder();
const decoder=new TextDecoder("utf-8",{fatal:true});
function finiteString(v,name,max=256,empty=false) {
  if(typeof v!=="string" || v.length>max || (!empty && !v.length)) throw Error(name+" invalido");
  return v;
}
function nullableString(v,name,max=256) {
  if(v===null || v===undefined) return null;
  return finiteString(v,name,max);
}
function rowCopy(row) {
  if(!row || typeof row!=="object" || Array.isArray(row)) throw Error("Registro invalido");
  const rev=String(row.revision??"");
  if(!/^[1-9][0-9]*$/.test(rev)) throw Error("Revisao invalida");
  const deleted=row.deleted===true;
  if(row.deleted!==true && row.deleted!==false) throw Error("Flag deleted invalida");
  const updated_at=row.updated_at===null?null:finiteString(row.updated_at,"updated_at",80);
  if(!deleted && (!row.data || typeof row.data!=="object" || Array.isArray(row.data)))
    throw Error("Registro ativo sem objeto de dados");
  if(deleted && row.data!==null) throw Error("Tombstone com dados");
  const data=deleted?null:row.data;
  return {revision:rev,updated_at,deleted,data};
}
function metadataCopy(state) {
  if(!state || typeof state!=="object" || Array.isArray(state)) throw Error("Estado invalido");
  if(!(state.records instanceof Map)) throw Error("Map esperado");
  if(state.records.size>MAX_CACHE_RECORDS) throw Error("Limite de registros atingido");
  const metadata={};
  for(const key of ["captureId","cursor","done","paginationCompleted","serverSnapshotConsistent"]) {
    if(!Object.hasOwn(state,key)) continue;
    const v=state[key];
    if(key==="captureId") metadata[key]=finiteString(v,key,96);
    else if(key==="cursor") metadata[key]=nullableString(v,key,256);
    else {
      if(typeof v!=="boolean") throw Error(key+" invalido");
      metadata[key]=v;
    }
  }
  if(!Object.hasOwn(metadata,"captureId") && !Object.hasOwn(metadata,"cursor") &&
     !Object.hasOwn(metadata,"done") && !Object.hasOwn(metadata,"paginationCompleted"))
    throw Error("Metadados insuficientes");
  return metadata;
}
export function encodeCacheState(state) {
  const metadata=metadataCopy(state);
  const entries=[];
  for(const [key,value] of state.records) {
    finiteString(key,"record_key",300);
    entries.push([key,rowCopy(value)]);
  }
  const packed={schema:CACHE_CODEC_VERSION,metadata,entries};
  const serialized=JSON.stringify(packed);
  if(typeof serialized!=="string" || enc.encode(serialized).length>MAX_CACHE_BYTES)
    throw Error("Cache excede limite de 2 MiB");
  return serialized;
}
export function decodeCacheState(text) {
  if(typeof text!=="string" || enc.encode(text).length>MAX_CACHE_BYTES)
    throw Error("Cache invalido ou grande demais");
  let parsed;
  try { parsed=JSON.parse(text); } catch { throw Error("JSON corrompido"); }
  if(!parsed || parsed.schema!==CACHE_CODEC_VERSION ||
     !parsed.metadata || !Array.isArray(parsed.entries) ||
     parsed.entries.length>MAX_CACHE_RECORDS) throw Error("Formato do cache invalido");
  const state={...parsed.metadata,records:new Map()};
  // Validacao completa de metadados, inclusive versao e tipos.
  const cleaned=metadataCopy(state);
  if(Object.keys(parsed.metadata).some(k=>!["captureId","cursor","done","paginationCompleted","serverSnapshotConsistent"].includes(k)))
    throw Error("Metadados desconhecidos");
  for(const [key,value] of parsed.entries) {
    finiteString(key,"record_key",300);
    if(state.records.has(key)) throw Error("Registro duplicado no cache");
    state.records.set(key,rowCopy(value));
  }
  return {...cleaned,records:state.records};
}
export function decodeCacheBytes(bytes) {
  if(!(bytes instanceof Uint8Array) || bytes.length>MAX_CACHE_BYTES) throw Error("Bytes invalidos");
  return decodeCacheState(decoder.decode(bytes));
}
