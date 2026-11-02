# GCMBS Sync V2 — atestação do snapshot offline (laboratório)

**Status: especificação experimental. NÃO HABILITAR no Android de produção.**

## Problema resolvido parcialmente
O protótipo `two-generation-cache.mjs` protege a cópia anterior quando uma captura falha entre páginas, mas não prova que a captura reúne uma fotografia consistente do servidor. Simplesmente terminar a última página não resolve esse problema, e o laboratório Supabase atual não emite snapshot consistente.

## Proteção implementada no GitHub
- `client/snapshot-attestation.mjs` calcula SHA-256 de um conjunto canônico de registros, ordenados por chave, revisão, flag de exclusão e dados de cada registro.
- A atestação aceita apenas assinatura ECDSA P-256 (ES256) válida, com separação criptográfica de domínio `GCMBS_SYNC_SNAPSHOT_V1` e chave pública confiável embutida no aplicativo.
- A atestação identifica GCM, aparelho, entidade, `captureId`, digest, emissor, finalidade e validade de no máximo seis horas (prazo somente experimental).
- `client/authorized-cache-reader.mjs` exige desbloqueio local, relógio confiável, lease assinado, `aclRevision` confiável e **atestado de captura válido**, além do atributo de captura concluída.
- Rejeita dados adulterados, usuário diferente, aparelho diferente, revisão de acesso desatualizada, dados excluídos de maneira incorreta e prova ausente.
- O leitor utiliza diretamente a verificação de assinatura e digest; não aceita callback que simplesmente retorne `true` para autorizar uma captura.
- Os testes do GitHub empregam **somente dados fictícios e chave efêmera de teste**.

## Bloqueios de implantação
1. **Não existe ainda emissor oficial da atestação.** Implementá-lo exige um mecanismo transacional confiável de snapshot no backend, incluindo watermark sem lacunas de commit, filtro de escopo e política de revogação.
2. O backend deve assinar o digest da mesma fotografia efetivamente autorizada e enviada ao GCM. Não é permitido assinar páginas soltas do endpoint atual.
3. A chave privada de assinatura não pode entrar em repositório público, APK ou chamadas de frontend. A assinatura de leases e snapshots deve usar chaves institucionais com rotação e auditoria.
4. O servidor precisa produzir data/hora e vincular autorização a perfis reais. O App precisará de proteção contra alteração/retrocesso do relógio.
5. O armazenamento local real precisa ter SQLite durável, criptografia integrada ao Keystore, migração segura e testes de atualização de APK.
6. O mecanismo atual mantém `serverSnapshotConsistent:false` por projeto: **isso é correto**. Nenhum cliente de produção deve ativar essa flag por conveniência.
7. A verificação criptográfica da captura não garante validade de normas de escala, folha financeira ou permutas; esses dados ainda exigem validação pela autoridade central.
8. Economizar Egress só será comprovado pela métrica faturada, depois da integração.

## Teste de aceitação futuro
- Em banco de homologação, um emissor autorizado realiza bootstrap com watermark, journal ordenado, revogação e assinatura dos registros.
- O Android obtém os dados em páginas, confirma cada uma atomicamente e só libera leitura da geração ativa após verificar a atestação.
- Alterar um único campo do cache, fazer replay em outro aparelho ou revogar a ACL deve bloquear a consulta de dados privados.
- Forçar HTTP 402 após a primeira página deve manter intacta a geração ativa anterior e a fila de solicitações.
- Não liberar para a equipe enquanto qualquer uma dessas verificações falhar.
