# Auditoria do Quadro Operacional V134

A correção V110 existente já remove o bloco legado `.gc102-analytics`. Na V134, a validação deve impedir regressão no Android e confirmar que a duplicação não nasce também na coleção de dados.

Critérios: uma única seção Efetivo, Viaturas, Postos e Quadro de Avisos; IDs DOM únicos; Serviço A/B calculados a partir de registros operacionais únicos; extras manuais/eventos sem repetição de espelho; permutas substituindo o registro operacional anterior; modal e cards usando a mesma coleção consolidada.

A identidade de um serviço não deve depender apenas do ID quando houver registros de origens diferentes. Comparar data, turno/período, GCM, posto e origem/referência. Divergências entre App, Online e Desktop bloqueiam a publicação.