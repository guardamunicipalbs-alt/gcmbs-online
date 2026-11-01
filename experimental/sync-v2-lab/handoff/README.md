# GCMBS Sync V2 — entrega preparada para o retorno ao computador

**Estado: SOMENTE HOMOLOGAÇÃO / NÃO PUBLICAR NA PRODUÇÃO.**

Este diretório reúne o que poderá ser feito quando o usuário voltar ao Windows. As etapas remotas no GitHub NÃO tornam o APK atual offline nem confirmam economia de Egress.

## 1. O que já pode ser utilizado sem o computador
- Código e testes da futura camada local em `experimental/sync-v2-lab/client/`.
- API isolada `gcmbs-sync-v2-lab` publicada **desativada** no Supabase; API v6 atual permanece intacta.
- Documentação de feed incremental, recuperação de cursores, proteção contra cota esgotada e operação offline.
- Testes automáticos GitHub Actions, em Node 22, sem credenciais.
- PR #30 em rascunho: `dev/gcmbs-sync-v2-isolado-20261101`; não mesclar.

## 2. Quando tiver acesso ao Windows
1. Não fechar, desinstalar nem limpar dados do Desktop ou do Android antes do backup.
2. Identificar unidade principal e versão instalada, sem pressupor que `F:\GCMBS` é a mais atual.
3. Fazer backup verificável do banco SQLite LOCAL realmente usado (inclusive AppData) e dos arquivos atuais; documentar restauração.
4. Somente então analisar `MobileFullMirrorService.js`, `MobileCloudSyncService.js`, fila V291, senha V296 e rotina de build do APK.
5. Executar o roteiro de inventário **depois de revisá-lo**:
   `experimental/sync-v2-lab/handoff/LEVANTAMENTO_LOCAL_SOMENTE_LEITURA.ps1`.
   Ele gera JSON na Área de Trabalho e não altera o GCMBS. Conferir o JSON antes de compartilhar, pois inclui nomes de pastas, hashes e nome do computador.
6. Examinar a pasta Android real, `package.json`, Capacitor, manifest, versões de Android e assinatura institucional. Não enviar a chave `.jks`, senhas, tokens nem certificados privados.
7. Planejar migração versionada de SQLite e armazenamento criptografado; validar instalação/atualização em aparelho piloto.
8. Implementar `verifyLease` com verificação criptográfica local e política de expiração/revogação. O módulo `offline-view-policy.mjs` **não realiza assinatura** por si próprio: sem o verificador ele nega acesso.
9. Implementar journal com ordenação de commits e revogação/retirada de escopo; não confiar em `id` sequencial do Postgres nem no snapshot paginado experimental.
10. Testar todas as seis modalidades de permuta, extras e obrigatoriedade de aceite, competência 20–19, exceção 01–19/10/2026, teto 84 h e arredondamentos. Nenhuma operação deve ser considerada aprovada apenas porque foi enfileirada.
11. Validar login em 401, rede 402 e acesso offline. Fazer testes de concorrência e de revogação em aparelho real antes de expandir o piloto.
12. Medir Egress **faturado** no Supabase com tráfego real e confirmar projeção abaixo de 3,5 GB/mês. Redução de chamadas SQL não comprova redução de Egress.
13. Implantar gradualmente por feature flag, preservar sistema anterior e procedimento de rollback compatível com novas operações já confirmadas.

## 3. Checklist de segurança e limitações gratuitas
- Supabase Free: 100 Edge Functions por projeto; o GCMBS tinha 89 na última consulta. Não criar novas funções sem necessidade e não excluir funções antigas sem verificar dependências.
- RLS e privilégios devem ser validados para cada tabela exposta; revisão de `mobile_diagnostic_access_audit` ainda pendente.
- Nunca gravar senhas e tokens de autenticação na fila offline; resets V296 usam canal próprio.
- Banco local sensível requer criptografia, credenciais no Keystore e segregação por usuário/dispositivo. O protótipo não fornece esses mecanismos.
- Preservar a versão atual do APK e sua assinatura. Não sobrescrever o banco antigo com backup anterior após operações legítimas confirmadas.
- A API experimental não oferece snapshot consistente nem feed delta de commit seguro.
- A operação online durante indisponibilidade total do Supabase continua limitada; o objetivo inicial é consulta offline previamente autorizada.

