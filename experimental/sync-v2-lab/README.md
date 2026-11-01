# GCMBS Sync V2 — laboratório de desenvolvimento (01/11/2026)

> **NÃO É VERSÃO DE PRODUÇÃO.** Não trocar URLs do Android ou do Online, não ativar o serviço e não executar migrações no banco oficial sem homologação.

## Objetivo
Diminuir Egress, sem perder permutas, escalas, banco de horas ou autorizacoes.
O prototipo criado nesta etapa implementa SOMENTE um endpoint paginado de leitura isolado.
**NAO ha ainda delta transacional, persistencia offline Android ou garantia de reducao de consumo.**

## Estado real
- Branch `dev/gcmbs-sync-v2-isolado-20261101`, separada de `main`.
- Funcao `gcmbs-sync-v2-lab` desligada por padrao.
- Variavel `GCMBS_SYNC_V2_LAB_ENABLED` somente pode ser habilitada em homologacao controlada.
- Endpoint `POST {action:"ping"}` nao toca o banco nem retorna informacoes internas.
- Endpoint protegido `POST {action:"snapshot_page",entity,after_key,limit}` usa somente token de sessao existente, permissoes e filtro de escopo individual **no servidor**. Mesmo Comando recebe apenas os proprios registros nesse laboratorio.
- Entidades de teste: escalas, permutas, escalas_extras_manuais, banco_horas_movimentacoes.
- Pagina: maximo 25 registros e resposta limitada a 128 KiB; nao armazena token e nao modifica banco.
- Consultas protegidas indisponiveis por padrao (503).
- Nenhum aplicativo atual foi apontado para a nova API.

## Resultados confirmados
- PostgreSQL 216 MB; tabelas auditadas (01/11): escalas 4117, permutas 121, escalas_extras_manuais 339, banco_horas_movimentacoes 1055. Todas tem scope_guard_ids nao vazio.
- API v6 atual devolve pacotes grandes em `action:data`, e faz leitura completa de alguns conjuntos.
- `js/gcmbs-smart-data-cache-v161.js`: memoria, TTL data 20 s, references 120 s.
- `sw.js`: rede primeiro, dados operacionais nao persistidos.
- `js/data-provider.js`: restore pode invalidar sessao em falhas de rede; deve diferenciar 401 de 402/timeout.
- Possivel excesso de dados em `references` (justificativas) antes de filtragem no navegador; corrigir acesso NO SERVIDOR, separadamente.

## Limitacoes de seguranca e integridade pendentes
1. A API antiga possui autenticacao propria; a V2 precisa de avaliacao de seguranca independente antes da ativacao.
2. Nao usar `mobile_entity_changes.id` diretamente como cursor duravel sem revisar a ordem transacional/commit de TODAS as origens de escrita.
3. O snapshot paginado nao esta congelado transacionalmente: alteracoes entre paginas podem causar inconsistencias; laboratorio nao garante completude.
4. As remocoes e mudancas de escopo requerem journal historico de autorizacao e invalidacao do cache. O filtro atual so envia tombstones que preservam o escopo anterior.
5. Nao guardar dados sensiveis na CDN publica ou em GitHub Pages.
6. Nao fazer merge e nao apontar APKs para este endpoint ate: testes de contrato, seguranca, qualidade de rede, Android offline e integracao com Desktop.
7. Falhas HTTP 402 nao podem apagar tokens nem operacoes locais; erros 401/403 verdadeiros exigem politica de revogacao segura.
8. Limites mensais gratuitos NAO garantem disponibilidade online ininterrupta.
9. Nao mudar esquemas nem corrigir RLS em massa sem conferir politicas dependentes e impacto nos clientes.
10. Desenvolvimento de sincronizacao incremental definitiva depende do codigo atual da rotina Desktop e dos fontes Android Capacitor.

