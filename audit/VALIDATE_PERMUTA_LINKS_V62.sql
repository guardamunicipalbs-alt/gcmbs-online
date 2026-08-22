-- GCMBS 10.0.62
-- Proteção permanente contra colisão/reuso de desktop_referencia_id em PERMUTA.
-- Aplicada em produção em 22/08/2026 durante a auditoria global.

create or replace function private.permuta_action_matches_mirror(p_payload jsonb, p_mirror jsonb)
returns boolean
language sql
immutable
as $$
  select
    coalesce(p_payload->>'data','') = coalesce(p_mirror->>'data','')
    and upper(coalesce(p_payload->>'turno','')) = upper(coalesce(p_mirror->>'turno',''))
    and coalesce(nullif(p_payload->>'substituido_id','')::bigint,0) = coalesce(nullif(p_mirror->>'substituido_id','')::bigint,0)
    and coalesce(nullif(p_payload->>'substituto_id','')::bigint,0) = coalesce(nullif(p_mirror->>'substituto_id','')::bigint,0)
$$;

create or replace function private.guard_permuta_action_link()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  m jsonb;
begin
  if new.tipo <> 'PERMUTA' or new.desktop_referencia_id is null then
    return new;
  end if;

  select data into m
  from public.mobile_entity_records
  where entity='permutas'
    and record_key=new.desktop_referencia_id::text
    and deleted=false
  limit 1;

  -- O espelho pode chegar depois da solicitação; nesse caso a validação é
  -- concluída pelo trigger de reconciliação quando a permuta for sincronizada.
  if m is null then
    return new;
  end if;

  if not private.permuta_action_matches_mirror(new.payload, m) then
    new.desktop_referencia_id := null;
  end if;
  return new;
end
$$;

drop trigger if exists trg_guard_permuta_action_link on public.mobile_action_requests;
create trigger trg_guard_permuta_action_link
before insert or update of desktop_referencia_id,payload on public.mobile_action_requests
for each row execute function private.guard_permuta_action_link();

create or replace function private.reconcile_permuta_links_for_mirror()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.entity <> 'permutas' or new.deleted then
    return new;
  end if;

  update public.mobile_action_requests r
     set desktop_referencia_id=null
   where r.tipo='PERMUTA'
     and r.desktop_referencia_id::text=new.record_key
     and not private.permuta_action_matches_mirror(r.payload,new.data);

  -- O marcador [MOBILE#id] é a identidade forte preservada pelo Desktop.
  update public.mobile_action_requests r
     set desktop_referencia_id=nullif(new.record_key,'')::bigint
   where r.tipo='PERMUTA'
     and (r.desktop_referencia_id is null or r.desktop_referencia_id::text<>new.record_key)
     and coalesce(new.data->>'observacao','') like '%[MOBILE#'||r.id::text||']%'
     and private.permuta_action_matches_mirror(r.payload,new.data);

  return new;
end
$$;

drop trigger if exists trg_reconcile_permuta_links_for_mirror on public.mobile_entity_records;
create trigger trg_reconcile_permuta_links_for_mirror
after insert or update of data,deleted on public.mobile_entity_records
for each row when (new.entity='permutas')
execute function private.reconcile_permuta_links_for_mirror();

-- Reconciliação não destrutiva dos registros existentes.
update public.mobile_action_requests r
set desktop_referencia_id=null
from public.mobile_entity_records m
where r.tipo='PERMUTA'
  and r.desktop_referencia_id is not null
  and m.entity='permutas'
  and m.deleted=false
  and m.record_key=r.desktop_referencia_id::text
  and not private.permuta_action_matches_mirror(r.payload,m.data);

update public.mobile_action_requests r
set desktop_referencia_id=nullif(m.record_key,'')::bigint
from public.mobile_entity_records m
where r.tipo='PERMUTA'
  and m.entity='permutas'
  and m.deleted=false
  and coalesce(m.data->>'observacao','') like '%[MOBILE#'||r.id::text||']%'
  and private.permuta_action_matches_mirror(r.payload,m.data)
  and r.desktop_referencia_id is distinct from nullif(m.record_key,'')::bigint;
