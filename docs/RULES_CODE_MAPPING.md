# Mapeamento de Regras ABNT NBR 17225

Este documento relaciona o catálogo v1 implementado com as rotinas em `src/rules`.

O escopo aqui documentado é a V1 Farol, com 112 itens revisados contra a referência pública da ABNT NBR 17225.

Legenda:

- `Implementada`: existe regra dedicada no motor com `nbrReference` próprio.
- `Heurística assistida`: existe verificação automática parcial, mas a conclusão normativa exige revisão humana.
- `Revisão manual`: o motor registra a regra e sinaliza candidatos, mas a decisão não é automatizável.

## Resumo

| Status                   |                   Quantidade |
| ------------------------ | ---------------------------: |
| Implementadas            |                          112 |
| Ausentes                 |                            0 |
| Requisitos normativos    |                           96 |
| Recomendações normativas |                           16 |
| Incorporadas na V1 Farol | 15 recomendações priorizadas |

A classificação normativa vem de `src/normative.ts`, construída a partir da própria ABNT NBR 17225. Ela não deve ser inferida por severidade (`error`/`warning`) nem por nível WCAG.

## Fora do Escopo da V1

Na confrontação com a referência pública da NBR 17225, foram identificadas 34 recomendações adicionais que não fazem parte da V1 Farol e, portanto, não têm implementação nesta versão.

Esses itens devem ser tratados como backlog para contribuições futuras, e não como falhas da cobertura declarada da V1. A lista completa está em `FUTURE_RULES_PLAN.md`.

## Mapeamento por Regra

