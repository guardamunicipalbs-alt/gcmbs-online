-- GCMBS 10.0.62 - auditoria de seguranca 22/08/2026
-- Remove o aviso function_search_path_mutable sem alterar a logica da funcao.
alter function private.permuta_action_matches_mirror(jsonb, jsonb)
  set search_path = pg_catalog;
