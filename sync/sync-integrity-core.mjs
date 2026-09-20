/**
 * GCMBS V170 — núcleo determinístico de conciliação, sem I/O e sem escrita.
 * O integrador deve verificar revisão/tombstone no banco dentro da transação,
 * confirmar o commit SQLite e só depois emitir ACK por dispositivo.
 */
import { createHash } from 'node:crypto';
const timestampsTecnicos = new Set(['folha_pagamento_arredondamentos','folha_pagamento_banco_horas','folha_pagamento_config','folha_pagamento_parametros']);
const hash = value => createHash('sha256').update(value).digest('hex');
const str = value => String(value ?? '').trim();
const key = row => `${str(row.entity)}\u0000${str(row.record_key)}`;
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k => [k, ordered(value[k])])) : value;
export function semanticData(entity, input) {
  const result = { ...(input ?? {}) };
  if (entity === 'banco_horas_movimentacoes') {
    for (const field of ['transferencia_destino','movimento_vinculado_id','origem_id']) if (result[field] === null || result[field] === undefined || result[field] === '') delete result[field];
  }
  if (timestampsTecnicos.has(entity)) delete result.atualizado_em;
  return ordered(result);
}
export function fingerprint(row) {
  return JSON.stringify(ordered({module: row.module ?? row.modulo ?? '', scope: [...(row.scope_guard_ids ?? [])].map(Number).sort((a,b) => a-b), data: semanticData(row.entity,row.data)}));
}
function index(rows,label) {
  const result = new Map();
  for (const row of rows) {
    if (!str(row.entity) || !str(row.record_key)) throw new Error(`${label}: missing entity/record_key`);
    const id=key(row);
    if (result.has(id)) throw new Error(`${label}: duplicate identity ${id}`);
    result.set(id,row);
  }
  return result;
}
// Um backup não é checkpoint. Exige RUN concluído, sem conflitos, aplicação verificada e hash.
export function successfulBaseline(backups,runs,clientName) {
  const eligible=backups.filter(b => b.client_name===clientName && runs.some(r => r.client_name===clientName && r.snapshot_id===b.snapshot_id && r.status==='OK' && r.applied_verified===true && Number(r.conflict_count ?? 0)===0 && !!r.completed_at && (!r.content_hash || !b.snapshot_sha256 || r.content_hash===b.snapshot_sha256)));
  return eligible.sort((a,b) => Date.parse(b.created_at)-Date.parse(a.created_at))[0] ?? null;
}
const equivalent=(a,b) => fingerprint(a)===fingerprint(b);
const changeId=(kind,row,revision) => `gcmbs-v170:${hash(JSON.stringify([kind,str(row.entity),str(row.record_key),revision,fingerprint(row)]))}`;
const identityFields=['guarda_id','competencia','data_fato','natureza','classe','minutos'];
function bankIdentityCompatible(local,cloud) {
  if(local.entity!=='banco_horas_movimentacoes')return true;
  const a=local.data??{},b=cloud.data??{};
  return ['guarda_id','competencia','minutos'].every(field=>a[field]!==undefined&&b[field]!==undefined) && identityFields.every(field=>String(a[field]??'')===String(b[field]??''));
}
/** Plano somente leitura: no banco é obrigatório compare-and-swap transacional. */
export function reconcile({previous=[],current=[],cloud=[],tombstoneHistory=[],pendingKeys=[]}) {
  const prev=index(previous,'previous'),local=index(current,'current'),remote=index(cloud,'cloud');
  const deleted=new Set(tombstoneHistory.map(x => typeof x==='string'?x:key(x)));
  const pending=new Set(pendingKeys.map(x => typeof x==='string'?x:key(x)));
  const plan={inserts:[],updates:[],deletes:[],conflicts:[],noops:[],cloudOnly:[]};
  for(const [id,incoming] of local) {
    const old=prev.get(id),live=remote.get(id),explicitlyDeleted=incoming.deleted===true;
    if(explicitlyDeleted) {
      if(!live||live.deleted){plan.noops.push(id);continue;}
      if(!old||!equivalent(live,old)||!bankIdentityCompatible(incoming,live)){plan.conflicts.push({id,reason:'unsafe-explicit-delete'});continue;}
      plan.deletes.push({id,expectedRevision:live.revision,changeId:changeId('DELETE',incoming,live.revision)});continue;
    }
    if(!live) {
      if(deleted.has(id)||pending.has(id)){plan.conflicts.push({id,reason:'missing-but-tombstoned-or-pending'});continue;}
      plan.inserts.push({id,row:incoming,expectedAbsent:true,changeId:changeId('UPSERT',incoming,null)});continue;
    }
    if(live.deleted){plan.conflicts.push({id,reason:'legitimate-cloud-tombstone'});continue;}
    if(!bankIdentityCompatible(incoming,live)){plan.conflicts.push({id,reason:'bank-identity-collision'});continue;}
    if(equivalent(incoming,live)){plan.noops.push(id);continue;}
    if(!old){plan.conflicts.push({id,reason:'same-key-without-common-ancestor'});continue;}
    if(equivalent(incoming,old)){plan.cloudOnly.push({id,reason:'cloud-is-newer'});continue;}
    if(!equivalent(live,old)){plan.conflicts.push({id,reason:'concurrent-modification'});continue;}
    plan.updates.push({id,row:incoming,expectedRevision:live.revision,changeId:changeId('UPSERT',incoming,live.revision)});
  }
  for(const [id] of prev)if(!local.has(id))plan.cloudOnly.push({id,reason:'absence-is-not-deletion'});
  for(const [id] of remote)if(!local.has(id)&&!prev.has(id))plan.cloudOnly.push({id,reason:'remote-only'});
  return plan;
}
// HTTP 200 nunca prova sincronização total sem validação das três plataformas.
export function completenessGate({runStatus,localCommitted,pending,conflicts,ackErrors,mismatches,webVerified,androidVerified}) {
  return runStatus==='OK' && localCommitted===true && pending===0 && conflicts===0 && ackErrors===0 && mismatches===0 && webVerified===true && androidVerified===true;
}
