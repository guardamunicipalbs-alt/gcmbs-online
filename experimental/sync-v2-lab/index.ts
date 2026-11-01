/**
 * GCMBS Sync V2 - laboratorio isolado, SOMENTE LEITURA, desligado por padrao.
 * Nenhum cliente existente utiliza esta funcao.
 * A ativacao exige GCMBS_SYNC_V2_LAB_ENABLED=1 (NAO CONFIGURAR EM PRODUCAO SEM HOMOLOGACAO).
 * Nao implementa delta final nem escrita: o journal transacional ainda requer auditoria.
 */
import postgres from "npm:postgres@3.4.7";
import { createHash } from "node:crypto";

const VERSION = "v2-lab-2026-11-01";
const ENABLED = Deno.env.get("GCMBS_SYNC_V2_LAB_ENABLED") === "1";
const RESPONSE_MAX_BYTES = 128 * 1024;
const MAX_PAGE = 25;
const MAX_REQUEST_BYTES = 2048;
const ALLOWED = Object.freeze({
  escalas: "escalas",
  permutas: "permutas",
  escalas_extras_manuais: "escala_extra_manual",
  banco_horas_movimentacoes: "banco_horas",
});
let sql = null;
function json(status, body, origin = "") {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "vary": "Origin",
  };
  if (origin === "https://guardamunicipalbs-alt.github.io") {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-headers"] = "authorization, content-type";
    headers["access-control-allow-methods"] = "POST, OPTIONS";
  }
  const data = JSON.stringify(body);
  if (new TextEncoder().encode(data).length > RESPONSE_MAX_BYTES) {
    return new Response(JSON.stringify({ error: "response_too_large", message: "Reduza o tamanho da pagina." }), { status: 413, headers });
  }
  return new Response(data, { status, headers });
}
function tokenFrom(req) {
  const h = req.headers.get("authorization") || "";
  const m = /^Bearer ([0-9a-f]{64})$/i.exec(h);
  return m ? m[1] : "";
}
async function getDb() {
  if (!sql) {
    const url = Deno.env.get("SUPABASE_DB_URL");
    if (!url) throw new Error("database_unconfigured");
    sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5, connect_timeout: 5 });
  }
  return sql;
}
async function authenticate(db, token) {
  const hash = createHash("sha256").update(token).digest("hex");
  const user = await db`
    select s.guarda_id, p.role as profile_role, a.role as account_role,
           p.cargo, p.controle_total, a.senha_trocada,
           coalesce(p.nome_guerra, '') as nome_guerra
    from private.mobile_sessions s
    join private.mobile_auth_accounts a on a.desktop_usuario_id = s.desktop_usuario_id
      and a.guarda_id=s.guarda_id and a.ativo=true
    join public.mobile_profiles p on p.guarda_id = s.guarda_id and p.ativo=true
    where s.token_sha256=${hash} and s.revoked=false and s.expires_at>now()
    limit 1
  `;
  if (!user.length || Number(user[0].senha_trocada || 0) === 0) return null;
  const u = user[0];
  const permissions = await db`
    select modulo, nivel from public.mobile_permissions
    where guarda_id=${Number(u.guarda_id)} and ativo=true
  `;
  return { guarda_id: Number(u.guarda_id), permissions };
}
function canRead(user, entity) {
  const module = ALLOWED[entity];
  if (!module) return false;
  const allowed = new Set([module]);
  if (entity === "escalas") allowed.add("relatorios");
  return user.permissions.some((x) =>
    (allowed.has(String(x.modulo)) || x.modulo === "*")
    && ["CONSULTA", "EDICAO"].includes(String(x.nivel).toUpperCase())
  );
}
function cleanString(value, max) {
  return typeof value === "string" && value.length <= max ? value : "";
}
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") {
    const headers = origin === "https://guardamunicipalbs-alt.github.io"
      ? { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type", "access-control-allow-methods": "POST, OPTIONS", "vary": "Origin" }
      : { "vary": "Origin" };
    return new Response(null, { status: 204, headers });
  }
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_REQUEST_BYTES) return json(413, { error: "request_too_large" }, origin);
  let body = {};
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_REQUEST_BYTES) return json(413, { error: "request_too_large" }, origin);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid");
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }
  // Endpoint de verificacao SEM acesso ao banco e SEM dados institucionais.
  if (body.action === "ping") return json(200, { service: "gcmbs-sync-v2-lab", version: VERSION, enabled: ENABLED, read_only: true }, origin);
  if (!ENABLED) return json(503, { error: "lab_disabled", version: VERSION }, origin);
  const token = tokenFrom(req);
  if (!token) return json(401, { error: "unauthenticated" }, origin);
  if (body.action !== "snapshot_page") return json(404, { error: "not_implemented" }, origin);
  const entity = cleanString(body.entity, 70);
  const after = cleanString(body.after_key, 200);
  const requested = Number(body.limit || 10);
  if (!Object.hasOwn(ALLOWED, entity)) return json(400, { error: "invalid_entity" }, origin);
  if (body.after_key && !after) return json(400, { error: "invalid_cursor" }, origin);
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_PAGE) return json(400, { error: "invalid_limit" }, origin);
  try {
    const db = await getDb();
    const user = await authenticate(db, token);
    if (!user) return json(401, { error: "invalid_session" }, origin);
    if (!canRead(user, entity)) return json(403, { error: "forbidden" }, origin);
    // Escopo individual sempre obrigatorio no laboratorio, inclusive para o Comando.
    // Todas as linhas, inclusive tombstones, sao filtradas NO SERVIDOR.
    const rows = await db`
      select record_key, revision, updated_at, deleted, data
      from public.mobile_entity_records
      where entity=${entity} and ${user.guarda_id}=any(scope_guard_ids)
        and record_key>${after}
      order by record_key asc limit ${requested + 1}
    `;
    const has_more = rows.length > requested;
    const page = rows.slice(0, requested);
    return json(200, {
      contract: "GCMBS_SYNC_V2_LAB",
      entity, guarda_id: user.guarda_id,
      records: page.map((r) => ({
        key: r.record_key, revision: String(r.revision),
        updated_at: r.updated_at, deleted: !!r.deleted,
        data: r.deleted ? null : r.data,
      })),
      has_more,
      next_after_key: has_more ? page[page.length - 1].record_key : null,
      consistency: "experimental_snapshot_not_transactionally_frozen",
    }, origin);
  } catch (err) {
    // Nunca expor mensagens internas de SQL, tokens ou dados.
    console.error("[GCMBS SYNC V2 LAB] Erro interno:", err?.name || "unknown");
    return json(503, { error: "lab_unavailable" }, origin);
  }
});
