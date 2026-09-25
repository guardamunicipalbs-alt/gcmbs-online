# GCMBS · Auditoria de integridade 20/09/2026

## Estado observado (consultas somente leitura)

Projeto Supabase `cxtayxzvilqrfczjlufk`; snapshot `2026-09-20T06:33:33.303Z`, backup ID `157`, 4.754 registros no snapshot. Último run `OK` reportou 36 conflitos, 0 registros recebidos. Réplica: 4.727 ativos, 274 tombstones; catálogo 42 entidades, 34 com dados.

Comparação por `(entity,record_key)` revelou **40 ausentes** na réplica: `banco_horas_auditoria` 20, `banco_horas_solicitacoes` 8, `auditoria_sistema` 6, `checklist_viaturas` 3, `frequencia_registros` 3. Há ainda 20 ativos somente na nuvem e sete chaves presentes no snapshot mas excluídas na nuvem: nenhuma delas pode ser sobrescrita automaticamente. 47 conflitos `ABERTO`; 281 alterações `PENDENTE` (270 `cloud_committed`, 11 não), com 83 pendências já reconhecidas por ACK `ERRO` e 187 sem ACK; no total há 87 ACKs `ERRO`.

O código publicado em `gcmbs-sync-v131` v4 escolhe o backup mais recente sem verificar o status da execução, persiste o backup ANTES da transação de aplicação, compara só deltas snapshot/snapshot e gera exclusão por ausência. Sem snapshot anterior, seu ramo de aplicação não executa. Esses problemas estão em [issue #25](https://github.com/guardamunicipalbs-alt/gcmbs-online/issues/25).

## Alteração nesta branch

`sync-integrity-core.mjs` é um núcleo determinístico, **sem I/O**, que: só admite baseline com run `OK`, hash, zero conflitos e prova explícita de aplicação (`applied_verified=true`); compara snapshot completo com a réplica para detectar ausências antigas; gera chaves idempotentes; bloqueia tombstones e exclusão por mera ausência; exige ancestral/revisão para atualizações e exclusões; protege a identidade completa do Banco de Horas; ignora `atualizado_em` apenas na comparação semântica das tabelas técnicas da Folha; impede sinalização global `OK` sem as três plataformas. Testes: `node --test sync/tests/*.test.mjs` (11 casos).

**Importante: a coluna `applied_verified` ainda não existe em `private.gcmbs_sync_runs`. É uma pré-condição futura para permitir um checkpoint; sem evidência explícita, o núcleo retorna `null`.** Não preencher retroativamente com base em status HTTP ou backup salvo; a verificação deve ser transacional, pós-commit, por revisão/identidade e com relatório de diferenças.

**Esta branch ainda NÃO integra o núcleo à Edge Function ativa, ao Desktop nem ao Android. Não declara correção aplicada ou sincronização concluída.** Integração precisa do código-fonte integral do Desktop (`MobileFullMirrorService`) e Edge, preservando credenciais e dados.

## Critérios obrigatórios antes do deploy

1. Criar indicador de checkpoint de aplicação verificado por registro e snapshot; selecionar baseline apenas por `status='OK'`, `completed_at IS NOT NULL`, `conflict_count=0`, `applied_verified=true` e hash. Nunca usar backup salvo ou execução com erro como checkpoint.
2. Comparar snapshot atual inteiro com `mobile_entity_records`, incluindo ausências antigas. Inserir com idempotência e verificação de identidade; atualizar/excluir por `WHERE revision=base_revision` e checar linhas afetadas. Só aceitar tombstones explícitos autenticados; nunca ausência como exclusão.
3. Banco de Horas: validar GCM, competência, data, natureza, classe, minutos, status e revisão, inclusive IDs 718–726; preservar transportes, cancelamentos e auditoria.
4. Desktop: aplicar operação individual em transação SQLite e ACK somente após commit. Preservar fila para ERRO, retry e CONFLITO; HTTP 200 não prova gravação local.
5. Recalcular saldo e Folha de setembro; comparar Desktop, Online e Android, solicitações pendentes, escalas históricas e todas as entidades. Concluir somente com diferenças justificadas zero, conflitos abertos zero, ACKs com erro zero e comprovação de três plataformas.

**Nenhum dado real foi alterado por esta auditoria. Não reativar Syncthing nem implantar automaticamente esta branch.**