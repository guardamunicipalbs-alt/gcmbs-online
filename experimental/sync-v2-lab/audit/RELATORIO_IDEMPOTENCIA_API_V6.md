# GCMBS — auditoria de idempotência e transações na API v6 (01/11/2026)

**Somente diagnóstico e testes descartáveis. Nenhuma operação foi executada sobre os dados operacionais.**
**PR #30: não mesclar nem substituir o serviço atual sem homologação.**

## Constatações verificadas
- API em produção `gcmbs-mobile-api-v6`: versão **33**; fonte comparada com `main`.
- O handler `entityMutate` atual altera `public.mobile_entity_records` e depois faz `INSERT ... ON CONFLICT ... DO UPDATE` em `public.mobile_entity_changes` em **comandos separados**, sem transação explícita envolvendo os dois.
- O reenvio do mesmo `client_change_id` não impede a execução prévia do UPSERT e o incremento de `revision`; a restrição UNIQUE da fila impede IDs duplicados, não mutações duplicadas.
- A rotina de `DELETE` da API antiga usa `UPDATE` sem `RETURNING` obrigatório: se a chave não existir, a aplicação pode registrar uma mudança na fila mesmo sem alterar a linha correspondente.
- Alterações simultâneas em registros iguais requerem serialização antes da leitura/merge para evitar sobregravação de campos e revisão inconsistente.
- A API v6 contém regras próprias de escopo/permissão e gatilhos de proteção; **não** é seguro simplesmente trocar a escrita por `INSERT` direto ou desativar triggers.

## Evidências quantitativas de leitura
Consultas SQL somente leitura observaram:
- **10.565** alterações na tabela `mobile_entity_changes`, todas com `client_change_id` distinto e não nulo.
- **10.474** com status `APLICADO`, **82** `CANCELADO`, **9** `PENDENTE`.
- **84** mudanças históricas sem uma linha canônica correspondente na consulta atual; 81 são UPSERTs aplicados, duas DELETEs aplicadas e uma UPSERT cancelada.
- **ATENÇÃO:** essas 84 linhas **não provam perda de dados**: podem resultar de históricos legítimos, exclusões, aliases e migrações. Exigem comparação com histórico e regras de retenção, nunca recriação automática.
- Catálogo: **46 entidades**, sendo **21 graváveis** e **20 sem escopo individual** conforme `scope_fields`. Não habilitar escrita incremental sem revisar permissão específica de cada uma.
- Existem gatilhos de conciliação do Banco de Horas, classificação 50%/100%, feriados, ofícios, permutas, regras de proteção de registros e histórico, além de restrições de autorização da fila. O patch futuro deve preservar esses efeitos dentro da transação oficial.

## Avanços feitos nesta rodada
1. `tests/transactional-idempotency.postgres.sql`: **apenas laboratório descartável do GitHub**.
   - Testa gravar registro e recibo atomicamente, reenvio com ID igual, rejeição de ID reaproveitado com payload diferente e `DELETE` inexistente.
   - Injeta propositalmente falha na fila DEPOIS da gravação do registro e verifica rollback total.
   - Valida incrementos de revisão e número de recibos.
2. `tests/transactional-concurrency.sh`: duas conexões PostgreSQL simultâneas, com mesmo ID e IDs distintos para o mesmo registro.
   - Reenvio igual só deve gerar **uma revisão e um recibo**.
   - IDs diferentes devem gerar revisões sequenciais e dois recibos distintos.
3. GitHub Actions recebeu um job separado `postgres-contract` com contêiner **PostgreSQL 16 efêmero**.
   - Credencial de teste é fictícia e usada apenas nesse job.
   - **Não utiliza `SUPABASE_DB_URL`**, não possui segredos de produção e não acessa nenhum serviço GCMBS.
   - O ambiente é destruído ao fim do job.

