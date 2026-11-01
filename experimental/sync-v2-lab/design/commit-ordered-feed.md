# GCMBS Sync V2 — contrato do feed incremental e recuperação (proposta, não implantada)

> **BLOQUEADO PARA PRODUÇÃO.** Este documento NÃO é uma migração executável, NÃO cria tabela nem altera funções. A implantação depende do código atualizado do Desktop e da homologação de Android/Online. O Supabase continua sendo autoridade oficial.

## 1. O que há hoje
- A tabela `public.mobile_entity_records` contém `record_key`, `revision`, `updated_at`, `deleted` e `scope_guard_ids`.
- As quatro entidades verificadas em 01/11/2026 apresentaram revisão positiva, `updated_at` preenchido e escopo consistente.
- `public.mobile_entity_changes.id` identifica alterações, mas **não deve virar automaticamente cursor de commit**. IDs podem ser reservados antes do commit; inserções concorrentes podem confirmar em ordem diferente.
- A leitura paginada do laboratório usa `record_key` e não tem snapshot congelado: **não serve como feed incremental definitivo**.

## 2. Registro ordenado de alterações (proposta)
- Criar um **journal dedicado**, sob esquema privado, com número de versão transacional, entidade, chave do registro, ação (`UPSERT`/`DELETE`), revisão, escopo antigo, escopo novo, instantes de confirmação e referência de origem.
- O journal não deve conter campos pessoais completos se puder reconstruir a resposta de forma autorizada da tabela canônica.
- Para assegurar ordem de confirmação, **as transações de escrita devem serializar a alocação de versão** usando uma linha contadora bloqueada dentro da mesma transação que grava registro e journal. Nunca usar `nextval()` isolado como cursor seguro de commit.
- **Todas** as origens que modificam dados oficiais (Desktop, API, RPC e funções existentes) devem aderir ao contrato ou acionar um mecanismo transacional equivalente. Se uma origem continuar fora, não é seguro liberar o delta.
- A entrega por lote terá watermark durável, limite de bytes, limite de registros, `has_more`, e cursor autenticado/assinado associado ao GCM e à política de autorização.
- Registros excluídos mantêm tombstone. Mudanças de escopo ou revogação precisam emitir evento de remoção ao usuário que perdeu acesso, sem expor novo escopo privado.
- A autorização é aplicada **no servidor**, inclusive aos dados históricos, eventos de remoção e mudanças de perfil.

## 3. Bootstrap sem janelas de perda
1. O servidor registra uma versão estável `W` e inicia captura/snapshot com política de retenção.
2. Cliente armazena páginas e checkpoint no mesmo commit local, mas NÃO publica cache parcial como se fosse fotografia completa.
3. Cliente aplica todos os eventos posteriores a `W`, na ordem de commit, até alcançar o presente.
4. Cliente confirma watermark somente APÓS commit local dos dados.
5. Se `W` expirar, se a sessão perder autorização ou se houver lacuna no journal: reiniciar bootstrap controlado, sem fingir consistência.

**Nota:** a forma exata de capturar `W` com snapshot coerente será decidida em homologação (transaction snapshot consistente ou desenho equivalente). Fazer `SELECT max(id)` seguido de paginação livre **não** garante esse requisito.

## 4. Erros e estados
- **402**: parar consultas automáticas com retentativa espaçada; não apagar dados já recebidos.
- **429/5xx/timeout**: backoff com jitter para evitar tempestade de reconexão.
- **401/403 autenticados**: aplicar política de revogação e isolamento de dados; nunca manter acesso indefinidamente sem revalidação.
- **Cursor expirado / schema mudou**: iniciar ressincronização total paginada e controlada.
- **Operações**: ACK de recebimento não equivale a aprovação. Idempotência precisa existir também na autoridade central.
- **Offline**: exibir "Última atualização" e diferenciar consulta de operação pendente.

