# PENDÊNCIA CRÍTICA — Identidade de registros e sincronização Desktop

Durante a auditoria de 16/09/2026, os IDs 718–726 de banco de horas divergiram na identidade GCM entre `mobile_entity_records` e `mobile_banco_horas`. Além disso, solicitações #280 (GCM 23) e #281 (GCM 11) indicam IDs Desktop 18 e 19, que pertencem a solicitações anteriores de GCM 24.

Não permitir aplicação automática de comandos usando ID isolado ou sobrescrita do espelho por Desktop 10.0.85. Validar todas as partes da identidade, nomeadamente GCM, competência, data do fato, operação e identificador de origem. Em conflito, preservar ambas as versões, abrir pendência para revisão e nunca lançar horas financeiras automaticamente.

O endpoint de decisão Online V162 já trata referências conflitantes como `desktop_id=null`, marcando `identity_collision` e `requires_identity_reconciliation`. O consumidor Desktop ainda precisa ser adaptado e homologado; a decisão online não cria crédito financeiro até sua conciliação.