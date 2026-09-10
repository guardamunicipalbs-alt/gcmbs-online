# GCMBS App V134 — implementação e auditoria

Data: 10/09/2026
Base publicada: 10.0.85

## Escopo obrigatório

### Banco de Horas — Comando
- Filtro GCM junto de Competência, padrão `Todos os GCMs`.
- Seleção individual por nome de guerra.
- Recalcular 50%, 100%, débitos e saldo ao trocar competência/GCM.
- Exibir movimentações que compõem os totais.
- Incluir extras/movimentações aprovadas posteriormente; total nunca deve ficar congelado na primeira carga.
- Usuário sem perfil de Comando mantém visão pessoal.
- Não inferir total individual a partir do consolidado geral.

### Quadro Operacional — auditoria anti-duplicação
- Preservar correção V110: remover injeção legada `.gc102-analytics`.
- Auditar duplicidade também na coleção de dados antes de renderizar.
- Identidade operacional deve considerar data + turno/período + GCM + posto + origem/referência; não usar somente ID quando houver colisão histórica.
- Serviço A/B deve contar GCMs únicos da coleção consolidada.
- Extras manuais/eventos não podem duplicar por espelho/sincronização.
- Permuta substitui representação operacional anterior.
- Modal/detalhes e cards devem consumir a mesma coleção deduplicada.

### Permutas
- Preservar quatro modalidades existentes e neutralidade financeira das trocas.
- Corrigir aprovação no Android: decisão só fecha/volta após resposta persistida e recarga confirmando novo status.
- Ordenar pendências por data/hora mais próxima.
- Filtrar candidatos por data, turno e tipo de serviço.

### Pendências/paridade já agendadas
- Gerenciador de Escala do Comando e imutabilidade de datas passadas.
- Faltas Justificadas, UTF-8 e DD/MM/AAAA.
- Manutenção ATIVA + Consertado=Não => indisponível e refletida no Quadro.
- Login lembrado; alteração de senha; reset por CPF pelo Comando.
- Ocorrências completas; Quadro de Avisos; notificações apenas a destinatários válidos/ativos.

## Teste de liberação
Comparar App x Online x Desktop na mesma data; conferir A/B, ordinários, extras, eventos, permutas e viaturas. Testar Banco em Todos e em GONDIM; aprovar lançamento após primeira carga e confirmar atualização sem reinstalar. Testar aprovação/recusa de permuta no Android. Não publicar APK com divergência ou repetição.

## Publicação
Gerar versão superior à 10.0.85 somente após testes, assinar com a chave institucional atual, publicar em `downloads/`, atualizar `downloads/version.json` e `instalar.html`. A 10.0.85 permanece publicada até a nova versão passar na auditoria.