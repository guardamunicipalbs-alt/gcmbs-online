import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(dir, "../index.ts"), "utf8")
  .replace(/^import .*;\\s*$/gm, "");
function makeApp({ active = false, permissions = [], rows = [] } = {}) {
  let handler;
  let queries = [];
  const db = (strings, ...values) => {
    const query = strings.join("?").replace(/\\s+/g, " ");
    queries.push({ query, values });
    if (query.includes("private.mobile_sessions")) return [{ guarda_id: 7, senha_trocada: 1 }];
    if (query.includes("public.mobile_permissions")) return permissions;
    if (query.includes("public.mobile_entity_records")) return rows;
    throw new Error("Query inesperada");
  };
  const Deno = {
    env: { get: (name) => name === "GCMBS_SYNC_V2_LAB_ENABLED" ? (active ? "1" : null) : "postgres://example.invalid" },
    serve: (fn) => { handler = fn; },
  };
  const createHash = () => ({ update: () => ({ digest: () => "mocksha" }) });
  new Function("Deno", "postgres", "createHash", "Response", "TextEncoder", source)(
    Deno, () => db, createHash, Response, TextEncoder
  );
  const request = (body, token = "", method = "POST") => new Request("https://example.invalid/", {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    ...(method !== "GET" && method !== "OPTIONS" ? { body: JSON.stringify(body) } : {}),
  });
  return { handler, request, queries };
}
const TOKEN = "a".repeat(64);

test("ping without DB access", async () => {
  const app = makeApp();
  const res = await app.handler(app.request({ action: "ping" }));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).enabled, false);
  assert.equal(app.queries.length, 0);
});
test("disabled lab cannot query database", async () => {
  const app = makeApp();
  const res = await app.handler(app.request({ action: "snapshot_page", entity: "escalas" }, TOKEN));
  assert.equal(res.status, 503);
  assert.equal(app.queries.length, 0);
});
test("enabled lab denies requests without bearer token", async () => {
  const app = makeApp({ active: true });
  const res = await app.handler(app.request({ action: "snapshot_page", entity: "permutas" }));
  assert.equal(res.status, 401);
  assert.equal(app.queries.length, 0);
});
test("denies entities without permission", async () => {
  const app = makeApp({ active: true, permissions: [] });
  const res = await app.handler(app.request({ action: "snapshot_page", entity: "permutas" }, TOKEN));
  assert.equal(res.status, 403);
  assert.equal(app.queries.length, 2);
});
test("allowed scope is enforced at the server query", async () => {
  const app = makeApp({
    active: true,
    permissions: [{ modulo: "permutas", nivel: "CONSULTA" }],
    rows: [{ record_key: "a", revision: 2, updated_at: "2026-11-01T00:00:00Z", deleted: false, data: { status: "PENDENTE" } }],
  });
  const res = await app.handler(app.request({ action: "snapshot_page", entity: "permutas", limit: 1 }, TOKEN));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store, max-age=0");
  const json = await res.json();
  assert.equal(json.records.length, 1);
  const query = app.queries.find((q) => q.query.includes("public.mobile_entity_records"));
  assert.ok(query.query.includes("any(scope_guard_ids)"));
  assert.ok(query.values.includes(7));
});
test("reject invalid page limits before database", async () => {
  const app = makeApp({ active: true });
  const res = await app.handler(app.request({ action: "snapshot_page", entity: "permutas", limit: 300 }, TOKEN));
  assert.equal(res.status, 400);
  assert.equal(app.queries.length, 0);
});
test("GET is rejected", async () => {
  const app = makeApp();
  const res = await app.handler(app.request({}, "", "GET"));
  assert.equal(res.status, 405);
});
