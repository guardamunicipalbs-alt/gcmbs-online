-- GCMBS Sync V2 / CI EXCLUSIVO: ordem de COMMIT e mudanca de escopo.
-- Arquivo nao e migracao. NUNCA executar no Supabase oficial.
-- Testa somente metadados, sem CPF, oficios, saldos ou dados reais.
\set ON_ERROR_STOP on

CREATE TABLE gcmbs_sync_v2_lab.journal_counter(
  singleton boolean primary key default true check(singleton),
  next_seq bigint not null check(next_seq>=0),
  retained_after bigint not null default 0 check(retained_after>=0 and retained_after<=next_seq)
);
INSERT INTO gcmbs_sync_v2_lab.journal_counter(singleton,next_seq)
VALUES(true,0);
CREATE TABLE gcmbs_sync_v2_lab.commit_journal(
  seq bigint primary key,
  entity text not null,
  record_key text not null,
  revision bigint not null check(revision>0),
  operation text not null check(operation in ('UPSERT','DELETE')),
  old_scope_guard_ids bigint[] not null,
  new_scope_guard_ids bigint[] not null,
  created_at timestamptz not null default now()
);
-- Sem dados operacionais no journal. O servidor deve buscar o registro canonico
-- somente quando a autorizacao do usuario ainda for valida.

CREATE OR REPLACE FUNCTION gcmbs_sync_v2_lab.append_journal(
  p_entity text,p_key text,p_revision bigint,
  p_operation text,p_old_scope bigint[],p_new_scope bigint[]
)
RETURNS bigint
LANGUAGE plpgsql
SET search_path=pg_catalog,gcmbs_sync_v2_lab
AS $fn$
DECLARE
  v_seq bigint;
BEGIN
  if p_entity is null or p_entity !~ '^[a-z_]{2,70}$' or
     p_key is null or length(p_key)<1 or length(p_key)>300 or
     p_revision is null or p_revision<=0 or
     p_operation not in ('UPSERT','DELETE') or
     p_old_scope is null or p_new_scope is null or
     exists(select 1 from unnest(p_old_scope || p_new_scope) v where v is null or v<=0) or
     (p_operation='DELETE' and cardinality(p_new_scope)<>0) then
    raise exception 'INVALID_JOURNAL_EVENT';
  end if;

  -- ESTE UPDATE PRECISA SER FEITO NO MESMO COMMIT QUE O DADO CANONICO.
  -- O lock na linha singleton impede que outra transacao reserve um numero
  -- enquanto esta ainda nao confirmou/desfez sua atualizacao.
  update gcmbs_sync_v2_lab.journal_counter
    set next_seq=next_seq+1 where singleton=true returning next_seq into v_seq;
  if v_seq is null then raise exception 'MISSING_COUNTER'; end if;
  insert into gcmbs_sync_v2_lab.commit_journal(
    seq,entity,record_key,revision,operation,old_scope_guard_ids,new_scope_guard_ids
  )values(v_seq,p_entity,p_key,p_revision,p_operation,p_old_scope,p_new_scope);
  return v_seq;
END;
$fn$;

-- A API chama esta funcao SOMENTE com a identidade validada no servidor.
-- A entrega e por quantidade de eventos BRUTOS varridos: mesmo 0 eventos
-- visiveis pode avancar o cursor; sem isso um GCM ficaria preso.
-- Retorna no maximo 25 metadados visiveis; para cada REMOVE entrega apenas
-- a chave minima para excluir localmente, nunca dados sensiveis novos.
CREATE OR REPLACE FUNCTION gcmbs_sync_v2_lab.scan_journal(
  p_guard_id bigint,p_after bigint,p_until bigint,p_limit integer default 25
)
RETURNS TABLE(next_after bigint,events jsonb,scanned_count bigint)
LANGUAGE plpgsql
SET search_path=pg_catalog,gcmbs_sync_v2_lab
AS $fn$
BEGIN
  if p_guard_id is null or p_guard_id<=0 or p_after is null or p_after<0 or
     p_until is null or p_until<p_after or
     p_limit is null or p_limit<1 or p_limit>25 then
    raise exception 'INVALID_SCAN_PARAMS';
  end if;
  -- Cursor anterior ao limiar de retencao NAO pode receber pagina vazia.
  -- Deve iniciar novo bootstrap consistente apos aviso CURSOR_EXPIRED.
  if p_after < (select c.retained_after from gcmbs_sync_v2_lab.journal_counter c
                where c.singleton=true) then
    raise exception 'CURSOR_EXPIRED';
  end if;
  return query
  with batch as materialized (
    select j.seq,j.entity,j.record_key,j.revision,j.operation,
           j.old_scope_guard_ids,j.new_scope_guard_ids
    from gcmbs_sync_v2_lab.commit_journal j
    where j.seq>p_after and j.seq<=p_until
    order by j.seq limit p_limit
  ), visible as (
    select j.seq,
      jsonb_build_object('seq',j.seq,'entity',j.entity,'record_key',j.record_key,
        'revision',j.revision,
        'action',case
          when p_guard_id=any(j.new_scope_guard_ids) and j.operation='UPSERT'
          then 'UPSERT' else 'REMOVE' end) as item
    from batch j
    where p_guard_id=any(j.old_scope_guard_ids)
       or p_guard_id=any(j.new_scope_guard_ids)
  )
  select coalesce((select max(b.seq) from batch b),p_after),
    coalesce((select jsonb_agg(v.item order by v.seq) from visible v),'[]'::jsonb),
    (select count(*) from batch)::bigint;
