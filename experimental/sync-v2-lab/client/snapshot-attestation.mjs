/**
 * GCMBS Sync V2 — atestacao criptografica EXPERIMENTAL de snapshot.
 *
 * Sem emissor oficial: o servidor ainda NAO oferece snapshot transacional
 * consistente. Este modulo so verifica assinaturas de um formato futuro.
 * Jamais assinar a paginacao atual como "consistente".
 * A chave privada deve permanecer no ambiente institucional, nao no cliente.
 */
const PREFIX="GCMBS_SYNC_SNAPSHOT_V1\n";
const ORDER=["issuer","audience","guardaId","deviceId","entity",
  "captureId","recordsDigest","issuedAt","expiresAt"];
const enc=new TextEncoder();
const EXPIRY_MAX=6*60*60*1000;
function validTime(s) {
  return typeof s==="string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(Date.parse(s)).toISOString()===s;
}
function isPlainObject(obj) {
  return obj!==null && typeof obj==="object" && !Array.isArray(obj) &&
    (Object.getPrototypeOf(obj)===Object.prototype || Object.getPrototypeOf(obj)===null);
}
function canon(value,depth=0) {
  if(depth>20)throw Error("PROOF_DEPTH");
  if(value===null || typeof value==="string" || typeof value==="boolean")return value;
  if(typeof value==="number") {
    if(!Number.isFinite(value))throw Error("PROOF_NONFINITE");
    return value;
  }
  if(Array.isArray(value)) {
    if(value.length>20000)throw Error("PROOF_ARRAY_TOO_LONG");
    return value.map(x=>canon(x,depth+1));
  }
  if(!isPlainObject(value))throw Error("PROOF_INVALID_OBJECT");
  const out=Object.create(null);
  for(const key of Object.keys(value).sort()){
    if(key==="__proto__"||key==="constructor"||key==="prototype")throw Error("PROOF_DANGEROUS_KEY");
    if(typeof value[key]==="undefined")throw Error("PROOF_UNDEFINED");
    out[key]=canon(value[key],depth+1);
  }
  return out;
}
function toUrl(bytes) {
  let str="";
  for(const b of bytes)str+=String.fromCharCode(b);
  return btoa(str).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function fromUrl(str,length) {
  if(typeof str!=="string"||!new RegExp(`^[A-Za-z0-9_-]{${length}}$`).test(str))return null;
  try{
    const decoded=atob(str.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-str.length%4)%4));
    return Uint8Array.from(decoded,c=>c.charCodeAt(0));
  }catch{return null}
}
function claimsValid(c){
  if(!isPlainObject(c)||Object.keys(c).length!==ORDER.length ||
     !ORDER.every(k=>Object.hasOwn(c,k)))return false;
  if(c.issuer!=="GCMBS"||c.audience!=="gcmbs-sync-snapshot")return false;
  if(!Number.isSafeInteger(c.guardaId)||c.guardaId<=0)return false;
  if(typeof c.deviceId!=="string"|| !/^[A-Za-z0-9._:-]{12,128}$/.test(c.deviceId))return false;
  if(typeof c.entity!=="string"||!/^[a-z_]{2,70}$/.test(c.entity))return false;
  if(typeof c.captureId!=="string"||!/^[A-Za-z0-9_-]{12,96}$/.test(c.captureId))return false;
  if(!fromUrl(c.recordsDigest,43))return false;
  if(!validTime(c.issuedAt)||!validTime(c.expiresAt))return false;
  const duration=Date.parse(c.expiresAt)-Date.parse(c.issuedAt);
  return duration>0 && duration<=EXPIRY_MAX;
}
function signatureMessage(a){
  const claims={};
  for(const key of ORDER)claims[key]=a.claims[key];
  return enc.encode(PREFIX+JSON.stringify({
    version:1,alg:"ES256",keyId:a.keyId,claims,
  }));
}
export async function snapshotDigest(active,entity,subtle=globalThis.crypto?.subtle){
  if(!subtle||!(active?.records instanceof Map)||active.records.size>5000)
    throw Error("PROOF_INVALID_CACHE");
  const rows=[];
  for(const [key,row] of active.records) {
    if(typeof key!=="string"||!key.startsWith(entity+":")||
       typeof row?.revision!=="string"||!/^[1-9][0-9]*$/.test(row.revision)||
       typeof row.deleted!=="boolean"||(row.deleted===true && row.data!==null))
      throw Error("PROOF_INVALID_RECORD");
    rows.push([key,canon({
      revision:row.revision,deleted:row.deleted,
      data:row.deleted?null:row.data,
    })]);
  }
  rows.sort(([a],[b])=>a<b?-1:a>b?1:0);
  const payload=enc.encode(JSON.stringify({entity,rows}));
  if(payload.length>2*1024*1024)throw Error("PROOF_TOO_LARGE");
  const digest=await subtle.digest("SHA-256",payload);
  return toUrl(new Uint8Array(digest));
}
export async function verifySnapshotAttestation({
  attestation,active,guardaId,deviceId,entity,nowMs,
  trustedJwks,subtle=globalThis.crypto?.subtle,
}={}) {
  if(!subtle||!isPlainObject(attestation)||
     Object.keys(attestation).length!==5||
     !["version","alg","keyId","claims","signature"].every(x=>Object.hasOwn(attestation,x))||
     attestation.version!==1||attestation.alg!=="ES256"||
     typeof attestation.keyId!=="string"||!/^[A-Za-z0-9._-]{1,48}$/.test(attestation.keyId)||
     !claimsValid(attestation.claims) || !Number.isFinite(nowMs))return false;
  const c=attestation.claims;
  if(c.guardaId!==guardaId||c.entity!==entity||c.deviceId!==deviceId||
     c.captureId!==active?.captureId || nowMs<Date.parse(c.issuedAt)||
     nowMs>=Date.parse(c.expiresAt) || active.serverSnapshotConsistent!==true ||
     active.paginationCompleted!==true)return false;
  const jwk=trustedJwks?.[attestation.keyId];
  if(!isPlainObject(jwk)||jwk.kty!=="EC"||jwk.crv!=="P-256"||
     typeof jwk.x!=="string"||typeof jwk.y!=="string"||
     Object.hasOwn(jwk,"d"))return false;
  const sig=fromUrl(attestation.signature,86);
  if(!sig)return false;
  try{
    const digest=await snapshotDigest(active,entity,subtle);
    if(digest!==c.recordsDigest)return false;
    const key=await subtle.importKey("jwk",jwk,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
    return await subtle.verify({name:"ECDSA",hash:"SHA-256"},key,sig,signatureMessage(attestation))===true;
  }catch{return false}
}
/** Utilizado SOMENTE no teste local que assina dados ficticios. */
export function _snapshotSignatureBytesForTests(a){
  if(!claimsValid(a?.claims))throw Error("INVALID_PROOF");
  return signatureMessage(a);
}
