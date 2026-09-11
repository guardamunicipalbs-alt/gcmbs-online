# GCMBS V149 — Falta em serviço extra não gera falta na Folha

## Regra consolidada

Uma ausência registrada em **serviço EXTRA** ou **serviço EXTRA por EVENTO** não deve ser tratada como falta funcional na Folha de Pagamento.

Ela possui somente efeito financeiro: o extra não trabalhado deixa de gerar horas/crédito e valor correspondente. A ausência desse extra não pode produzir `F`, `FJ`, contador de faltas ou observação de falta na Folha.

## Regras de exibição

- Serviço ordinário trabalhado: `X`.
- Falta em serviço ordinário: `F`.
- Falta justificada em serviço ordinário: `FJ`.
- Extra/evento trabalhado em dia sem ordinário: pode permanecer `X`, pois houve serviço efetivamente prestado.
- Falta em extra/evento em dia sem ordinário: não exibir `F` nem `FJ`; a célula permanece sem marca de falta (`-`).
- Se no mesmo dia houver ordinário e extra, a marca de falta da Folha é determinada exclusivamente pelo ordinário. Um extra trabalhado não pode mascarar uma falta ordinária.

## Regra financeira

Ao marcar falta em EXTRA/EVENTO:

1. As horas previstas daquele extra não são contabilizadas como realizadas/pagáveis.
2. O valor de 50% ou 100% correspondente deixa de compor a Folha.
3. Não é criada falta funcional na Folha.
4. Não deve aparecer em `OBS. Faltas` ou `OBS. Faltas justificadas`.
5. O registro de frequência continua preservado para auditoria operacional.

## Implementação em produção

A função canônica `gcmbs-folha-hf7-r3` foi atualizada para a regra V149. O fluxo `gcmbs-folha-competencia-v62` já utiliza essa função para relatório e fechamento da competência.

Metadados retornados pelo cálculo:

- `falta_extra_nao_conta_folha: true`
- `extra_falta_apenas_financeiro: true`
- `falta_visual_somente_ordinario: true`
- `fj_somente_ordinario: true`

## Casos auditados em setembro/2026

Foram encontrados registros reais de ausência em extras/eventos sem serviço ordinário no mesmo dia. Esses casos são justamente os que antes poderiam aparecer indevidamente como falta na Folha. A regra V149 impede essa representação e mantém apenas o cancelamento do efeito financeiro.