## 4. O que NÃO executar automaticamente
- Não habilitar `GCMBS_SYNC_V2_LAB_ENABLED` em produção.
- Não fazer merge do PR #30 antes da homologação.
- Não publicar a branch como GitHub Pages.
- Não fazer DELETE/TRUNCATE/ALTER na base oficial por causa destes protótipos.
- Não instalar APK novo sem teste da migração local.

## 5. Critérios de aprovação da implantação
- Integridade: zero perdas ou duplicações em operações confirmadas nos testes.
- Segurança: autorização verificada pelo servidor e lease offline validado criptograficamente.
- Consistência: cliente reinicia após cursor inválido, perda de conexão e revogação de permissão.
- Contingência: o cache finalizado previamente permanece acessível conforme política mesmo se novas páginas falharem.
- Egress: medição real e projeção mensal com margem, não inferência a partir da quantidade de requisições.
- Reversão: restauração demonstrada, com conciliação de mudanças efetuadas durante o piloto.


## 6. Entregas da sexta rodada remota (01/11/2026)
- `client/offline-view-policy.mjs`: politica **fail-closed** para consultas privadas offline. Exige lease validado por callback criptografico confiavel, vínculo ao GCM e ao dispositivo, permissoes por entidade e expiracao. **Ainda nao ha emissor de lease nem verificador criptografico implementado no Android**, portanto nao pode ser conectado ao app.
- Prazo experimental de cache: institucional 72 horas, pessoal 24 horas e sensivel 6 horas. Estes prazos NAO sao regra final e nao resolvem consultas durante 20 dias sem internet. Requer decisao institucional antes do rollout e plano de revogacao.
- `client/offline-outbox-state.mjs`: recusa credenciais por nome de campo, payload com mais de 32 KiB e estruturas invalidas. Isso **nao garante** que nenhum segredo passe em campo com nome disfarçado; a fila so deve aceitar payloads estruturados e tipados por modalidade após a homologacao.
- `client/quota-budget.mjs`: calcula alertas/projecoes a partir de **Egress faturado** no painel Supabase, nunca inferido apenas do tamanho das tabelas. A projecao linear nao cobre picos ou sazonalidade.
- `handoff/LEVANTAMENTO_LOCAL_SOMENTE_LEITURA.ps1`: inventario das unidades F, G e D quando o usuario estiver no computador, sem ler conteudo dos bancos. Foi incluido passo de CI para validar somente a sintaxe com `pwsh`, sem executar a auditoria.
- Em 01/11/2026 o Supabase tinha 89 Edge Functions para limite Free de 100; **nao criar mais funcoes** salvo necessidade e planejamento. Nenhuma funcao adicional foi implantada nesta rodada.

### Atencao para dados institucionais do GCMBS
Nao presumir que escalas institucionais sao publicas. Mesmo dados de nome de guerra, servicos e rotinas de patrulhamento podem exigir controles de acesso. Nenhuma copia de dados reais deve entrar no repositorio publico ou no cache compartilhado da CDN.


## 7. Continuidade da preparação remota (01/11/2026)
- `client/durable-outbox.mjs` e respectivos testes simulados de transação, falha de gravação, IDs únicos, ACK repetido e mudança de estado sem retrocesso.
- `client/cache-json-codec.mjs` e testes de Map para JSON versionado, limites de 2 MiB, exclusões lógicas, revisões inválidas, registro duplicado e rejeição de JSON corrompido. JSON NÃO é cifragem.
- `client/encrypted-snapshot-store.mjs`: barreira de criptografia obrigatória para futura integração com SQLite. Funções de cifra `seal`/`unseal` são injetadas; implementação Android Keystore permanece pendente. Testes usam AES-GCM com CHAVE EFÊMERA gerada no CI, AAD vinculado a dispositivo, GCM e chave do registro; adulterações/replays são rejeitados.
- `handoff/INTEGRACAO_ANDROID_SQLITE.md`: contrato de integração, riscos, recuperação e testes de instalação/aparelho.
- Funcões e gatilhos Supabase oficiais permanecem intocados; nenhuma função adicional implantada. PR #30 ainda é rascunho.
- A segurança real exige chave persistente no Keystore, transações SQLite duráveis, autorização de acesso offline criptograficamente válida e feed incremental consistente. Nenhum dos testes atuais equivale a homologação do APK.
