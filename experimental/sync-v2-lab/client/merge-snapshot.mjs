// Nucleo puro de conciliacao. Nao armazena dados, tokens ou historicos.
// Sera ligado a SQLite/IndexedDB somente apos homologacao do Android.
export function mergeSnapshotPage(current, response) {
  if (!(current instanceof Map)) throw new TypeError("Esperado Map local");
  if (!response || response.contract !== "GCMBS_SYNC_V2_LAB") throw new Error("Contrato incompativel");
  if (!Array.isArray(response.records) || response.records.length > 25) throw new Error("Pagina invalida");
  if (typeof response.entity !== "string" || !response.entity) throw new Error("Entidade ausente");
  const merged = new Map(current);
  let applied = 0, unchanged = 0;
  const receivedKeys = new Set();
  for (const row of response.records) {
    if (!row || typeof row.key !== "string" || row.key.length < 1) throw new Error("Chave invalida");
    if (receivedKeys.has(row.key)) throw new Error("Chave repetida na pagina");
    receivedKeys.add(row.key);
    const rev = String(row.revision || "");
    if (!/^[1-9][0-9]*$/.test(rev)) throw new Error("Revisao invalida");
    const key = response.entity + ":" + row.key;
    const old = merged.get(key);
    const oldRev = old ? BigInt(old.revision) : 0n;
    const newRev = BigInt(rev);
    if (newRev < oldRev) { unchanged++; continue; }
    const next = { revision: rev, updated_at: row.updated_at || null, deleted: row.deleted === true, data: row.deleted === true ? null : row.data };
    if (old && newRev === oldRev) {
      if (JSON.stringify(old) !== JSON.stringify(next)) throw new Error("Conflito: revisao igual e conteudo diferente");
      unchanged++;
      continue;
    }
    merged.set(key, next); // tombstones ficam armazenados para evitar ressurreicao de registros
    applied++;
  }
  return { records: merged, applied, unchanged,
    next_after_key: response.next_after_key ?? null, has_more: response.has_more === true };
}
export function visibleRecords(merged, entity) {
  if (!(merged instanceof Map)) throw new TypeError("Esperado Map");
  const prefix = String(entity) + ":";
  return [...merged.entries()].filter(([key, row]) => key.startsWith(prefix) && !row.deleted)
    .map(([key, row]) => ({ key: key.slice(prefix.length), ...row }));
}
