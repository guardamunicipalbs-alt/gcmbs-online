#!/usr/bin/env bash
# Laboratorio GitHub Actions PostgreSQL 16, NUNCA no GCMBS real.
# Uma transacao segura o contador bloqueado ate COMMIT/ROLLBACK, outra espera.
set -euo pipefail
psql_cmd() { psql -X -v ON_ERROR_STOP=1 -Atqc "$1"; }
marker="/tmp/gcmbs_lab_journal_lock_ready"
rm -f "$marker"
cat > /tmp/gcmbs_lab_journal_hold.sql <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
select gcmbs_sync_v2_lab.append_journal(
  'escalas','fake-concurrent-1',1,'UPSERT',
  '{}'::bigint[],array[7]::bigint[]);
\! touch /tmp/gcmbs_lab_journal_lock_ready
SELECT pg_sleep(2);
COMMIT;
SQL
psql -X -v ON_ERROR_STOP=1 -f /tmp/gcmbs_lab_journal_hold.sql   >/tmp/gcmbs_lab_journal_first.out 2>/tmp/gcmbs_lab_journal_first.err &
pid1=$!
# Só lançar a segunda conexão APÓS a primeira ter adquirido lock.
ready=0
for i in $(seq 1 50); do
  if [[ -f "$marker" ]]; then ready=1; break; fi
  sleep 0.05
done
if [[ $ready -ne 1 ]]; then echo "Primeira transacao nao adquiriu lock"; exit 1; fi
test "$(psql_cmd "select next_seq from gcmbs_sync_v2_lab.journal_counter")" = "5"

psql_cmd "select gcmbs_sync_v2_lab.append_journal(
  'escalas','fake-concurrent-2',1,'UPSERT',
  '{}'::bigint[],array[9]::bigint[])"   >/tmp/gcmbs_lab_journal_second.out 2>/tmp/gcmbs_lab_journal_second.err &
pid2=$!
sleep 0.3
# Com a primeira transacao aberta, seq=6 nao pode estar visivel e
# a segunda ainda nao pode confirmar seq=7.
test "$(psql_cmd "select next_seq from gcmbs_sync_v2_lab.journal_counter")" = "5"
if [[ -s /tmp/gcmbs_lab_journal_second.out ]]; then
  echo "ERRO: seq reservada antes do commit"; exit 1
fi
wait "$pid1"
wait "$pid2"
test "$(psql_cmd "select next_seq from gcmbs_sync_v2_lab.journal_counter")" = "7"
test "$(psql_cmd "select count(*) from gcmbs_sync_v2_lab.commit_journal where seq in (6,7)")" = "2"
test "$(psql_cmd "select seq from gcmbs_sync_v2_lab.commit_journal where record_key='fake-concurrent-1'")" = "6"
test "$(psql_cmd "select seq from gcmbs_sync_v2_lab.commit_journal where record_key='fake-concurrent-2'")" = "7"

# A segunda tentativa fica bloqueada por uma transacao que será revertida.
rm -f "$marker"
cat > /tmp/gcmbs_lab_journal_rollback.sql <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
select gcmbs_sync_v2_lab.append_journal(
  'escalas','fake-rollback',1,'UPSERT',
  '{}'::bigint[],array[7]::bigint[]);
\! touch /tmp/gcmbs_lab_journal_lock_ready
SELECT pg_sleep(2);
ROLLBACK;
SQL
psql -X -v ON_ERROR_STOP=1 -f /tmp/gcmbs_lab_journal_rollback.sql   >/tmp/gcmbs_lab_journal_rollback.out 2>/tmp/gcmbs_lab_journal_rollback.err &
pid1=$!
ready=0
for i in $(seq 1 50); do
  if [[ -f "$marker" ]]; then ready=1; break; fi
  sleep 0.05
done
test "$ready" -eq 1
psql_cmd "select gcmbs_sync_v2_lab.append_journal(
  'escalas','fake-after-rollback',1,'UPSERT',
  '{}'::bigint[],array[9]::bigint[])"   >/tmp/gcmbs_lab_journal_after_rollback.out &
pid2=$!
wait "$pid1"
wait "$pid2"
test "$(psql_cmd "select next_seq from gcmbs_sync_v2_lab.journal_counter")" = "8"
test "$(psql_cmd "select seq from gcmbs_sync_v2_lab.commit_journal where record_key='fake-after-rollback'")" = "8"
test "$(psql_cmd "select count(*) from gcmbs_sync_v2_lab.commit_journal where record_key='fake-rollback'")" = "0"
echo "PASS: journal em ordem de commit, sem entrada prematura e sem lacuna apos rollback"
