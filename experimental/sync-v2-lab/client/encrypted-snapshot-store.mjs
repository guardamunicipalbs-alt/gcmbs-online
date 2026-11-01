/**
 * GCMBS Sync V2 - adaptador criptografico EXPERIMENTAL para snapshots.
 *
 * IMPORTANTE: nao implementa criptografia nem persiste por si proprio.
 * Requer seal/unseal reais usando AES-GCM com nonce unico por gravacao,
 * chave protegida no Android Keystore e associatedData vinculada ao
 * usuario, entidade e dispositivo. Nao usar cifragem deterministica.
 *
 * rawStore.transaction(fn) deve oferecer read/write/delete e commit/rollback
 * REALMENTE atomicos. O adaptador trata apenas estados de cache com Map,
 * NUNCA senhas, sessoes, fila V296 ou dados do banco financeiro.
 *
 * Nao esta integrado ao Android/Desktop ou a producao.
 */
import { encodeCacheState, decodeCacheBytes, MAX_CACHE_BYTES } from "./cache-json-codec.mjs";

const encoder=new TextEncoder();
const MAX_CIPHERTEXT_BYTES=MAX_CACHE_BYTES+1024;
function checkKey(key) {
  if(typeof key!=="string" ||
    !/^gcmbs:sync-v2:(?:staged:)?[1-9][0-9]*:[a-z_]{2,70}(?::(?:active|staging))?$/.test(key))
    throw new Error("Chave de cache fora do escopo");
  return key;
}
function checkBytes(value) {
  if(!(value instanceof Uint8Array) || value.length<1 || value.length>MAX_CIPHERTEXT_BYTES)
    throw new Error("Formato criptografado invalido");
  return value;
}
export function createEncryptedSnapshotStore({rawStore,seal,unseal,deviceId}) {
  if(!rawStore || typeof rawStore.transaction!=="function") throw new Error("Store bruto nao transacional");
  if(typeof seal!=="function" || typeof unseal!=="function")
    throw new Error("Criptografia obrigatoria, sem modo plaintext");
  if(typeof deviceId!=="string" || !/^[A-Za-z0-9._:-]{12,128}$/.test(deviceId))
    throw new Error("Identidade do aparelho obrigatoria");
  return Object.freeze({
    async transaction(fn) {
      if(typeof fn!=="function") throw new TypeError("Callback invalido");
      return rawStore.transaction(async raw=>{
        if(!raw || typeof raw.read!=="function" ||
           typeof raw.write!=="function" || typeof raw.delete!=="function")
          throw new Error("Driver sem transacao completa");
        const tx={
          async read(key) {
            checkKey(key);
            const cipher=await raw.read(key);
            if(cipher==null)return null;
            const encrypted=checkBytes(cipher);
            const associatedData=encoder.encode("gcmbs-sync-v2|v1|device:"+deviceId+"|"+key);
            const clear=await unseal(encrypted,associatedData);
            if(!(clear instanceof Uint8Array) || clear.length>MAX_CACHE_BYTES)
              throw new Error("Descriptografia retornou payload invalido");
            return decodeCacheBytes(clear);
          },
          async write(key,state) {
            checkKey(key);
            const plain=encoder.encode(encodeCacheState(state));
            const associatedData=encoder.encode("gcmbs-sync-v2|v1|device:"+deviceId+"|"+key);
            const cipher=checkBytes(await seal(plain,associatedData));
            await raw.write(key,cipher);
          },
          async delete(key) {
            checkKey(key);
            await raw.delete(key);
          },
        };
        return fn(tx);
      });
    },
  });
}
