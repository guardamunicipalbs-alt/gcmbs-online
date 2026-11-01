# GCMBS Sync V2 — contrato para integrar Android/SQLite

**Documento de desenvolvimento. Não instalar o protótipo em produção.**

## Objetivo imediato
Vincular os componentes testados remotamente ao aplicativo Android real SEM modificar a fonte de verdade Supabase e sem comprometer escalas, permutas, Banco de Horas ou autenticação.

## Componentes preparados no GitHub
| Componente | Finalidade | Situação |
|---|---|---|
| `durable-outbox.mjs` | Persistir atomicamente estado de solicitações | Teste de driver simulado |
| `offline-outbox-state.mjs` | Estados monotônicos e ACK | Teste isolado |
| `merge-snapshot.mjs` | Revisões e exclusões lógicas | Teste isolado |
| `two-generation-cache.mjs` | Evitar promover páginas incompletas | Teste isolado |
| `cache-json-codec.mjs` | Converter Map em JSON versionado | Teste isolado |
| `encrypted-snapshot-store.mjs` | Exigir cifra autenticada e vínculo a aparelho | AES-GCM de teste; sem Keystore |
| `offline-view-policy.mjs` | Verificar lease local e validade de acesso | Falta emissão/assinatura real |
| `bootstrap-runner.mjs` | Paginação e retomada após falhas | API laboratório não tem snapshot consistente |
| `quota-budget.mjs` | Projeção sobre Egress efetivamente faturado | Sem coleta automática de billing |

## Contrato mínimo do adaptador SQLite
O adaptador deve oferecer `store.transaction(async tx => ...)` com `tx.read(key)`, `tx.write(key,value)` e `tx.delete(key)`.
Todas as ações dentro do callback têm de ser uma transação **única, serializada e durável**. Se qualquer operação falhar, o banco deve realizar rollback integral. Nenhum `tx.write` deve executar commit isolado durante o callback.

O app não deverá exibir uma geração `staging`. Apenas a última geração `active` poderá ser usada como informação armazenada, e ainda assim somente após checar autenticação/autorização offline. A conclusão da paginação NÃO significa que a fotografia do servidor é consistente.

## Criptografia e identidade
1. Investigar a versão exata de Capacitor, Android SDK, plugin SQLite e disponibilidade de criptografia.
2. Proteger chave de dados no Keystore do Android; nunca compartilhar chave literal, `.jks`, senha, token ou `service_role` no GitHub.
3. Usar nonce AES-GCM novo, aleatório, de 96 bits a cada gravação; tag de 128 bits.
4. Associar dados autenticados ao identificador local do aparelho + GCM + entidade + versão do formato. O protótipo inclui essa associação por `deviceId` e chave de cache; escolher identificador estável sem expor ID sensível no log.
5. Se uma chave do Keystore for perdida, realizar recuperação via sincronização autorizada — nunca tentar gravar dados em claro como alternativa automática.
6. Planejar revogação remota de acesso e privacidade do dispositivo compartilhado. O `verifyLease` ainda **não existe** no aplicativo; fornecer verificador criptográfico verdadeiro antes de habilitar cache offline sensível.
7. Corrigir diferenças entre horário do dispositivo e servidor: não confiar cegamente no relógio local para expiração de lease sem avaliar política anti-rollback.

## Fila offline
- `client_change_id` deve ser único e persistido ANTES da primeira transmissão; reenvios nunca geram novo ID.
- `acknowledgeDurably` NÃO autoriza permuta. Apenas registra que o servidor reconheceu o pedido.
- `finalizeDurably` só é utilizado após reconciliação de um resultado **oficial autenticado** do servidor.
- A restrição UNIQUE no cliente NÃO garante idempotência da autoridade central: confirmar a deduplicação no banco e nas rotinas do Desktop.
- A fila não deve armazenar senha, token de login, chave privada ou dados sem validação tipada por modalidade de permuta. O filtro de campos do protótipo é defesa auxiliar, não substitui schema estrito.
- Preservar todos os modos de permuta e regras financeiras já homologados; não aplicar política de 'última escrita vence' para saldos ou autorização.

## Testes de integração que faltam
- Simular perda de energia durante transação SQLite e durante envio/recebimento.
- Reiniciar Android, trocar de usuário, remover permissão, renovar sessão e expirar lease.
- Testar atualizações de APK sem perder cache nem fila pendente.
- Testar 402/429/5xx e quedas de 30 minutos, 3 dias e 20 dias, exibindo corretamente os limites de acesso.
- Testar cursor revogado ou expirado, mudança de escopo, exclusões e snapshots concorrentes.
- Comparar tela Offline, Online e Desktop para as mesmas escalas; validar dados individuais com perfis distintos.
- Medir Egress cobrado; garantir que a nova camada não gera mais custos por reconexão.
- Não migrar para produção até ter backup/restauração testada, resultados comparativos e rollback seguro.

## Próximo acesso ao computador
Usar apenas após revisão o roteiro `handoff/LEVANTAMENTO_LOCAL_SOMENTE_LEITURA.ps1` para obter os hashes/versões. Depois analisar os arquivos Android atuais e os serviços Desktop, sem alterar nada antes de criar backup verificado.

**Nenhuma destas rotinas foi instalada no Android. Os testes atuais foram realizados sem dados reais do GCMBS.**