END;
$fn$;

-- Nunca rodar rotina de compactacao na base GCMBS oficial.
-- Prototipo de retencao SOMENTE em banco EFEMERO. Operacao atomica:
-- avanca limiar e remove metadados antigos sob o MESMO lock de versao.
CREATE OR REPLACE FUNCTION gcmbs_sync_v2_lab.prune_through(p_until bigint)
RETURNS bigint
LANGUAGE plpgsql
SET search_path=pg_catalog,gcmbs_sync_v2_lab
AS $fn$
DECLARE
  current_seq bigint;
  floor_seq bigint;
  rows_removed bigint;
BEGIN
  if p_until is null or p_until<0 then raise exception 'INVALID_PRUNE'; end if;
  select c.next_seq,c.retained_after into current_seq,floor_seq
    from gcmbs_sync_v2_lab.journal_counter c
    where c.singleton=true for update;
  if p_until<floor_seq or p_until>current_seq then raise exception 'INVALID_PRUNE'; end if;
  update gcmbs_sync_v2_lab.journal_counter c set retained_after=p_until where c.singleton=true;
  delete from gcmbs_sync_v2_lab.commit_journal j where j.seq<=p_until;
  get diagnostics rows_removed=ROW_COUNT;
  return rows_removed;
END;
$fn$;

-- Hardening de laboratorio: por padrao nenhuma role publica pode executar
-- funcao de leitura recebendo p_guard_id. Em producao, a identidade deve
-- ser sempre derivada de sessao validada no SERVIDOR.
REVOKE ALL ON SCHEMA gcmbs_sync_v2_lab FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA gcmbs_sync_v2_lab FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA gcmbs_sync_v2_lab FROM PUBLIC;

DO $test$
DECLARE
  n bigint;
  out record;
BEGIN
  -- O primeiro usuario tem acesso a um registro: recebe UPSERT.
  select gcmbs_sync_v2_lab.append_journal(
    'escalas','fake-01',1,'UPSERT','{}'::bigint[],array[7]::bigint[]) into n;
  if n<>1 then raise exception 'FIRST_SEQ'; end if;

  -- Escopo muda de 7 para 9 (nao copiar nova informacao para o usuario 7).
  select gcmbs_sync_v2_lab.append_journal(
    'escalas','fake-01',2,'UPSERT',array[7]::bigint[],array[9]::bigint[]) into n;
  if n<>2 then raise exception 'SECOND_SEQ'; end if;

  -- DELETE, agora somente 9 perde acesso ao registro.
  select gcmbs_sync_v2_lab.append_journal(
    'escalas','fake-01',3,'DELETE',array[9]::bigint[],'{}'::bigint[]) into n;
  if n<>3 then raise exception 'THIRD_SEQ'; end if;

  -- Evento de outro GCM, invisivel para 7 e 9.
  select gcmbs_sync_v2_lab.append_journal(
    'permutas','fake-02',1,'UPSERT','{}'::bigint[],array[11]::bigint[]) into n;
  if n<>4 then raise exception 'FOURTH_SEQ'; end if;

  select * into out from gcmbs_sync_v2_lab.scan_journal(7,0,4,25);
  if out.next_after<>4 or out.scanned_count<>4 or jsonb_array_length(out.events)<>2 or
     out.events->0->>'action'<>'UPSERT' or
     out.events->1->>'action'<>'REMOVE' then
    raise exception 'SCOPE_REMOVAL_NOT_EMITTED';
  end if;
  select * into out from gcmbs_sync_v2_lab.scan_journal(9,0,4,25);
  if out.next_after<>4 or jsonb_array_length(out.events)<>2 or
     out.events->0->>'action'<>'UPSERT' or
     out.events->1->>'action'<>'REMOVE' then
    raise exception 'NEW_SCOPE_NOT_ENFORCED';
  end if;
  select * into out from gcmbs_sync_v2_lab.scan_journal(88,0,4,2);
  if out.next_after<>2 or out.scanned_count<>2 or out.events<>'[]'::jsonb
    then raise exception 'UNAUTHORIZED_METADATA_EXPOSED'; end if;
  select * into out from gcmbs_sync_v2_lab.scan_journal(88,2,4,2);
  if out.next_after<>4 or out.scanned_count<>2 or out.events<>'[]'::jsonb
    then raise exception 'EMPTY_PAGE_FAILED_TO_ADVANCE'; end if;

  -- Se ocorrer falha e ROLLBACK, nem journal nem contador avançam.
  begin
    perform gcmbs_sync_v2_lab.append_journal(
      'escalas','fake-03',1,'UPSERT','{}'::bigint[],array[7]::bigint[]);
    raise exception 'SIMULATED_POWER_FAILURE';
  exception when others then
    if sqlerrm<>'SIMULATED_POWER_FAILURE' then raise; end if;
  end;
  if (select next_seq from gcmbs_sync_v2_lab.journal_counter)<>4 or
     (select count(*) from gcmbs_sync_v2_lab.commit_journal)<>4 then
    raise exception 'NON_ATOMIC_JOURNAL_ROLLBACK';
  end if;
  select gcmbs_sync_v2_lab.append_journal(
    'escalas','fake-04',1,'UPSERT','{}'::bigint[],array[7]::bigint[]) into n;
  if n<>5 then raise exception 'ROLLBACK_LEFT_GAP'; end if;
  raise notice 'PASS: ordered metadata-only feed, ACL revoke, tombstones, pagination, rollback without gaps';
END;
$test$;
