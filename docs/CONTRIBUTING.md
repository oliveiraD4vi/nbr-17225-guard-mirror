# Contribuindo

Este guia descreve como contribuir com a extensão open-source do Guardião NBR 17225.

## Escopo atual

O Guardião trabalha com um catálogo de 146 itens: 96 requisitos normativos e 50 recomendações, revisados contra a referência pública da ABNT NBR 17225.

Neste momento:

- correções de implementação dentro desse escopo são bem-vindas;
- melhorias de UX, performance, robustez e testes são bem-vindas;
- mudanças de catálogo exigem matriz normativa, fixtures e rastreabilidade pública no mesmo lote.

## Antes de abrir uma contribuição

Leia estes arquivos:

- `../README.md`
- `RULES_ANALYSIS.md`
- `RULES_CODE_MAPPING.md`
- `RULES_NORMATIVE_MATRIX.md`
- `FUTURE_RULES_PLAN.md`
- `VERSIONING.md`

Eles explicam o escopo atual, o mapeamento das regras e as divergências residuais já conhecidas.

## Ambiente local

Pré-requisitos:

- Node.js
- pnpm
- navegador Chromium compatível com Manifest V3

Instalação:

```bash
pnpm install
```

O `pnpm install` também executa `prepare` e habilita os hooks locais do Husky para este clone.

Validação local:

```bash
pnpm format:check
pnpm lint
pnpm type-check
pnpm verify:rules
pnpm test
pnpm build
```

Validação automática no fluxo de Git:

- `pre-commit`: `pnpm stage-lint`
- `pre-push`: `pnpm test` + `pnpm build`

## Diretrizes de contribuição

- mantenha o texto da interface em português brasileiro UTF-8;
- concentre novos textos no catálogo de i18n, evitando strings soltas em componentes;
- preserve o escopo da V1 Farol;
- prefira mudanças pequenas e bem delimitadas;
- siga os padrões já existentes de tipagem, persistência e nomes de arquivos;
- não misture refatoração ampla com correção funcional se isso puder ser separado;
- ao mexer em auditoria, valide impacto em:
  - persistência por aba;
  - histórico por URL;
  - comparação entre auditorias;
  - herança de revisão humana;
  - exportação.

## Como adicionar ou alterar uma regra

Ao mexer em regra, trate a mudança como um fluxo completo do produto, não só como uma função nova no motor.

Checklist recomendado:

1. implemente ou ajuste a regra em `src/rules/`;
2. registre a regra no agregador correto em `src/rules/index.ts`;
3. mantenha `nbrReference`, severidade, nível WCAG e categoria de automação alinhados ao catálogo v1;
4. crie a tupla de tradução antes de ligar a regra à UI:
   - `src/i18n/rules-pt-BR.json` para nome, descrição, mensagens, sugestões e remediações;
   - `src/i18n/pt-BR.json` para textos de interface, estados, alertas e exportações;
5. use apenas chaves de catálogo no código, sem texto visível hardcoded;
6. se a regra exigir novos campos em `Violation`, atualize tipos, persistência, histórico, comparação e exportação;
7. revise a documentação impactada em `RULES_CODE_MAPPING.md`, `RULES_ANALYSIS.md`, `RULES_NORMATIVE_MATRIX.md`, `FUTURE_RULES_PLAN.md` e `../README.md`;
8. quando a matriz normativa mudar, abra ou referencie uma issue pública solicitando a atualização correspondente da Página do Projeto;
9. se a alteração mudar, remover ou criar uma função de verificação, inclua no PR o link da issue relacionada à atualização da página pública de regras;
10. valide a mudança com:

```bash
pnpm format:check
pnpm lint
pnpm verify:rules
pnpm type-check
pnpm test
pnpm build
```

## Modos e escopos

Toda regra deve declarar ou herdar um modo `automatic`, `assisted` ou `manual`. Regras de múltiplas páginas ou etapas devem usar o escopo `site` ou `journey`; não devem inferir esse contexto a partir de uma única página.

## Pull requests

Ao abrir um PR, descreva:

- o problema;
- a abordagem adotada;
- os riscos conhecidos;
- como validar a mudança;
- se houve impacto em regra, UI, persistência, exportação ou comparação de histórico.

Isso reduz retrabalho de revisão e torna a mudança mais fácil de manter.
