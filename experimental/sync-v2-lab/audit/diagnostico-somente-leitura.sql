-- GCMBS Sync V2 - Auditoria somente leitura (PostgreSQL 17 / Supabase Free)
-- NUNCA altera dados, schemas, politicas ou triggers.
-- Retorna SOMENTE contagens, tamanhos e agregados. Nenhuma informacao pessoal.
-- IMPORTANTE: este diagnostico NAO substitui o dashboard de Egress (bytes cobrados).
-- Executar pontualmente, nao por polling. Limites de custo/volume continuam aplicaveis.
BEGIN TRANSACTION READ ONLY;
SELECT current_date AS data_verificacao,
       pg_size_pretty(pg_database_size(current_database())) AS tamanho_do_banco;
SELECT schemaname, relname AS tabela, pg_size_pretty(pg_total_relation_size(relid)) AS tamanho_total
FROM pg_stat_user_tables
WHERE schemaname IN ('public','private')
ORDER BY pg_total_relation_size(relid) DESC LIMIT 20;
SELECT entity, count(*) AS registros,
       count(*) FILTER (WHERE deleted) AS excluidos,
       coalesce(sum(octet_length(data::text)),0) AS bytes_dados_logicos,
       count(*) FILTER (WHERE cardinality(scope_guard_ids)=0) AS registros_sem_escopo
FROM public.mobile_entity_records
GROUP BY entity ORDER BY bytes_dados_logicos DESC;
SELECT date_trunc('day',created_at)::date AS dia,
       count(*) AS alteracoes,
       coalesce(sum(octet_length(coalesce(data::text,''))),0) AS bytes_logicos_alteracoes
FROM public.mobile_entity_changes
WHERE created_at >= now() - interval '14 days'
GROUP BY 1 ORDER BY 1;
SELECT nspname AS schema, relname AS tabela, relrowsecurity AS rls_ativo
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE nspname='public' AND c.relkind='r' AND NOT relrowsecurity
ORDER BY relname;
COMMIT;
