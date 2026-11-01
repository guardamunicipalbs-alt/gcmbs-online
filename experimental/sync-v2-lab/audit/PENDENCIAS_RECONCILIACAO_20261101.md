# GCMBS — pendências de sincronização no Supabase (leitura em 01/11/2026)

**Somente auditoria, sem reprocessamento. Não contém CPF, nomes, identificadores pessoais, conteúdos de documentos nem dados operacionais.**

## Achado confirmado
A tabela `public.mobile_entity_changes` possui **9** registros com `status='PENDENTE'`:
- `oficios`: **4**; todos de 01/10/2026 (UTC).
- `ocorrencias_operacionais`: **4**; datas entre 26/09/2026 e 14/10/2026 (UTC).
- `abastecimento_viaturas`: **1**; de 23/09/2026 (UTC).

Todos os 9 têm correspondência de `entity + record_key` na réplica `mobile_entity_records`, mas **nenhum** está marcado como `cloud_committed`. Todos têm `retry_count=0`, `next_retry_at` nulo, `claim_device_id` nulo e `last_error` nulo. Na data da auditoria, **8 têm mais de 30 dias**.

**Interpretação cautelosa:**
1. A existência de registro canônico sugere que o conteúdo foi espelhado, mas NÃO comprova emissão oficial do ofício, registro na base local Desktop, aprovação ou processamento dos demais gatilhos.
2. Não é seguro alterar status para `APLICADO` nem drenar a fila sem conhecer as rotinas Desktop V291 e o comportamento dos consumidores.
3. Pendências antigas sem tentativas registradas exigem cruzar com o banco local **efetivamente usado** pelo Desktop, usando os IDs oficiais e regras de negócio.
4. O usuário deve obter backup completo de SQLite e relatório do estado da sincronização antes de qualquer reconciliação.
5. Ofícios têm numeração centralizada e histórico; nunca duplicar emissão ou reservar novo número simplesmente por reprocessar.
6. Para abastecimentos e ocorrências, confirmar se houve reflexo nas tabelas oficiais e se os pedidos são legítimos antes de enviar novamente.

## Verificação das outras mudanças
- Total histórico `mobile_entity_changes`: **10.565** registros, IDs de cliente únicos.
- Status: **10.474 APLICADO**, **82 CANCELADO**, **9 PENDENTE**.
- **84** mudanças históricas sem registro canônico direto na consulta atual; 35 de `oficios`, 11 de `eventos_extras`, e outras entidades. Isso **não comprova perda**: aliases, operações concluídas, exclusões ou migrações podem explicar; revisar por modalidade em cópia de homologação.

## Critério para regularizar posteriormente
- Identificar as rotas de consumo Desktop e a representação oficial de cada entidade.
- Comparar ID da fila, documento/serviço oficial, revisão e status no Desktop e Supabase.
- Se já aplicado oficialmente, usar rotina autorizada de conciliação **idempotente** com auditoria; não criar novamente.
- Se ausente oficialmente, reconstruir operação a partir de dados preservados, com autorização e validação das regras.
- Concluir com relatório de paridade e testes de reenvio sem duplicações.

## Segurança
Nenhuma linha foi modificada nesta auditoria. Não copiar conteúdos completos dos ofícios, ocorrências, registros de GCMs ou acesso administrativo para repositório público.