## 5. Controle de consumo grátis
- Medir bytes efetivos por chamada e plataforma, além do Egress faturado no Supabase.
- Cota operacional-alvo: no máximo **3,5 GB/mês não cacheados**, com margem e alerta antes do limite.
- Cache compartilhado externo apenas para conteúdo inequivocamente público, jamais dados individuais.
- Evitar novas Edge Functions em cadeia, consultas repetidas e snapshots globais não necessários.

## 6. Gates obrigatórios
- Revisão de todas as fontes de escrita do Desktop e Android.
- Testes concorrentes com commits fora de ordem e perda de conexão em qualquer ponto.
- Testes de revogação de permissão, exclusão, concorrência em permutas, tombstones e reenvio.
- Testes de recuperação local em SQLite após reinício do Android.
- Comparação com API principal sem modificar dados operacionais.
- Deploy gradual, rollback testado e medição real de Egress antes de desativar rotinas anteriores.

## 7. Componentes já criados na branch experimental
- `client/merge-snapshot.mjs`: revisão, tombstones, conflitos.
- `client/atomic-page-commit.mjs`: atomicidade por página e cursor para adaptador SQLite/IndexedDB.
- `client/offline-outbox-state.mjs`: estados de solicitação; só transições locais, sem chamadas reais.
- `client/read-retry-gate.mjs`: proteção contra polling agressivo ao atingir 402/429.
- `tests/*.test.mjs`: regressões de estados, páginas, permissões e falhas.
- Edge Function `gcmbs-sync-v2-lab`: publicada em modo desligado, exclusivamente para desenvolvimento.


## 8. Auditoria do mecanismo de histórico já instalado (01/11/2026)

Consultas **somente leitura** confirmaram:
- O gatilho `trg_gcmbs_entity_history` já captura `INSERT`, `UPDATE` e `DELETE` de `public.mobile_entity_records` por meio de `private.gcmbs_capture_entity_history()`.
- `private.gcmbs_entity_history`: **31.056 eventos**, 36 entidades, cerca de **51 MB**, 850 eventos de exclusão física/lógica (medição atual).
- Existem índices por `id`, `changed_at` e `(entity, record_key, revision, changed_at)`.
- O histórico contém `id,entity,record_key,revision,operation,data,source,snapshot_id,deleted,changed_by_guard_id,changed_by_device,content_hash,changed_at`.
- **Não contém** `scope_guard_ids`, escopo anterior, escopo posterior ou `commit_seq`. Uma mudança somente de escopo pode provocar o gatilho, mas o registro histórico não preserva esses campos.
- Em `public.mobile_entity_changes`, já existe `UNIQUE(client_change_id)`, bem como índices para estados/retentativas; isso ajuda a evitar duplicidade da FILA, mas não substitui idempotência transacional de cada serviço nem ordenação de confirmação.

### Correção do plano inicial
**NÃO criar agora um segundo histórico JSON completo.** Antes de propor migração:
1. Investigar se o histórico existente pode receber um *journal leve de metadados*, preservando `old_scope_guard_ids`, `new_scope_guard_ids` e watermark de commit, sem replicar todo o JSON.
2. Comparar cenários sem mutação em clone/ambiente isolado, inclusive operações feitas por triggers e múltiplos computadores.
3. Escolher estratégia de versionamento que não crie buracos invisíveis em concorrência (sequência por transação serializada, CDC consistente ou equivalente). `id`/timestamp sem garantia de commit não é suficiente.
4. Verificar retenção compatível com dispositivos que ficam **20 dias ou mais** sem sincronizar; se o histórico for compactado, usar rebootstrap consistente e seguro.
5. Validar comportamento em mudanças de permissão: ao perder acesso, excluir do cache local os dados não autorizados sem enviar o conteúdo sensível atualizado.
6. Medir impacto no tamanho total do banco (limite Free 500 MB), nos índices e no Egress antes de aplicar qualquer mudança em produção.

### Atenção
A existência do histórico não comprova que ele seja um feed de sincronização utilizável. O gatilho também é responsável por auditoria; não deve ser desabilitado ou reescrito sem testes e backup.
