-- GCMBS 10.0.62 — restaura a paridade funcional Desktop ↔ Online/App
-- do Cadastro de Viaturas.
--
-- Auditoria-base: viaturas = 19 campos Desktop / 19 Online/App.
-- Estado encontrado em 21/08/2026: contrato remoto reduzido para 12 campos.
--
-- Não cria coluna e não altera registros de viaturas. Apenas restaura a
-- whitelist funcional já existente no Desktop e no catálogo da réplica.

BEGIN;

UPDATE private.mobile_online_field_contracts
SET fields = ARRAY[
  'prefixo',
  'placa',
  'renavam',
  'marca',
  'modelo',
  'ano_fabricacao',
  'ano_modelo',
  'tipo',
  'status',
  'cor',
  'combustivel',
  'potencia',
  'cilindrada',
  'categoria',
  'chassi',
  'motor',
  'intervalo_troca_oleo_km',
  'km_ultima_troca_oleo',
  'observacao'
]::text[]
WHERE entity='viaturas';

DO $$
DECLARE n integer;
BEGIN
  SELECT cardinality(fields) INTO n
  FROM private.mobile_online_field_contracts
  WHERE entity='viaturas';

  IF n IS DISTINCT FROM 19 THEN
    RAISE EXCEPTION 'Contrato de viaturas deveria ter 19 campos; encontrado %', n;
  END IF;
END $$;

COMMIT;
