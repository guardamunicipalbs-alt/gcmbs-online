# GCMBS Online — Auditoria funcional do Quadro Operacional (V394)

**Data:** 23/11/2026 · **Escopo:** somente leitura do Desktop, implementação de consultas exclusivamente Online. Desktop `F:\GCMBS` não foi alterado. Modelo B (intervalo mínimo de 30 minutos) não foi modificado.

## Fonte examinada

1. Captura de arquivos Desktop de 17/11/2026: `dashboard.html`, `dashboard.js`, `gcmbs-dashboard-v99-clicks.js`, `gcmbs-dashboard-v280-consolidado.js`.
2. Relatório de inspeção Desktop de 18/11/2026, confirmando utilização de resolvedores de permutas R15/R16/R19, separação A/B e exibição de viaturas por turno.
3. Versão histórica de `DashboardRepository.js` em auditoria consolidada de 15/09/2026 para critérios de detalhamento de efetivo, Frota, Postos e Faltas.
4. Código atualmente publicado do Online: `js/app-core.js`, `js/data-provider.js`, `js/gcmbs-online-app-v118-exact.js`; rotas Supabase `gcmbs-communication-gateway-v74`, `gcmbs-quadro-canonico-v173`, `gcmbs-quadro-extras-v68`, `gcmbs-permutas-efetivas-read-r14`.

**Limite metodológico:** estas fontes são backups e relatórios de código obtidos anteriormente; não há acesso direto à árvore atual no computador Windows `F:\GCMBS`. Não se deve declarar paridade exata com mudanças Desktop posteriores a 18/11 sem nova captura somente leitura.

## Matriz funcional do Desktop e paridade Online

| Indicador | Informação observada no Desktop | Implementação V394 |
|---|---|---|
| GCM ativos | nomes de guerra, dados funcionais | `efetivo.detalhes.ativos` do Quadro autenticado |
| Afastados | nomes/status dos afastados | `efetivo.detalhes.afastados` |
| Em férias | nomes, mês de férias | `efetivo.detalhes.feristas` |
| Postos cadastrados | nomes/prioridades, mínimos/máximos; postos cobertos com turnos e GCMs | `references.postos` + `postos.detalhamento` da data |
| Frota total | prefixo/placa/modelo e situação | `viaturas.detalhes.total` |
| Disponíveis | prefixo/placa/modelo e situação | `viaturas.detalhes.disponivel` |
| Em uso | viatura, substituta, postos, GCMs por turno A/B | `viaturas.detalhes.emUso` + `efetivo.detalhes.servicoA/B`; não atribui turno sem confirmação |
| Detalhes da Frota | cadastro de KM, óleo, licenciamento etc. | formulário somente leitura existente mantido (sem acesso a cadastro) |
| Em manutenção | viatura e eventual substituta | `viaturas.detalhes.manutencao` |
| Serviço A | nome de guerra, posto e horário; natureza de serviço e permutas | `efetivo.detalhes.servicoA` + permutas R14, se autorizadas e conciliáveis |
| Serviço B | idem para 19h–07h | `efetivo.detalhes.servicoB` + permutas R14 |
| Extra A | GCMs e designações Extras no turno A (manual, automática, evento) | `gcmbs-quadro-extras-v68.extrasA` |
| Extra B | idem turno B | `gcmbs-quadro-extras-v68.extrasB` |
| Faltas | nome, falta/falta justificada, tipo de serviço, motivo/observações | `faltas.registros` no Quadro autenticado |

## Correção feita

Criado `js/gcmbs-quadro-paridade-v394.js`, carregado após o módulo visual V118. Intercepta apenas botões na área do Quadro, consulta **o endpoint autenticado** no momento do clique, apresenta a lista detalhada no modal preexistente, evita depender de cards legados ocultos e mantém a data selecionada.

O fluxo usa apenas `POST` de **consultas**, sem chamadas para `entity_mutate`, `UPDATE`, `DELETE`, criação de escalas, folha ou registro de ponto. A permuta R14 possui checagem de perfil no servidor, não é exposta para perfil sem autorização.

## Divergências remanescentes: DADOS (não interface)

Na auditoria remota de 23/11/2026, foram encontradas:

- Última atualização de escalas: 16/11/2026 (UTC); 100 escalas armazenadas para 23/11, correspondentes a 11 guarda_ids distintos.
- Extras manuais: última atualização em 12/11/2026; nenhuma Extra manual ATIVA para 23/11.
- Frequência: última atualização em 12/11/2026.
- Viaturas: última atualização em 23/09/2026.
- Postos: 10 cadastros presentes; a contagem de postos cobertos é uma métrica diferente.

**Conclusão:** a V394 realiza a paridade da **apresentação dos detalhes disponíveis no Online**, não prova que as escalas e números reflitam a versão mais recente do SQLite do Desktop. A sincronização dos registros atuais deve ser homologada separadamente; nenhum número deve ser artificialmente alterado.

## Testes

- JavaScript passou na validação de sintaxe; arquivo incluído uma vez no `index.html`.
- Identificadas chamadas de leitura para Quadro, Extras e permutas autorizadas.
- Ainda depende de teste funcional com sessão autenticada para conferir todos os botões e o conjunto de dados efetivamente disponível no navegador.