## Arquitetura mínima da correção definitiva
- Gerar `client_change_id` no cliente e conservá-lo durante todos os reenvios. Proibir alteração do payload para um ID já utilizado.
- Abrir uma única transação PostgreSQL (`db.begin` em postgres.js ou RPC privado equivalente).
- Consultar recibo do mesmo ID sob trava de transação; se existir, responder sem recriar o registro ou reenviar efeitos.
- Verificar a identidade do GCM, permissões e escopo dentro do processamento autorizado; **nunca** confiar no `guarda_id` fornecido pelo cliente.
- Trancar também a chave do registro durante a leitura, merge, persistência e criação da entrada da fila.
- Atualizar registro e recibo **na mesma transação**, incluindo efeitos de todos os gatilhos relevantes.
- Retornar ACK somente após commit confirmado; atualizar Desktop via protocolo que respeite idempotência *também no consumidor*.
- `DELETE` de registro inexistente deve retornar erro ou sem efeito confirmado, conforme contrato documentado — não fabricar aprovação.
- Definir fingerprint canônico do **pedido original**: o campo `data` atual da fila contém dados fundidos, não é garantia suficiente para comparar uma solicitação parcial com um replay. Isso exige campo/registro de recibo ou estratégia equivalente em migração segura.
- Validar conflitos, referências, exclusões, 6 modalidades de permuta, Banco de Horas 20–19, feriados e 84 h na homologação real.

## Limitações do teste PostgreSQL efêmero
O modelo simulado **não replica os ~15 gatilhos reais** de `mobile_entity_records`, os demais da fila, restrições financeiras, permissões nem as chamadas Desktop. Portanto, os testes confirmam o **contrato transacional**, mas NÃO provam segurança de um patch na produção.

## Bloqueadores para liberação
1. Backup restaurável de banco e revisão da sincronização Desktop/Android atuais.
2. Emissor transacional protegido sem quebrar gatilhos nem o histórico existente.
3. Idempotência de ponta a ponta (cliente, API, Supabase, Desktop e confirmações).
4. Teste paralelo em ambiente de homologação fiel às tabelas e triggers oficiais.
5. Medição de Egress faturado e reconciliação completa da folha/escala.
6. PR #30 permanece em rascunho; **nenhum merge nem deploy da API v6** nesta etapa.

## Princípio de segurança
O objetivo é **diminuir Egress sem perder registros**. Não é aceitável obter economia removendo histórico, afrouxando autorização ou pulando a confirmação de transações.


## Auditoria complementar: conflito de revisão entre dois computadores (01/11/2026)
**Problema:** atomicidade do registro+fila e idempotência por `client_change_id` NÃO impedem perda de atualização se duas alterações diferentes no mesmo registro partirem de uma mesma versão antiga.

**Proteção experimental adicionada ao PostgreSQL descartável:**
- `apply_change(..., p_base_revision)` aceita revisão-base esperada e a compara com a revisão atual **após** adquirir a trava transacional do registro.
- `base_revision=0` significa criação de registro ainda inexistente; revisões positivas exigem correspondência exata.
- Se houve atualização entre a leitura do cliente e a tentativa de escrita, deve retornar `STALE_BASE_REVISION`; não incrementar revisão nem inserir recibo.
- O recibo já gravado é consultado **antes** dessa verificação. Dessa forma, reenvio do mesmo ID previamente confirmado mantém a resposta original, mesmo se outros dispositivos já avançaram a revisão.
- Testes de duas conexões PostgreSQL em paralelo: com `base_revision=1` igual, **apenas uma** das alterações pode ser aceita.
- O contrato laboratorial ainda permite omitir `p_base_revision` por compatibilidade de testes legados. **Esta omissão não pode ser considerada segura para escrita concorrente no produto final.** Em produção, exigir versão-base sempre que se edita/exclui um registro sensível.

**Comportamento a homologar na aplicação:** um conflito NÃO é uma autorização para sobrescrever. Mostrar registro atualizado, manter rascunho do pedido original, permitir revisão humana e reenvio com NOVO identificador apenas após autorização e nova versão-base. Para Banco de Horas e permutas, nunca resolver conflitos simplesmente com `last write wins`; preservar regras das seis modalidades, 20–19, 84h e valores históricos.

**Não houve alteração na API v6, no Supabase oficial ou no Desktop.** Isto testa só um contrato mínimo em banco descartável, sem replicar todos os gatilhos reais ou garantir o tratamento correto por Android.
