# Teste automatizado isolado da interface Online V162

Fixture local com dados sintéticos e resposta simulada do gateway autenticado, sem alterar solicitações reais:

- Total da competência 2026-09: 50% = 1802h45; 100% = 209h00; débitos = 86h15; saldo = 1925h30.
- O registro excluído e o registro de outra competência não entram nos números.
- Ao filtrar GONDIM, métricas passam a 83h00 / 18h00 / 12h00 / 89h00.
- Clique no cartão 50% revela ambos os registros ativos usados no total, sem mostrar registro excluído.
- Clique de aprovação intercepta o caminho legado e chama uma vez o endpoint de decisão simulado; depois remove botão pendente.
- Teste Playwright/Chromium da fixture: PASSOU em todos esses itens. **Não representa homologação com usuário autenticado real**, que exige teste operacional manual autorizado.

O backend `gcmbs-bank-decide-v162` foi implantado e é autenticado por sessão própria do GCMBS; o endpoint não credita automaticamente nenhum serviço. Confirmação real de aprovação não foi disparada neste teste.