# GCMBS Sync V2 — Journal de commit, ACL e retenção (prova de conceito)

**Estado: somente GitHub Actions, PostgreSQL 16 descartável. NÃO É MIGRAÇÃO.**
**Não executar nenhum dos SQLs de tests/ no Supabase oficial.**

## Evidência de laboratório — 01/11/2026
Foram adicionados e aprovados pelo CI:
- `tests/commit-ordered-journal.postgres.sql`: journal **somente de metadados**, contador global travado por transação, filtragem de destinatários, remoção de escopo e cursor paginado.
- `tests/commit-ordered-journal-concurrency.sh`: dois clientes PostgreSQL distintos tentando publicar eventos concorrentes. Uma transação mantém o contador bloqueado até confirmar, a outra aguarda. Também há rollback concorrente sem pular a sequência.
- `tests/journal-retention-expiry.postgres.sql`: piso de retenção transacional, rejeição de cursores anteriores ao piso, paginação válida para cursores atuais e bloqueio de cortes que voltam no tempo ou ultrapassam o último commit.
- GitHub Actions executa esses três passos após os testes existentes de atomicidade e de duas edições concorrentes, **sem conexão ao projeto Supabase**.

## Resultado demonstrado
1. Diferentemente de `nextval()` usado sozinho, um contador mantido por uma linha bloqueada em `UPDATE` **dentro da mesma transação** do journal serializa a alocação e a confirmação. Eventos de transações desfeitas não aparecem nem deixam salto na sequência.
2. O journal não replica o JSON operacional: grava chave, entidade, revisão, tipo de alteração, escopo anterior e escopo posterior. Isso reduz o armazenamento associado à trilha de sincronização **no laboratório**; não existe medição de economia faturada.
3. Quando um GCM deixa o escopo, recebe o mínimo necessário para retirar um registro do cache (`REMOVE`), sem receber o novo conteúdo. Quem passa a ter acesso recebe metadados de `UPSERT`; o registro completo exige consulta ao servidor **com ACL novamente verificada**.
4. O cursor avança pela quantidade de eventos brutos examinados, mesmo quando nenhum é visível, evitando loops de consultas vazias.
5. Se o histórico for retido apenas até o piso `retained_after`, cursores anteriores falham com `CURSOR_EXPIRED`; o cliente deve iniciar **bootstrap coerente e autorizado**, nunca assumir "sem alterações".

## O que NÃO foi implementado
- Nenhuma alteração na função `gcmbs-mobile-api-v6` publicada, no Android, no Desktop ou no PostgreSQL oficial.
- **O modelo de laboratório não grava o dado canônico e o journal numa mesma transação**: a prova cobre apenas a ordem entre entradas do journal. Falta integrar esse contador à rotina transacional existente que grava registro + recibo, preservando todos os gatilhos e regras reais.
- Não há endpoint autenticado de delta, assinatura de cursor, watermark do snapshot nem snapshot congelado.
- `scan_journal(p_guard_id,...)` recebe um GCM de teste. **Isto NÃO seria seguro como endpoint público:** a versão real deve derivar identidade do token/sessão do servidor e consultar permissões atualizadas; restringir EXECUTE, manter em schema privado, sem Data API aberta e com limitação de chamada/tamanho.
- Não há emissor de `acl_revision` nem atestado de captura oficial; mudanças de role/ativação e acesso fora do escopo precisam gerar invalidadores.
- **Códigos offline ainda não integrados ao SQLite/Android Keystore**, nem testados em 10 computadores reais.
- Nenhuma rotina de descarte de journal foi publicada.

## Segurança e continuidade
- O histórico existente em `private.gcmbs_entity_history` já ocupa aproximadamente 51 MB (medição da auditoria anterior). O novo journal, se necessário, deveria conter somente metadados e **não duplicar os JSONs**.
- Com dispositivos passando 20 dias sem sincronizar, uma janela curta de retenção causaria rebootstrap e transferências grandes. A política deve ser determinada por medição de tamanho/uso real, orçamento Free, frequência de reconexão e recuperação segura.
- Nunca remover dados financeiros/histórico institucional só para diminuir Egress. **Egress é quantidade transferida**, não apenas tamanho ocupado no PostgreSQL.
- Uma resposta de remoção precisa excluir dados da visualização e considerar criptografia, expiração de autorização, tombstones, backup local e revogação. O cliente não pode ignorar `REMOVE`.
- Para o GCM sem acesso, resposta de delta nunca deve incluir dados pessoais, saldos, conteúdo de permutas ou de ofícios.
- Um cliente desatualizado com `CURSOR_EXPIRED` deve manter a última geração completa protegida enquanto reconstrói uma nova. Não expor a captura parcial como oficial.
- Otimizar tamanho máximo do lote e frequência de sincronização, não usar polling agressivo sob 402.

## Critérios antes de produção
1. Alinhar `schema`, gatilhos e consumidores reais do Supabase, Online, Desktop e Android.
2. Adaptar `entityMutate` para uma **transação única** de atualização canônica + recibo + journal, sem efeito colateral duplicado. Considerar todas as fontes de escrita.
3. Garantir controle de permissão na origem dos eventos, na recuperação da entidade e em alterações posteriores de `acl_revision`.
4. Validar concorrência, revogação, exclusões, conflitos `base_revision`, rollback e rebootstrap em staging idêntico ao banco oficial.
5. Medir tamanho dos eventos e **Egress faturado** durante piloto, projetando folga abaixo da cota gratuita.
6. Definir política de retenção e simular aparelhos sem rede por 20+ dias, sem perda ou exibição não autorizada.
7. Executar piloto com APK assinado, SQLite criptografado/Keystore e rollback demonstrado. Só então avaliar merge PR #30.

**Verificação:** o workflow deve estar verde no HEAD do PR. Nenhum deploy de função ou alteração SQL no ambiente oficial foi feito nesta rodada.