## Criterios objetivos antes de qualquer integracao
- 0 vazamentos interusuario nos testes, inclusive cache e permissoes revogadas.
- 0 duplicacoes e 0 perdas de operacoes confirmadas nos casos de repeticao, timeout e corrida.
- Sem retrocessos nas seis modalidades de permuta, competencia 20-19, excecao 01-19/10/2026, teto 84 h, arredondamentos, ferias e descontos.
- Comparar bytes transferidos por Android/Online/Desktop e projetar < 3.5 GB de Egress nao cacheado em 30 dias.
- Assinatura Android institucional preservada; migracao da base local testada em aparelho real.
- Rollback separado da restauracao de dados: NUNCA restaurar base velha por cima de operacoes reais recentes.

## Plano de continuidade
1. Inventariar 100% dos endpoints existentes no Online, Android e Desktop. Medir payload real.
2. Implementar journal transacional ordenado com tombstones, ACL e cursor verificavel em homologacao.
3. Criar testes automatizados deterministas de concorrencia e permissoes.
4. Integrar cliente offline-first (SQLite cifrado/isolado por usuario) e fila com idempotencia e ACK.
5. Habilitar API incremental por recurso e dispositivo piloto, com feature flag e rollback.
6. Medir consumo apos renovacao da franquia: nao deduzir economia somente por menos chamadas.
7. Planejar opcionalmente a Cloudflare apenas para conteudo publico e compartilhavel; jamais como proxy obrigatorio.

## Reversao
- Nao houve alteracao de rotas de producao. Remover/desabilitar a funcao de laboratorio e a branch experimental basta para desfazer esta etapa.
- Na implantacao futura, manter a API v6 ate homologar a V2. Nao apagar filas nem compactar historicos durante rollout.


## Auditoria remota complementar (01/11/2026)
- 89 Edge Functions registradas no Supabase, incluindo `gcmbs-sync-v2-lab`. **Nao significa 89 funcoes em uso.**
- Os gateways v74 e v131 compoem cadeia para algumas operacoes: v74 -> v131 -> API v6. O frontend ja realiza bypass de algumas acoes.
- Nesta branch, `entity_catalog` e `entity_list` de entidades comuns passam direto ao CORE. `justificativas_faltas`, `ocorrencias_operacionais` e `eventos_extras` preservam o gateway v74. Escritas e decisoes nao mudaram de rota.
- API v6 nesta branch usa filtro SQL para extras e permutas de GCM comum antes da transmissao do PostgreSQL para a funcao. Gestores preservam a consulta institucional.
- Verificacao de consistencia em banco (somente leitura): 336 extras ativos possuem `scope_guard_ids` compatível com `data.guarda_id`; 121 permutas ativas contem participantes no escopo. Registros futuros precisam manter esse contrato.
- Em 25 perfis ativos nao gestores foram observados, em media, 13,4 extras e 9,6 permutas no escopo individual. Filtros melhoram eficiencia SQL, **mas nao ha prova de economia de Egress faturado**.
- A tabela `public.mobile_diagnostic_access_audit` possui RLS desabilitado. Os grants atualmente consultados foram `postgres` e `service_role`, e nao `anon` nem `authenticated`. Ainda avaliar defesa em profundidade; nao alterar sem impacto conhecido.
- Novo laboratorio `ReadRetryGate` limita o polling automatico quando ocorre 402 (uma hora entre novas sondagens), 429, 5xx e falha de rede, com reset apos sucesso. **Nao integrado a nenhum cliente e nao deve bloquear operacoes manuais.**
- Os testes de roteamento, escopo SQL, falhas HTTP e retry foram adicionados ao CI do pull request em rascunho.
- Nenhuma alteracao no `main`, nem na Edge Function principal publicada; nada foi enviado para os dispositivos dos GCMs.
- Ainda depende de auditoria do Android e Desktop atuais, teste de carga real e medicao do dashboard de Billing/Egress do Supabase.

### Gate de release adicional
Nao declarar resolvida a indisponibilidade por cota apenas com otimizacao de consultas internas. Uma resposta final menor e cache local offline comprovado sao obrigatorios, assim como Egress <= 3,5 GB por ciclo medido com margem.
