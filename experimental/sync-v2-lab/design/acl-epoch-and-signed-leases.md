# GCMBS Sync V2 — desenho de revogação de permissões e assinatura offline

**Estado:** proposta de arquitetura. Nenhuma migração SQL, gatilho, segredo ou alteração de produção foi executada.

## Diagnóstico observado no Supabase em 01/11/2026
- `public.mobile_permissions`: `guarda_id`, `modulo`, `nivel`, `ativo`, `updated_at`.
- `public.mobile_profiles`: `guarda_id`, `role`, `ativo`, `controle_total`, `updated_at`.
- Ambas as tabelas possuem **RLS habilitado** e políticas `SELECT` para o próprio usuário ou administrador.
- Existem privilégios nominais da role `authenticated` para outras operações, mas **isso não significa que essas operações são permitidas**: a análise completa deve considerar RLS, políticas efetivas e funções privilegiadas.
- Nenhuma coluna `acl_revision` e nenhum gatilho específico para estas tabelas foi localizado. `updated_at` não equivale a contador monotônico de revogação e não prova ordenação transacional.

## Contrato de autorização (somente leitura)
O emissor institucional deve gerar um documento curto assinado com chave privada **fora do APK**. O cliente só contém chaves públicas fixadas e identificadas por `keyId`.

O verificador experimental `client/signed-offline-lease.mjs` já exige:
- assinatura ES256 válida;
- `issuer=GCMBS` e `audience=gcmbs-android-offline`;
- `guardaId`, `deviceId`, `aclRevision` monotônico positivo;
- conjunto ordenado de entidades autorizadas;
- classificação assinada para **cada** entidade (`INSTITUTIONAL`, `PERSONAL` ou `SENSITIVE`);
- emissão e expiração em ISO UTC, duração máxima **experimental** de 72 h;
- chave de assinatura de uma lista confiável da aplicação, não obtida da rede em tempo de verificação.

Uma autorização de leitura não autoriza escrita, aprovações, permutas, envio de senhas ou pagamentos. Nenhuma chave privada é incluída no repositório.

## Como produzir aclRevision corretamente (PROPOSTA, NÃO APLICADA)
Preferir **uma única revisão por GCM**, vinculada ao conjunto de permissões. Duas estratégias possíveis exigem comparação em banco de testes:

**A. Coluna `acl_revision bigint` na entidade de perfil, atualizada transacionalmente.**
- Inicializar um valor positivo por perfil existente, na mesma migração versionada.
- Em alterações de `mobile_permissions` (INSERT, UPDATE, DELETE) e em alterações relevantes de perfil (`role`, `ativo`, `controle_total`), aumentar `acl_revision` de cada GCM afetado **na mesma transação**.
- `UPDATE mobile_profiles SET acl_revision=acl_revision+1` serializa concorrência por linha, desde que todas as origens sejam cobertas.
- Evitar recursão: não disparar incremento apenas por alteração do próprio `acl_revision`.
- Se `guarda_id` de uma permissão mudar, invalidar tanto o antigo quanto o novo titular.
- Os gatilhos devem estar em `private`, com `search_path` imutável e permissões mínimas; revisar `SECURITY DEFINER` e exposição REST.

**B. Pequena tabela privada de épocas ACL por usuário.**
- Evita tocar em `mobile_profiles`, mas adiciona armazenamento e migração.
- Cada mudança transacional do perfil/permissões atualiza uma linha bloqueada por GCM.
- O serviço de assinatura deve consultar a revisão junto às permissões em um snapshot consistente.

**NÃO escolher nem executar A/B sem revisar origens de escrita, dependências do Desktop e política de migração/rollback.**

## Emissão, renovação e revogação
1. Após login/sessão autenticada, servidor verifica perfil, permissões, vínculo ao aparelho e `acl_revision` atual.
2. Servidor assina *somente* claims minimais; nenhuma senha, CPF, matrícula, token de sessão ou conteúdo de escala entra no lease.
3. O cliente autentica localmente a assinatura, verifica a revisão ACL mais recente armazenada em estado protegido e exige a classificação assinada para cada entidade.
4. Se o servidor comunicar revogação de permissão e uma revisão maior, suspender imediatamente o acesso offline ao escopo retirado e limpar/recifrar cache conforme política.
5. Sem conexão, o aparelho NÃO pode descobrir revogação nova; por isso o lease expira. Mesmo após expirar, o cache pode permanecer **criptografado e indisponível para leitura**, evitando exclusão destrutiva de dados até reconciliação.
6. Aparelho trocado ou redefinido exige vínculo novo. Transferir dados criptografados para outro `deviceId` não deve permitir leitura.
7. Relógio local pode ser adulterado. Antes do rollout, adicionar detecção de retrocesso do relógio e política de tolerância baseada em horário confiável/estado protegido. Não afirmar que a expiração é infalível sem hardware e testes específicos.
8. Rotação das chaves: suportar múltiplas chaves públicas confiáveis com sobreposição controlada e revogação explícita de `keyId` antigo; nunca aceitar JWK fornecido em payload como nova chave confiável.

## Critérios de homologação
- Duas alterações de permissão concorrentes resultam em revisões monotônicas e distintas.
- `acl_revision` aumenta em todas as rotas de escrita (Admin Online, Desktop, Edge Functions e SQL controlado).
- Mudança de `role`, `ativo`, `controle_total`, nível de módulo, escopo e exclusão invalida corretamente.
- Testes com dois GCMs, dois aparelhos, chave errada, assinatura adulterada e revisão ACL desatualizada passam.
- Ausência da chave ou revisão confiável = **negação de leitura offline privada**.
- Prazo de acesso institucional, pessoal e sensível só é fixado após decisão formal; os 72/24/6 h do protótipo NÃO são política municipal aprovada.
- A integração precisa evitar perder solicitações offline mesmo quando o lease expirar.

## Importante
A existência do verificador isolado NÃO torna o Android atual seguro/offline. Falta emissor real, proteção Keystore, revisão ACL no servidor, atualização do APK, política institucional de dados e homologação.
