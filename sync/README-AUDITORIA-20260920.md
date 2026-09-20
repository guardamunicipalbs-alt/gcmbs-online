# GCMBS · Auditoria de integridade 20/09/2026

## Estado observado (consultas somente leitura)

Projeto Supabase `cxtayxzvilqrfczjlufk`; snapshot `2026-09-20T06:33:33.303Z`, backup ID `157`, 4.754 registros no snapshot. Último run `OK` reportou 36 conflitos, 0 registros recebidos. Réplica: 4.727 ativos, 274 tombstones; catálogo 42 entidades, 34 com dados.

Comparação por `(entity,record_key)` revelou **40 ausentes** na réplica: `banco_horas_auditoria` 20, `banco_horas_solicitacoes` 8, `auditoria_sistema` 6, `checklist_viaturas` 3, `frequencia_registros` 3. Há ainda 20 ativos somente na nuvem e sete chaves presentes no snapshot mas excluídas na nuvem: nenhuma delas pode ser sobrescrita automaticamente. 47 conflitos `ABERTO`; 281 alterações `PENDENTE` (270 `cloud_committed`, 11 não), com 83 pendências já reconhecidas por ACK `ERRO` e 187 sem ACK; no total há 87 ACKs `ERRO`.

O código publicado em `gcmbs-sync-v131` v4 escolhe o backup mais recente sem verificar o status da execução, persiste o backup ANTES da transação de aplicação, compara só deltas snapshot/snapshot e gera exclusão por ausência. Sem snapshot anterior, seu ramo de aplicação não executa. Esses problemas estão em [issue #25](https://github.com/guardamunicipalbs-alt/gcmbs-online/issues/25).

## Alteração nesta branch

`sync-integrity-core.mjs` é um núcleo determinístico, **sem I/O**, que: escolhe baseline apenas com run concluído `OK` e hash consistente; reconcilia todo o snapshot contra a réplica para recuperar também registros antigos ainda ausentes; gera IDs idempotentes; impede ressurreição de tombstones e exclusão por mera ausência; exige ancestral/revisão para atualizações e exclusões; marca colisões de identidade do Banco de Horas como conflitos; desconsidera `atualizado_em` exclusivamente na comparação semântica das tabelas técnicas da Folha; e impede status global `OK` sem confirmação das três plataformas. Testes em `sync/tests` via `node --test sync/tests/*.test.mjs`.

**Importante: esta branch ainda NÃO integra o núcleo à Edge Function ativa, ao Desktop nem ao Android. Não declara correção aplicada ou sincronização concluída.** Integração precisa ser preparada sobre o código-fonte integral do Desktop (`MobileFullMirrorService`) e Edge, preservando credenciais e dados, e submetida à validação.

## Critérios obrigatórios antes do deploy

1. Fazer SELECT de baseline casado com `gcmbs_sync_runs.status='OK'`, `completed_at IS NOT NULL` e hash. Não transformar backup de erro nem snapshot salvo em checkpoint. Persistir checkpoint de aplicação somente após commit.
2. Preparar mudanças por comparação do snapshot atual inteiro com `mobile_entity_records`, incluindo ausências de snapshots anteriores. Aplicar `INSERT ... ON CONFLICT DO NOTHING` com verificação de identidade; `UPDATE/DELETE` com `WHERE revision=base_revision` e confirmação de contagem. Não deletar por ausência; somente tombstones explícitos autenticados.
3. Para Banco de Horas, validar identidade completa (GCM, competência, data, natureza, classe, minutos, status/revisão), evitar IDs 718–726 colididos; preservar transferências, cancelamentos, auditoria e saldo histórico.
4. No Desktop, persistir cada operação em transação SQLite e ACK apenas após commit efetivo. Erro/retry/conflito devem preservar o comando na fila; não marcar aplicado por status HTTP 200.
5. Recalcular saldo/folha em competência de setembro e comparar Online, Desktop e Android; validar consultas pendentes, escalas históricas e todos os módulos do catálogo. Encerrar apenas com zero diferenças justificadas, zero conflitos abertos/ACKs com erro e confirmação de leitura/escrita por plataforma.

**Nenhum dado foi alterado na execução desta auditoria. Não reativar Syncthing nem implantar automaticamente esta branch.**