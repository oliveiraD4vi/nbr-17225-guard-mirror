# Releases e Chrome Web Store

Este documento descreve a preparação de versões públicas do Guardião NBR 17225. A publicação deve manter o mesmo item da Chrome Web Store para preservar o identificador da extensão e o ciclo automático de atualização.

## Arquivos de versão

Antes de gerar um pacote, atualize em conjunto:

- `package.json`, com a versão numérica do projeto;
- `public/manifest.json`, com `version` numérico e `version_name` completo;
- `src/version.ts`, usado pela interface;
- `README.md`, `docs/VERSIONING.md` e `docs/CHANGELOG.md`.

A Chrome Web Store exige que cada novo `version` do manifesto seja maior que o publicado anteriormente. O sufixo Beta fica em `version_name`, pois o campo `version` aceita somente números e pontos.

## Validação e pacote

Execute antes da tag:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm verify:rules
pnpm build
```

O ZIP enviado à loja deve conter o conteúdo de `dist/` na raiz do pacote. Artefatos de distribuição ficam fora do repositório público.

Use uma tag anotada no commit de release:

```bash
git tag -a v1.1.0-beta.4 -m "Release v1.1.0-beta.4"
```

Para a rodada atual da linha V1 Farol Beta, use:

```bash
git tag -a v1.1.4-beta.8 -m "Release v1.1.4-beta.8"
```

## Atualização dos usuários

Depois que um pacote com versão superior é aprovado e publicado no mesmo item da Chrome Web Store, o Chrome distribui a atualização automaticamente. O navegador procura novas versões ao iniciar e em verificações periódicas, aplicando a atualização quando a extensão está ociosa. Uma extensão carregada manualmente em modo de desenvolvedor não participa desse fluxo da loja.

Tags Git e arquivos ZIP locais não publicam a extensão. O pacote precisa ser enviado, revisado e publicado no painel da Chrome Web Store.

Referências:

- [Ciclo de atualização de extensões](https://developer.chrome.com/docs/extensions/develop/concepts/extensions-update-lifecycle)
- [Atualização de um item na Chrome Web Store](https://developer.chrome.com/docs/webstore/update/)

## Aviso da Navegação segura melhorada

O Chrome pode avisar que uma extensão ainda não é considerada confiável pela Navegação segura melhorada. Segundo a documentação do navegador, desenvolvedores novos normalmente precisam de alguns meses de histórico em conformidade com as políticas da Chrome Web Store para adquirir esse estado de confiança.

Esse aviso não é removido por uma configuração do manifesto. O projeto deve manter finalidade única, descrição transparente, política de privacidade atualizada e apenas as permissões necessárias. Nesta versão, `storage`, `activeTab` e `scripting` continuam necessárias para salvar auditorias e executar a análise solicitada pelo usuário na aba ativa.

Referências:

- [Instalação de extensões com Proteção reforçada](https://support.google.com/chrome/answer/2664769)
- [Políticas do Programa para Desenvolvedores](https://developer.chrome.com/docs/webstore/program-policies)
