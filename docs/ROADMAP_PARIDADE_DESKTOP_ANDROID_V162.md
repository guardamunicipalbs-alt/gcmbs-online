# Acompanhamento — paridade Desktop e Android

**Pendente (não executado no Desktop ou no APK).** Implementar após validação isolada da interface Online V162 e bloqueio da sincronização antiga que sobrescreve o espelho.

- Desktop Electron: botões responsivos para 50%, 100%, débitos e saldo; consulta a movimentações ativas com ID, nome de guerra, data de fato, tipo, origem, classe e motivo; subtotais por categoria; resumo por GCM/competência, transparência das horas previstas e efetivadas.
- Android Capacitor: reproduzir interface e filtragem por GCM com permissão do Comando, sem reutilizar lançamento legado. Compilar e assinar APK usando chave institucional preservada; nunca regenerar chave automaticamente.
- Backend: conciliar referências de solicitações por identidade composta (solicitante, data, competência, classe e tipo); não aplicar comandos por ID isolado. Mostrar aprovação online separada da contabilização e do pagamento. Respeitar teto de 84 h, histórico da folha, transportes e todos os estornos.
- Testes: sessão autorizada/negada, aprovação e recusa, idempotência em dois dispositivos, exceção de internet, conflito de IDs #280/#281, filtragem de Gondim (83h/18h/12h/89h na referência), soma de todas as competências, consistência Desktop→Online→Android.
- Implantação: backup íntegro do SQLite, PR com diff e testes, homologação com responsáveis, publicação do Desktop e depois do APK. Não fechar folha por números inconciliados.

Referência de código Online: `js/gcmbs-bank-audit-v162.js`, função `gcmbs-bank-decide-v162`, documento `docs/BANCO_HORAS_V162_CONCILIACAO.md`.