-- GCMBS 10.0.62 - auditoria de desempenho 22/08/2026
-- A constraint UNIQUE mobile_notifications_dedupe_key_key permanece ativa.
-- Remove somente o segundo indice equivalente criado historicamente.
drop index if exists public.ux_mobile_notifications_dedupe_key;
