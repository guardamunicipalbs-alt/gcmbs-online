import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir=dirname(fileURLToPath(import.meta.url));
const code=readFileSync(join(dir,"../../../js/data-provider.js"),"utf8")
  .replace(/^import .*;\s*$/gm, "")
  .replace("export class AuthenticatedProvider","class AuthenticatedProvider")
  +"\nreturn AuthenticatedProvider;";
async function restoreWith(status, networkError=false){
  const values=new Map([["gcmbs.mobile.token","test-token"]]);
  const localStorage={
    getItem:k=>values.get(k)||null,
    setItem:(k,v)=>values.set(k,v),
    removeItem:k=>values.delete(k)
  };
  const fetch=async()=>{
    if(networkError) throw new TypeError("Failed to fetch");
    return {ok:false,status,json:async()=>({message:"test"})};
  };
  const Provider=new Function("localStorage","fetch","MODULOS_GCMBS","normalizarPerfil","controleTotal",code)(
    localStorage,fetch,[],()=>({}),()=>false
  );
  const provider=new Provider();
  await provider.restore();
  return values.has("gcmbs.mobile.token");
}
test("preserva token em HTTP 402",async()=>assert.equal(await restoreWith(402),true));
test("preserva token em HTTP 500",async()=>assert.equal(await restoreWith(500),true));
test("preserva token em falha de rede",async()=>assert.equal(await restoreWith(0,true),true));
test("remove token em HTTP 401",async()=>assert.equal(await restoreWith(401),false));
