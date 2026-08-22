# GCMBS 10.0.62 — correções Desktop agendadas (22/08/2026)

Este documento registra as alterações preparadas sobre uma cópia íntegra do pacote `GCMBS_10.0.62_COMPLETO_FINAL_CONSOLIDADO`. O banco operacional não faz parte do patch.

## Frota / manutenção

Arquivos: `src/repositories/ViaturaRepository.js`, `src/repositories/ManutencaoViaturaRepository.js`, `src/repositories/DashboardRepository.js`, `src/services/PostoService.js` e `src/services/MobileFullMirrorService.js`.

- Manutenção aberta passa a ser um estado operacional derivado; ela não sobrescreve mais `viaturas.status`.
- Concluir uma manutenção não força `ATIVA`, preservando indisponibilidade cadastral por outro motivo.
- Ao existir manutenção aberta sem plano de substituição, o Desktop monta uma lista de substitutas somente entre viaturas com o mesmo tipo canônico e cujo posto de origem tenha exatamente o mesmo mínimo/máximo do posto da principal.
- Plano previamente configurado continua sendo respeitado; não é substituído automaticamente.
- O Quadro Operacional utiliza somente o plano configurado/gerado e não escolhe veículo aleatório.
- No banco auditado, VTR 01, VTR 02, VTR PMP 01 e VTR PMP 02 formam o grupo operacional 3/4. MT 03 e MT 04 não receberam equivalência inventada porque possuem capacidades diferentes.

## Controle de Acesso protegido Online/App → Desktop

Arquivo: `src/services/MobileCloudSyncService.js`.

Novos tipos de ação da fila:

- `CONTROLE_ACESSO_SALVAR`
- `CONTROLE_ACESSO_RESTAURAR`
- `CONTROLE_ACESSO_ATIVO`

O Desktop revalida o autor e o alvo antes de aplicar. O Comandante permanece total e não redutível; somente o Comandante altera o Subcomandante; o próprio usuário não reduz suas permissões quando não for Comandante. A substituição da matriz de permissões ocorre em uma única transação SQLite e gera registro de auditoria. Após sucesso, o espelho integral é sincronizado.

## Imagens da GCM protegidas Online/App → Desktop

Arquivos: `src/services/MobileCloudSyncService.js` e `src/ipc/imagensGcm.ipc.js`.

Novos tipos de ação da fila:

- `IMAGEM_GCM_CRIAR`
- `IMAGEM_GCM_PRINCIPAL`
- `IMAGEM_GCM_EXCLUIR`

O arquivo físico é criado/removido exclusivamente pelo Desktop. Inclusão valida nome, finalidade, MIME e limite de 8 MB. Exclusão usa renomeação temporária para quarentena antes da transação; se o banco falhar, o arquivo é restaurado. Depois do commit o arquivo em quarentena é apagado e o espelho integral é atualizado.

A Edge Function `gcmbs-desktop-actions` v7 remove `arquivo_dados`/`base64` do payload da ação de imagem depois que o Desktop confirma `PROCESSADO`, preservando a auditoria sem reter os bytes indefinidamente.

## Online/App

- Nova Edge Function: `gcmbs-protected-admin-v62`.
- `js/v62-controle-acesso-ui-fix.js` envia alterações somente pela fila protegida.
- `js/v62-imagens-gcm-ui-fix.js` envia inclusão/principal/exclusão somente pela fila protegida.
- `js/access-catalog.js` usa novos cache keys `acesso02` e `imagens02`.

## Validações executadas

- Os sete arquivos Desktop modificados passaram em `node --check`.
- O ZIP do patch passa no teste de integridade e não contém `.db`, `.sqlite` ou `.sqlite3`.
- O instalador do patch calcula SHA-256 dos bancos antes/depois e restaura os arquivos-fonte se houver alteração inesperada ou falha de sintaxe.
- A fila Supabase permaneceu sem ações pendentes após o deploy das rotas, confirmando que nenhuma operação de negócio foi criada automaticamente.
- O Advisor de segurança deixou de reportar `function_search_path_mutable` após a migration `20260822_secure_permuta_function_search_path.sql`.

## Estado de release

Estas alterações permanecem na branch de auditoria. Não fazer merge em `main` nem publicar APK antes da aplicação do patch Desktop e da validação funcional integrada.
