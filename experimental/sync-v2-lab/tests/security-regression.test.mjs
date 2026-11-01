import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const api = readFileSync(join(dir, "../../../supabase/functions/gcmbs-mobile-api-v6/index.ts"), "utf8");

test("justificativas filtradas no banco ANTES de trafegar",()=>{
  const line=api.split("\n").find(x=>x.includes("const justificativas="));
  assert.ok(line, "action references inexistente");
  assert.match(line, /justificativas_faltas/);
  assert.match(line, /gestor\(u\)/);
  assert.match(line, /data->>'guarda_id'=\$\{String\(gid\)\}/);
  assert.match(line, /where entity='justificativas_faltas' and deleted=false and/);
});
test("API v6 continua com verificacao de sessao em todas as acoes exceto login",()=>{
  assert.match(api, /const token=bearer\(req\),u=await sessionByToken\(token\)/);
  assert.match(api, /if\(!u\)return reply\(401/);
});
test("a feature experimental nao altera action:data da API corrente",()=>{
  const dataAction=api.split("\n").find(x=>x.includes("if(action==='data')"));
  assert.ok(dataAction,"a acao data legada deve ficar intacta");
});
