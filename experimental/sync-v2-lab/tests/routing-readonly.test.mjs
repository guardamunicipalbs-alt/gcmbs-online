import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir=dirname(fileURLToPath(import.meta.url));
const source=readFileSync(join(dir,"../../../js/data-provider.js"),"utf8")
  .replace(/^import .*;\s*$/gm,"")
  .replace("export class AuthenticatedProvider","class AuthenticatedProvider")
  +"\nreturn AuthenticatedProvider;";
const Provider=new Function("MODULOS_GCMBS","normalizarPerfil","controleTotal",source)([],()=>({}),()=>false);

async function route(action,payload={}){
  const p=new Provider();
  p.endpoint=async(url,a,body)=>({url,action:a,body});
  return (await p.call(action,payload)).url;
}
test("entity_catalog vai direto a API central",async()=>{
  assert.match(await route("entity_catalog"),/gcmbs-mobile-api-v6$/);
});
test("listagens comuns dispensam gateways",async()=>{
  for(const entity of ["escalas","permutas","viaturas","banco_horas_movimentacoes"]){
    assert.match(await route("entity_list",{entity}),/gcmbs-mobile-api-v6$/);
  }
});
test("listagens com tratamento especial continuam no gateway",async()=>{
  for(const entity of ["justificativas_faltas","ocorrencias_operacionais","eventos_extras"]){
    assert.match(await route("entity_list",{entity}),/gcmbs-communication-gateway-v74$/);
  }
});
test("entity_get e outros tratamentos especiais continuam no gateway",async()=>{
  assert.match(await route("entity_get",{entity:"justificativas_faltas"}),/gcmbs-communication-gateway-v74$/);
  assert.match(await route("quadro_operacional"),/gcmbs-communication-gateway-v74$/);
});
test("acoes de escrita NAO sao reroteadas pelo novo otimizador",async()=>{
  assert.match(await route("entity_mutate",{entity:"viaturas"}),/gcmbs-communication-gateway-v74$/);
  assert.match(await route("decide_permuta_request"),/gcmbs-communication-gateway-v74$/);
});