| Regra                                                               | Automação            | Código                                                                 |
| ------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| 5.1.1 Indicador de foco visível                                     | Heurística assistida | `src/rules/keyboard-interaction.ts` `focusIndicatorRule`               |
| 5.1.2 Elemento em foco totalmente visível                           | Heurística assistida | `src/rules/keyboard-interaction.ts` `focusFullyVisibleRule`            |
| 5.1.3 Elemento em foco parcialmente visível                         | Heurística assistida | `src/rules/keyboard-interaction.ts` `focusPartiallyVisibleRule`        |
| 5.1.4 Ordem de foco previsível                                      | Heurística assistida | `src/rules/keyboard-interaction.ts` `focusOrderRule`                   |
| 5.1.6 Armadilha de foco                                             | Heurística assistida | `src/rules/keyboard-interaction.ts` `focusTrapRule`                    |
| 5.1.8 Conteúdo adicional persistente                                | Heurística assistida | `src/rules/keyboard-interaction.ts` `additionalContentPersistentRule`  |
| 5.1.9 Conteúdo adicional dispensável                                | Heurística assistida | `src/rules/keyboard-interaction.ts` `additionalContentDismissibleRule` |
| 5.1.11 Atalhos de teclado sem tecla modificadora                    | Heurística assistida | `src/rules/keyboard-interaction.ts` `keyboardShortcutRule`             |
| 5.1.13 Acessibilidade por teclado parcial                           | Implementada         | `src/rules/keyboard-interaction.ts` `keyboardAccessibilityRule`        |
| 5.1.16 Instruções para componentes customizados                     | Heurística assistida | `src/rules/keyboard-interaction.ts` `customComponentInstructionsRule`  |
| 5.2.1 Texto alternativo para imagens de conteúdo                    | Implementada         | `src/rules/images.ts` `imageAltTextRule`                               |
| 5.2.2 Texto alternativo para imagens funcionais                     | Implementada         | `src/rules/images.ts` `imageFunctionalAltRule`                         |
| 5.2.3 Texto alternativo para imagens decorativas                    | Heurística assistida | `src/rules/images.ts` `imageDecorativeRule`                            |
| 5.2.4 Descrição para imagens complexas                              | Heurística assistida | `src/rules/images.ts` `complexImageDescriptionRule`                    |
| 5.2.5 Imagens de texto                                              | Heurística assistida | `src/rules/images.ts` `imageOfTextRule`                                |
| 5.2.6 Texto alternativo para mapas de imagens                       | Implementada         | `src/rules/images.ts` `imageMapAltTextRule`                            |
| 5.3.1 Semântica de cabeçalho                                        | Implementada         | `src/rules/headings.ts` `headingSemanticRule`                          |
| 5.3.2 Uso de cabeçalhos                                             | Heurística assistida | `src/rules/headings.ts` `headingUsageRule`                             |
| 5.3.3 Cabeçalho principal                                           | Heurística assistida | `src/rules/headings.ts` `mainHeadingRecommendationRule`                |
| 5.3.5 Estrutura de cabeçalhos                                       | Implementada         | `src/rules/headings.ts` `headingStructureRule`                         |
| 5.4.1 Semântica de região                                           | Implementada         | `src/rules/regions.ts` `regionSemanticRule`                            |
| 5.4.2 Uso de regiões                                                | Heurística assistida | `src/rules/structural-navigation-controls.ts` `regionUsageRule`             |
| 5.4.3 Conteúdo em regiões                                           | Heurística assistida | `src/rules/regions.ts` `contentInRegionsRule`                          |
| 5.4.5 Regiões identificadas unicamente                              | Implementada         | `src/rules/regions.ts` `uniqueRegionIdentificationRule`                |
| 5.5.1 Semântica de lista                                            | Implementada         | `src/rules/lists.ts` `listSemanticRule`                                |
| 5.5.2 Uso de listas                                                 | Heurística assistida | `src/rules/structural-navigation-controls.ts` `listUsageRule`               |
| 5.6.1 Semântica de tabela                                           | Implementada         | `src/rules/tables.ts` `tableSemanticRule`                              |
| 5.6.2 Uso de tabelas                                                | Heurística assistida | `src/rules/structural-navigation-controls.ts` `tableUsageRule`              |
| 5.6.3 Cabeçalhos de tabela                                          | Implementada         | `src/rules/tables.ts` `tableHeadersRule`                               |
| 5.6.5 Título de tabela associado                                    | Implementada         | `src/rules/tables.ts` `tableCaptionRule`                               |
| 5.7.1 Semântica de link                                             | Implementada         | `src/rules/navigation.ts` `linkSemanticRule`                           |
| 5.7.2 Uso de links                                                  | Heurística assistida | `src/rules/structural-navigation-controls.ts` `linkUsageRule`               |
| 5.7.4 Propósito do link no contexto                                 | Heurística assistida | `src/rules/structural-navigation-controls.ts` `linkPurposeRule`             |
| 5.7.6 Links que abrem em uma nova guia ou janela                    | Heurística assistida | `src/rules/navigation.ts` `newWindowLinkRule`                          |
| 5.7.7 Links para arquivos não HTML                                  | Heurística assistida | `src/rules/navigation.ts` `nonHtmlFileLinkRule`                        |
| 5.7.8 Links para sites externos                                     | Heurística assistida | `src/rules/navigation.ts` `externalLinkRule`                           |
| 5.7.12 Links para contornar blocos de conteúdo                      | Implementada         | `src/rules/navigation.ts` `skipLinksRule`                              |
| 5.7.13 Alternativas para localização                                | Heurística assistida | `src/rules/navigation.ts` `locationAlternativesRule`                   |
| 5.7.15 Navegação consistente                                        | Heurística assistida | `src/rules/structural-navigation-controls.ts` `navigationConsistencyRule`   |
| 5.7.16 Ajuda consistente                                            | Heurística assistida | `src/rules/structural-navigation-controls.ts` `helpConsistencyRule`         |
| 5.8.1 Semântica de botão                                            | Implementada         | `src/rules/controls.ts` `buttonSemanticRule`                           |
| 5.8.2 Uso de botões                                                 | Heurística assistida | `src/rules/structural-navigation-controls.ts` `buttonUsageRule`             |
| 5.8.3 Propósito do botão                                            | Heurística assistida | `src/rules/structural-navigation-controls.ts` `buttonPurposeRule`           |
| 5.8.5 Identificação consistente em conjunto de páginas              | Heurística assistida | `src/rules/structural-navigation-controls.ts` `buttonConsistencyRule`       |
| 5.8.6 Área de acionamento aprimorada                                | Implementada         | `src/rules/controls.ts` `enhancedTargetSizeRule`                       |
| 5.8.7 Área de acionamento mínima                                    | Implementada         | `src/rules/controls.ts` `targetSizeRule`                               |
| 5.8.9 Mudança de contexto previsível no foco                        | Heurística assistida | `src/rules/structural-navigation-controls.ts` `contextChangeOnFocusRule`    |
| 5.8.10 Mudança de contexto previsível na entrada                    | Heurística assistida | `src/rules/structural-navigation-controls.ts` `contextChangeOnInputRule`    |
| 5.8.11 Acionamento por ponteiro único                               | Heurística assistida | `src/rules/structural-navigation-controls.ts` `singlePointerRule`           |
| 5.8.12 Operação por gestos de ponteiro                              | Heurística assistida | `src/rules/structural-navigation-controls.ts` `pointerGestureRule`          |
| 5.8.13 Operação por movimento de arrastar                           | Heurística assistida | `src/rules/structural-navigation-controls.ts` `dragMovementRule`            |
| 5.8.14 Operação por movimento                                       | Heurística assistida | `src/rules/structural-navigation-controls.ts` `motionOperationRule`         |
| 5.9.1 Rótulo de campo                                               | Implementada         | `src/rules/forms.ts` `fieldLabelRule`                                  |
| 5.9.2 Rótulo de campo previsível                                    | Heurística assistida | `src/rules/content-forms-media.ts` `predictableFieldLabelRule`   |
| 5.9.3 Rótulo de campo associado                                     | Implementada         | `src/rules/forms.ts` `associatedFieldLabelRule`                        |
| 5.9.4 Rótulo de campo descritivo                                    | Heurística assistida | `src/rules/content-forms-media.ts` `descriptiveFieldLabelRule`   |
| 5.9.5 Textos de ajuda previsíveis                                   | Heurística assistida | `src/rules/content-forms-media.ts` `predictableHelpTextRule`     |
| 5.9.6 Campos relacionados                                           | Implementada         | `src/rules/forms.ts` `relatedFieldsRule`                               |
| 5.9.7 Campos obrigatórios                                           | Implementada         | `src/rules/forms.ts` `requiredFieldsRule`                              |
| 5.9.8 Tipo de dado determinado                                      | Implementada         | `src/rules/forms.ts` `dataTypeRule`                                    |
| 5.9.9 Mensagem de erro descritiva                                   | Heurística assistida | `src/rules/content-forms-media.ts` `descriptiveErrorRule`        |
| 5.9.10 Sugestão de correção                                         | Heurística assistida | `src/rules/content-forms-media.ts` `correctionSuggestionRule`    |
| 5.9.12 Prevenção de erro para formulários críticos                  | Heurística assistida | `src/rules/content-forms-media.ts` `criticalFormPreventionRule`  |
| 5.9.13 Ajuda contextual                                             | Heurística assistida | `src/rules/forms.ts` `contextualHelpRule`                              |
| 5.9.14 Botão de submissão                                           | Heurística assistida | `src/rules/forms.ts` `submitButtonRule`                                |
| 5.9.15 Reentrada de dados                                           | Heurística assistida | `src/rules/content-forms-media.ts` `dataReentryRule`             |
| 5.9.16 Validação sensorial ou por movimento                         | Heurística assistida | `src/rules/content-forms-media.ts` `sensoryValidationRule`       |
| 5.9.18 Autenticação acessível mínima                                | Heurística assistida | `src/rules/forms.ts` `accessibleAuthenticationRule`                    |
| 5.10.1 Características sensoriais                                   | Heurística assistida | `src/rules/content-forms-media.ts` `sensoryCharacteristicsRule`  |
| 5.10.2 Ordem de apresentação                                        | Heurística assistida | `src/rules/content-forms-media.ts` `presentationOrderRule`       |
| 5.10.3 Orientação de exibição                                       | Implementada         | `src/rules/content-forms-media.ts` `orientationRule`             |
| 5.10.4 Design responsivo                                            | Implementada         | `src/rules/presentation.ts` `responsiveDesignRule`                     |
| 5.11.1 Uso de cores                                                 | Heurística assistida | `src/rules/content-forms-media.ts` `colorUsageRule`              |
| 5.11.2 Contraste para texto aprimorado                              | Implementada         | `src/rules/colors.ts` `enhancedTextContrastRule`                       |
| 5.11.3 Contraste para texto                                         | Implementada         | `src/rules/colors.ts` `textContrastRule`                               |
| 5.11.4 Contraste para componentes                                   | Implementada         | `src/rules/colors.ts` `componentContrastRule`                          |
| 5.11.5 Contraste para objetos gráficos                              | Implementada         | `src/rules/content-forms-media.ts` `graphicContrastRule`         |
| 5.11.6 Contraste para indicador de foco visual                      | Implementada         | `src/rules/content-forms-media.ts` `focusIndicatorContrastRule`  |
| 5.12.1 Espaçamento entre linhas                                     | Implementada         | `src/rules/content-forms-media.ts` `lineSpacingRule`             |
| 5.12.2 Espaçamento entre parágrafos                                 | Implementada         | `src/rules/content-forms-media.ts` `paragraphSpacingRule`        |
| 5.12.3 Espaçamento entre letras                                     | Implementada         | `src/rules/content-forms-media.ts` `letterSpacingRule`           |
| 5.12.4 Espaçamento entre palavras                                   | Implementada         | `src/rules/content-forms-media.ts` `wordSpacingRule`             |
| 5.12.5 Alinhamento de blocos de texto                               | Implementada         | `src/rules/text-content.ts` `textAlignmentRule`                        |
| 5.12.6 Largura de blocos de texto                                   | Implementada         | `src/rules/content-forms-media.ts` `textWidthRule`               |
| 5.12.7 Texto redimensionado                                         | Heurística assistida | `src/rules/content-forms-media.ts` `resizedTextRule`             |
| 5.12.8 Semântica de texto especial                                  | Implementada         | `src/rules/text-content.ts` `specialTextSemanticRule`                  |
| 5.12.9 Uso de texto especial                                        | Revisão manual       | `src/rules/text-content.ts` `specialTextUsageRule`                     |
| 5.12.11 Siglas e abreviaturas                                       | Heurística assistida | `src/rules/text-content.ts` `abbreviationMeaningRule`                  |
| 5.13.1 Título da página                                             | Implementada         | `src/rules/semantics.ts` `pageTitleRule`                               |
| 5.13.2 Idioma da página                                             | Implementada         | `src/rules/semantics.ts` `pageLanguageRule`                            |
| 5.13.3 Idioma das partes da página                                  | Implementada         | `src/rules/content-forms-media.ts` `pagePartLanguageRule`        |
| 5.13.4 Título de frame                                              | Implementada         | `src/rules/semantics.ts` `frameTitleRule`                              |
| 5.13.5 Zoom não bloqueado                                           | Implementada         | `src/rules/semantics.ts` `zoomAllowedRule`                             |
| 5.13.6 Ordem de leitura                                             | Heurística assistida | `src/rules/content-forms-media.ts` `readingOrderRule`            |
| 5.13.7 Texto visível no nome acessível                              | Heurística assistida | `src/rules/content-forms-media.ts` `visibleTextInNameRule`       |
| 5.13.8 Mensagens de status                                          | Implementada         | `src/rules/content-forms-media.ts` `statusMessageRule`           |
| 5.13.9 Propósito identificável                                      | Heurística assistida | `src/rules/semantics.ts` `identifiablePurposeRule`                     |
| 5.13.10 Componentes com nome acessível                              | Implementada         | `src/rules/semantics.ts` `accessibleNameRule`                          |
| 5.13.11 Elementos nativos                                           | Heurística assistida | `src/rules/semantics.ts` `nativeElementsRule`                          |
| 5.13.12 Semântica de componentes customizados                       | Heurística assistida | `src/rules/content-forms-media.ts` `customComponentSemanticRule` |
| 5.13.13 Estados, propriedades e valores de componentes customizados | Implementada         | `src/rules/semantics.ts` `customStateRule`                             |
| 5.14.1 Alternativa em texto para áudio                              | Heurística assistida | `src/rules/content-forms-media.ts` `audioTranscriptRule`         |
| 5.14.2 Legendas descritivas para vídeo                              | Heurística assistida | `src/rules/content-forms-media.ts` `videoCaptionsRule`           |
| 5.14.3 Transcrição para vídeo                                       | Heurística assistida | `src/rules/content-forms-media.ts` `videoTranscriptRule`         |
| 5.14.4 Audiodescrição para vídeo                                    | Heurística assistida | `src/rules/content-forms-media.ts` `audioDescriptionRule`        |
| 5.14.7 Controle de áudio                                            | Implementada         | `src/rules/media.ts` `audioControlRule`                                |
| 5.14.9 Legendas para áudio e vídeo ao vivo                          | Heurística assistida | `src/rules/content-forms-media.ts` `liveCaptionsRule`            |
| 5.15.1 Controle de animação                                         | Heurística assistida | `src/rules/content-forms-media.ts` `animationControlRule`        |
| 5.15.4 Flash intermitente limitado                                  | Implementada         | `src/rules/content-forms-media.ts` `flashingContentRule`         |
| 5.16.1 Limite de tempo                                              | Heurística assistida | `src/rules/time.ts` `timeLimitRule`                                    |
| 5.16.2 Limite de tempo ajustável                                    | Heurística assistida | `src/rules/content-forms-media.ts` `adjustableTimeLimitRule`     |
| 5.16.3 Controle de atualização                                      | Heurística assistida | `src/rules/time.ts` `refreshControlRule`                               |

## Funcionalidades Agregadas

| Funcionalidade                                  | Status       | Código                                                                      |
| ----------------------------------------------- | ------------ | --------------------------------------------------------------------------- |
| Destaque visual de problemas                    | Implementada | `src/content.ts`, `src/components/AuditWorkspaceApp.tsx`                    |
| Painel de detalhes e sugestões contextualizadas | Implementada | `src/components/ViolationsList.tsx`, `src/components/ViolationsSummary.tsx` |
| Simulação de visão                              | Implementada | `src/components/VisionSimulator.tsx`, `src/content.ts`                      |
| Exportação simplificada de relatórios           | Implementada | `src/components/AuditWorkspaceApp.tsx`, `src/report.tsx`                    |

## Verificação Individual

Execute:

```bash
pnpm verify:rules
```

Resultado esperado:

```text
Verificação de regras concluída: 112 itens documentados mapeados para 112 implementações: 96 requisitos e 16 recomendações.
```
