-- GCMBS Sync V2 — contrato de mutação idempotente e transacional.
-- APENAS CI: PostgreSQL DESCARTAVEL do GitHub Actions.
-- Nunca aplicar no Supabase GCMBS oficial. Nao usa dados reais.
\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA gcmbs_sync_v2_lab;

CREATE TABLE gcmbs_sync_v2_lab.records(
  entity text not null, record_key text not null,
  revision bigint not null check (revision>0),
  deleted boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  primary key(entity,record_key)
);
CREATE TABLE gcmbs_sync_v2_lab.changes(
  client_change_id text primary key,
  entity text not null,
  record_key text not null,
  operation text not null check (operation in ('UPSERT','DELETE')),
  payload jsonb not null,
  actor_guard_id bigint not null,
  revision bigint not null,
  created_at timestamptz not null default now()
);

CREATE OR REPLACE FUNCTION gcmbs_sync_v2_lab.apply_change(
  p_id text,p_entity text,p_key text,
  p_operation text,p_payload jsonb,p_actor bigint,
  p_base_revision bigint default null
)
RETURNS TABLE(record_key text, revision bigint, duplicate boolean)
LANGUAGE plpgsql
SET search_path=pg_catalog,gcmbs_sync_v2_lab
AS $fn$
DECLARE
  prior gcmbs_sync_v2_lab.changes%rowtype;
  v_revision bigint;
  v_observed_revision bigint;
  v_op text := upper(p_operation);
BEGIN
  if p_id is null or length(p_id)<20 or length(p_id)>80 or
     p_entity is null or p_entity='' or
     p_key is null or p_key='' or
     p_actor is null or p_actor<=0 or
     p_payload is null or jsonb_typeof(p_payload)<>'object' or
     v_op not in ('UPSERT','DELETE') then
    raise exception 'INVALID_CHANGE';
  end if;
  -- A chave de idempotencia precisa ser travada ANTES de consultar o recibo.
  perform pg_advisory_xact_lock(hashtextextended('gcmbs-change:'||p_id,0));
  select * into prior from gcmbs_sync_v2_lab.changes
    where client_change_id=p_id;
  if found then
    if prior.entity is distinct from p_entity or
       prior.record_key is distinct from p_key or
       prior.operation is distinct from v_op or
       prior.actor_guard_id is distinct from p_actor or
       prior.payload is distinct from p_payload then
      raise exception 'ID_REUSED_WITH_DIFFERENT_REQUEST';
    end if;
    return query select prior.record_key,prior.revision,true;
    return;
  end if;

  -- A segunda trava impede conflito entre IDs diferentes no MESMO registro.
  perform pg_advisory_xact_lock(hashtextextended('gcmbs-record:'||p_entity||':'||p_key,1));

  -- Revision otimista protege alteracoes concorrentes de clientes desconectados.
  -- Prior receipt e verificado ANTES: retry com ID identico nao vira conflito
  -- apenas porque outro GCM alterou o registro entre a primeira chamada e retry.
  if p_base_revision is not null then
    select r.revision into v_observed_revision
    from gcmbs_sync_v2_lab.records r
    where r.entity=p_entity and r.record_key=p_key;
    if coalesce(v_observed_revision,0) <> p_base_revision
       or p_base_revision<0 then
      raise exception 'STALE_BASE_REVISION';
    end if;
  end if;
  if v_op='UPSERT' then
    insert into gcmbs_sync_v2_lab.records(entity,record_key,revision,deleted,data)
      values(p_entity,p_key,1,false,p_payload)
    on conflict on constraint records_pkey do update
      set revision=gcmbs_sync_v2_lab.records.revision+1,deleted=false,
          data=excluded.data
    returning gcmbs_sync_v2_lab.records.revision into v_revision;
  else
    update gcmbs_sync_v2_lab.records as r set
      revision=r.revision+1,deleted=true
      where r.entity=p_entity and r.record_key=p_key and r.deleted=false
    returning r.revision into v_revision;
    if not found then raise exception 'CANNOT_DELETE_ABSENT_RECORD'; end if;
  end if;

  insert into gcmbs_sync_v2_lab.changes(
    client_change_id,entity,record_key,operation,payload,actor_guard_id,revision
  )values(p_id,p_entity,p_key,v_op,p_payload,p_actor,v_revision);
  return query select p_key,v_revision,false;
END;
$fn$;

-- Simula erro na fila APOS a atualizacao do registro: a transacao deve
-- reverter as DUAS gravacoes. Teste deliberadamente forcado, nao de producao.
CREATE OR REPLACE FUNCTION gcmbs_sync_v2_lab.fail_queue_for_test()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $fn$
BEGIN
  if NEW.payload ? '__force_test_insert_error__' then
    raise exception 'SIMULATED_QUEUE_FAILURE';
  end if;
  return NEW;
END;
$fn$;
CREATE TRIGGER force_test_queue_failure
BEFORE INSERT ON gcmbs_sync_v2_lab.changes FOR EACH ROW
EXECUTE FUNCTION gcmbs_sync_v2_lab.fail_queue_for_test();

DO $test$
DECLARE
  got record;
  n bigint;
