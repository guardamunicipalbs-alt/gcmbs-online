# Banco de Horas · Online V162 (16/09/2026)

## Objetivo e estado da implementação

A interface Online passa a disponibilizar quatro cartões clicáveis e responsivos: 50%, 100%, Débitos e Saldo. Cada clique consulta `data.banco_horas` pelo gateway autenticado, aplica **o mesmo filtro de competência e GCM** da tela e considera apenas registros com `status=ATIVO`. O detalhamento agrupa por tipo e origem, mostra subtotais e lista os registros com ID, data, nome de guerra, motivo, classe e valor. O saldo corresponde a créditos 50% + créditos 100% - débitos; serviços futuros permanecem sinalizados PREVISTOS.

O código da visualização NÃO grava, exclui, restaura nem duplica movimentos. Os resultados dependem da integridade da base consultada.

O fluxo de decisão de correções online usava `gcmbs-mobile-api-v6`, que registrava comando `BANCO_HORAS_DECISAO_COMANDO` e mantinha a solicitação em `DECISAO_PENDENTE_DESKTOP`, razão pela qual a aprovação não aparecia concluída no Online até sincronização. O novo endpoint autenticado `gcmbs-bank-decide-v162` registra imediatamente a decisão administrativa online e envia um comando idempotente ao Desktop. **Não cria crédito financeiro imediatamente**, para evitar pagamento duplicado. Toda decisão e crédito efetivo devem ser conciliados pelo Desktop e auditados.

## Conflito de IDs constatado

Solicitações #280 (GCM 23) e #281 (GCM 11) estão associadas a `desktop_referencia_id` 18 e 19, mas os registros canônicos desses IDs correspondem a outras solicitações de GCM 24. Uma coincidência de ID jamais autoriza alterar o registro de outra pessoa. O endpoint valida guarda, competência e data do serviço; se a referência não confere, insere o comando com `desktop_id=null`, sinaliza `identity_collision` e exige reconciliação antes de atribuir horas. Atualizar o sincronizador do Desktop para tratar a identidade completa, não apenas o ID.

## Pré-condições de publicação e aceitação

- Recarregar o Online forçando atualização de cache (Ctrl+F5) e confirmar carregamento do arquivo `gcmbs-bank-audit-v162.js?v=100162`.
- Conferir setembro de 2026: 50% 1802h45; 100% 209h00; débitos 86h15; saldo 1925h30 no momento da referência; total é dinâmico se lançamentos mudarem.
- Clicar em cada cartão e confirmar a soma dos respectivos registros ativos e a fórmula do saldo.
- Filtrar GCM GONDIM: 50% 83h00, 100% 18h00, débitos 12h00, saldo 89h00 na referência do incidente.
- Testar aprovação e recusa somente em solicitações de homologação, sem decidir solicitações reais involuntariamente. Confirmar ausência de comandos duplicados e que as 24h solicitadas em #285/#286 não foram somadas antes da aprovação/conciliacão.
- Conciliar as divergências de identidade em `mobile_banco_horas` vs. `mobile_entity_records`, IDs 718 a 726, antes de fechar folha ou permitir sincronização integral com versão legada 10.0.85.

## Paridade futura

Criar implementação específica para Desktop (Electron) e App Android (Capacitor); reutilizar layout, filtros, fórmula e validação de origem/identidade. Não distribuir APK nem modificar banco SQLite sem backup, teste de integrações e auditoria individual. Issue de acompanhamento registra o escopo e checklist.