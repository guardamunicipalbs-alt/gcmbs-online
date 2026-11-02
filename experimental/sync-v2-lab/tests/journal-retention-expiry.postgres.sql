-- GCMBS Sync V2: retencao LAB e cursor expirado.
-- Roda somente apos os testes de concorrencia no mesmo Postgres efemero.
\set ON_ERROR_STOP on
DO $test$
DECLARE
  removed bigint;
  r record;
BEGIN
  if (select next_seq from gcmbs_sync_v2_lab.journal_counter)<>8
    then raise exception 'UNEXPECTED_JOURNAL_BASELINE'; end if;
  removed:=gcmbs_sync_v2_lab.prune_through(3);
  if removed<>3 then raise exception 'WRONG_RETENTION_DELETE_COUNT'; end if;
  if (select retained_after from gcmbs_sync_v2_lab.journal_counter)<>3
    then raise exception 'RETENTION_FLOOR_NOT_COMMITTED'; end if;
  -- Cliente em 0 perdeu os eventos 1-3: obrigar rebootstrap.
  begin
    perform * from gcmbs_sync_v2_lab.scan_journal(7,0,8,25);
    raise exception 'EXPIRED_CURSOR_WAS_ACCEPTED';
  exception when others then
    if sqlerrm<>'CURSOR_EXPIRED' then raise; end if;
  end;
  -- Cliente com cursor recente continua, inclusive se nao houver eventos.
  select * into r from gcmbs_sync_v2_lab.scan_journal(7,3,8,25);
  if r.next_after<>8 or r.scanned_count<>5
    then raise exception 'VALID_CURSOR_REJECTED'; end if;
  -- Os metadados excluidos nao aparecem no feed.
  if exists(select 1 from gcmbs_sync_v2_lab.commit_journal where seq<=3)
    then raise exception 'OLD_ROWS_STILL_VISIBLE'; end if;

  -- Retencao deve ser monotônica e nunca passar da ultima transacao.
  begin
    perform gcmbs_sync_v2_lab.prune_through(2);
    raise exception 'RETENTION_MOVED_BACKWARDS';
  exception when others then
    if sqlerrm<>'INVALID_PRUNE' then raise; end if;
  end;
  begin
    perform gcmbs_sync_v2_lab.prune_through(9);
    raise exception 'RETENTION_DELETED_FUTURE_EVENT';
  exception when others then
    if sqlerrm<>'INVALID_PRUNE' then raise; end if;
  end;
  if (select next_seq from gcmbs_sync_v2_lab.journal_counter)<>8
    then raise exception 'PRUNE_CHANGED_COMMIT_CURSOR'; end if;
  raise notice 'PASS: expired cursor refuses silent data loss; valid cursor continues; prune monotonic';
END;
$test$;