BEGIN
  -- UPSERT confirmado: 1 registro, 1 recibo, revision 1.
  select * into got from gcmbs_sync_v2_lab.apply_change(
    '00000000-0000-4000-8000-000000000001','escalas','fake-A',
    'UPSERT','{"turno":"A"}'::jsonb,7);
  if got.revision<>1 or got.duplicate then raise exception 'TEST_FIRST_UPSERT_FAILED'; end if;

  -- Reenvio exato nao incrementa a revisao ou adiciona fila.
  select * into got from gcmbs_sync_v2_lab.apply_change(
    '00000000-0000-4000-8000-000000000001','escalas','fake-A',
    'UPSERT','{"turno":"A"}'::jsonb,7);
  if got.revision<>1 or not got.duplicate then raise exception 'TEST_IDEMPOTENCY_FAILED'; end if;

  -- Reuso de ID com conteudo diferente é recusado sem alterar o registro.
  begin
    perform * from gcmbs_sync_v2_lab.apply_change(
      '00000000-0000-4000-8000-000000000001','escalas','fake-A',
      'UPSERT','{"turno":"B"}'::jsonb,7);
    raise exception 'TEST_EXPECTED_REUSE_REJECTION';
  exception when others then
    if sqlerrm<>'ID_REUSED_WITH_DIFFERENT_REQUEST' then raise; end if;
  end;

  -- Segundo ID altera o mesmo registro, revision 2.
  select * into got from gcmbs_sync_v2_lab.apply_change(
    '00000000-0000-4000-8000-000000000002','escalas','fake-A',
    'UPSERT','{"turno":"B"}'::jsonb,7);
  if got.revision<>2 or got.duplicate then raise exception 'TEST_SECOND_UPSERT_FAILED'; end if;

  -- Se a escrita na FILA falhar, a nova revisao tambem precisa reverter.
  begin
    perform * from gcmbs_sync_v2_lab.apply_change(
      '00000000-0000-4000-8000-000000000003','escalas','fake-A',
      'UPSERT','{"__force_test_insert_error__":true}'::jsonb,7);
    raise exception 'TEST_EXPECTED_QUEUE_FAILURE';
  exception when others then
    if sqlerrm<>'SIMULATED_QUEUE_FAILURE' then raise; end if;
  end;
  select revision into n from gcmbs_sync_v2_lab.records where entity='escalas' and record_key='fake-A';
  if n<>2 then raise exception 'TEST_ROLLBACK_FAILED'; end if;
  if exists(select 1 from gcmbs_sync_v2_lab.changes
    where client_change_id='00000000-0000-4000-8000-000000000003') then
    raise exception 'TEST_PHANTOM_QUEUE_ENTRY';
  end if;

  -- Criar com base 0 falha se chave ja existe.
  begin
    perform * from gcmbs_sync_v2_lab.apply_change(
      '00000000-0000-4000-8000-000000000006','escalas','fake-A',
      'UPSERT','{"turno":"C"}'::jsonb,7,0);
    raise exception 'TEST_EXPECTED_STALE_BASE';
  exception when others then
    if sqlerrm<>'STALE_BASE_REVISION' then raise; end if;
  end;
  if (select revision from gcmbs_sync_v2_lab.records where
    entity='escalas' and record_key='fake-A')<>2 then
      raise exception 'TEST_STALE_BASE_CHANGED_RECORD';
  end if;

  -- Atualizacao com base 2 e valida. ID igual refeito com base 2
  -- confirma sem incrementar revisao.
  select * into got from gcmbs_sync_v2_lab.apply_change(
    '00000000-0000-4000-8000-000000000007','escalas','fake-A',
    'UPSERT','{"turno":"C"}'::jsonb,7,2);
  if got.revision<>3 or got.duplicate then raise exception 'TEST_OPTIMISTIC_UPSERT_FAILED'; end if;
  select * into got from gcmbs_sync_v2_lab.apply_change(
    '00000000-0000-4000-8000-000000000007','escalas','fake-A',
    'UPSERT','{"turno":"C"}'::jsonb,7,2);
  if got.revision<>3 or not got.duplicate then raise exception 'TEST_OPTIMISTIC_RETRY_FAILED'; end if;

  -- Excluir duas vezes com ID diferente precisa falhar; retry do MESMO ID idem.
  select * into got from gcmbs_sync_v2_lab.apply_change(
    '00000000-0000-4000-8000-000000000004','escalas','fake-A',
    'DELETE','{}'::jsonb,7);
  if got.revision<>4 or got.duplicate then raise exception 'TEST_DELETE_FAILED'; end if;
  select * into got from gcmbs_sync_v2_lab.apply_change(
    '00000000-0000-4000-8000-000000000004','escalas','fake-A',
    'DELETE','{}'::jsonb,7);
  if got.revision<>4 or not got.duplicate then raise exception 'TEST_DELETE_RETRY_FAILED'; end if;
  begin
    perform * from gcmbs_sync_v2_lab.apply_change(
      '00000000-0000-4000-8000-000000000005','escalas','fake-A',
      'DELETE','{}'::jsonb,7);
    raise exception 'TEST_EXPECTED_MISSING_DELETE';
  exception when others then
    if sqlerrm<>'CANNOT_DELETE_ABSENT_RECORD' then raise; end if;
  end;
  if (select revision from gcmbs_sync_v2_lab.records where
      entity='escalas' and record_key='fake-A')<>4 then
    raise exception 'TEST_DELETE_REVISION_CHANGED';
  end if;
  if (select count(*) from gcmbs_sync_v2_lab.changes)<>4 then
    raise exception 'TEST_WRONG_RECEIPT_COUNT';
  end if;
  raise notice 'PASS: atomicity, duplicate receipts, payload conflicts, rollback, base_revision conflicts, delete';
END;
$test$;
-- O banco e totalmente DESCARTAVEL no GitHub Actions. A definicao fica
-- disponivel APENAS para o teste de concorrencia deste mesmo job.
COMMIT;
