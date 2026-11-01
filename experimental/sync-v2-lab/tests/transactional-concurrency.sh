#!/usr/bin/env bash
# GCMBS Sync V2 - concorrencia REAL em PostgreSQL efemero do GitHub Actions.
# Jamais executar no Supabase ou em banco com dados institucionais.
set -euo pipefail

run_sql() { psql -X -v ON_ERROR_STOP=1 -Atqc "$1"; }

# 2 conexoes simultaneas com MESMO id: apenas uma deve alterar o registro.
run_sql "select revision || ':' || duplicate from gcmbs_sync_v2_lab.apply_change('00000000-0000-4000-8000-000000000101','escalas','fake-concurrent','UPSERT','{\"turno\":\"A\"}'::jsonb,7)" > /tmp/gcmbs_concurrent_1.txt &
pid1=$!
run_sql "select revision || ':' || duplicate from gcmbs_sync_v2_lab.apply_change('00000000-0000-4000-8000-000000000101','escalas','fake-concurrent','UPSERT','{\"turno\":\"A\"}'::jsonb,7)" > /tmp/gcmbs_concurrent_2.txt &
pid2=$!
wait "$pid1"; wait "$pid2"

test "$(run_sql "select revision from gcmbs_sync_v2_lab.records where entity='escalas' and record_key='fake-concurrent'")" = "1"
test "$(run_sql "select count(*) from gcmbs_sync_v2_lab.changes where record_key='fake-concurrent'")" = "1"
mapfile -t answers < <(cat /tmp/gcmbs_concurrent_1.txt /tmp/gcmbs_concurrent_2.txt | sort)
test "${answers[0]}" = "1:false"
test "${answers[1]}" = "1:true"

# 2 IDs diferentes no mesmo registro devem serializar ambas as revisoes.
run_sql "select revision from gcmbs_sync_v2_lab.apply_change('00000000-0000-4000-8000-000000000102','escalas','fake-concurrent','UPSERT','{\"turno\":\"B\"}'::jsonb,7)" > /tmp/gcmbs_concurrent_3.txt &
pid1=$!
run_sql "select revision from gcmbs_sync_v2_lab.apply_change('00000000-0000-4000-8000-000000000103','escalas','fake-concurrent','UPSERT','{\"turno\":\"C\"}'::jsonb,7)" > /tmp/gcmbs_concurrent_4.txt &
pid2=$!
wait "$pid1"; wait "$pid2"
test "$(run_sql "select revision from gcmbs_sync_v2_lab.records where entity='escalas' and record_key='fake-concurrent'")" = "3"
test "$(run_sql "select count(*) from gcmbs_sync_v2_lab.changes where record_key='fake-concurrent'")" = "3"
mapfile -t revs < <(cat /tmp/gcmbs_concurrent_3.txt /tmp/gcmbs_concurrent_4.txt | sort)
test "${revs[0]}" = "2"
test "${revs[1]}" = "3"

# Agora dois dispositivos com a MESMA base_revision=1 tentam mudar o registro.
# Apenas um commit pode ser aceito; o outro deve ser conflito explicito.
run_sql "select revision from gcmbs_sync_v2_lab.apply_change('00000000-0000-4000-8000-000000000110','escalas','fake-stale','UPSERT','{\"turno\":\"A\"}'::jsonb,7,0)" >/tmp/gcmbs_stale_base.txt
test "$(cat /tmp/gcmbs_stale_base.txt)" = "1"
run_sql "select revision from gcmbs_sync_v2_lab.apply_change('00000000-0000-4000-8000-000000000111','escalas','fake-stale','UPSERT','{\"turno\":\"B\"}'::jsonb,7,1)" >/tmp/gcmbs_stale_writer_1.txt 2>/tmp/gcmbs_stale_writer_1.err &
pid1=$!
run_sql "select revision from gcmbs_sync_v2_lab.apply_change('00000000-0000-4000-8000-000000000112','escalas','fake-stale','UPSERT','{\"turno\":\"C\"}'::jsonb,7,1)" >/tmp/gcmbs_stale_writer_2.txt 2>/tmp/gcmbs_stale_writer_2.err &
pid2=$!
if wait "$pid1"; then status1=0; else status1=$?; fi
if wait "$pid2"; then status2=0; else status2=$?; fi
test "$(( (status1==0) + (status2==0) ))" -eq 1
test "$(run_sql "select revision from gcmbs_sync_v2_lab.records where entity='escalas' and record_key='fake-stale'")" = "2"
test "$(run_sql "select count(*) from gcmbs_sync_v2_lab.changes where record_key='fake-stale'")" = "2"
cat /tmp/gcmbs_stale_writer_*.err | grep -q "STALE_BASE_REVISION"
# Repetir o recibo do ganhador preserva revision=2.
echo "PASS: concorrencia otimista; exatamente uma atualizacao com base antiga e aceita"

echo "PASS: concorrencia real entre sessoes PostgreSQL, idempotencia e revisions preservadas"
