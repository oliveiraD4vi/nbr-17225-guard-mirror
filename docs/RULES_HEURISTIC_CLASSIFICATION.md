# Classificação de Força Heurística

Este documento complementa o inventário ordenado de `RULES_CODE_MAPPING.md` e registra a leitura atual sobre a força heurística das regras implementadas.

Objetivo:

- manter um levantamento ordenado do escopo implementado;
- destacar quais heurísticas ainda têm sinal mais fraco;
- orientar futuras revisões de ruído, falso positivo e UX sem alterar o catálogo normativo.

## Escala Atual

- `Objetiva`: o motor consegue concluir a verificação com base em DOM, atributos, CSS ou metadados com baixo grau de ambiguidade.
- `Assistida consistente`: existe heurística com sinal útil e aproveitável, mas a conclusão normativa ainda depende de revisão humana ou contexto.
- `Assistida fraca`: a regra depende fortemente de contexto, fluxo entre páginas, intenção editorial, percepção humana ou variações amplas de implementação.
- `Manual`: o motor apenas registra candidatos; a conclusão é essencialmente humana.

## Inventário Ordenado do Escopo Implementado

O inventário completo das 146 regras implementadas permanece em `RULES_CODE_MAPPING.md`. A distribuição atual por seção é:

| Seção | Tema                             | Regras |
| ----- | -------------------------------- | -----: |
| 5.1   | Interação por teclado            |     16 |
| 5.2   | Imagens                          |      6 |
| 5.3   | Cabeçalhos                       |      5 |
| 5.4   | Regiões                          |      5 |
| 5.5   | Listas                           |      2 |
| 5.6   | Tabelas                          |      6 |
| 5.7   | Links e navegação                |     16 |
| 5.8   | Botões e controles               |     15 |
| 5.9   | Formulários e entrada de dados   |     18 |
| 5.10  | Apresentação                     |      5 |
| 5.11  | Uso de cores                     |      6 |
| 5.12  | Conteúdo textual                 |     13 |
| 5.13  | Codificação e marcação semântica |     13 |
| 5.14  | Áudio e vídeo                    |     10 |
| 5.15  | Animação                         |      4 |
| 5.16  | Tempo                            |      6 |

## Regras Atualmente Classificadas como Heurística Fraca

Lista em ordem normativa, apenas para priorização técnica. Isso não remove nenhuma regra do escopo; apenas sinaliza onde a heurística ainda depende de mais contexto ou endurecimento futuro.

| Regra   | Tema                                  | Motivo principal da fragilidade                                   | Código                                                                    |
| ------- | ------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 5.1.4   | Ordem de foco previsível              | depende de fluxo real de teclado e intenção de navegação          | `src/rules/keyboard-interaction.ts` `focusOrderRule`                      |
| 5.1.6   | Armadilha de foco                     | exige simulação confiável de interação e saída do contexto        | `src/rules/keyboard-interaction.ts` `focusTrapRule`                       |
| 5.1.8   | Conteúdo adicional persistente        | depende de comportamento dinâmico no hover/foco                   | `src/rules/keyboard-interaction.ts` `additionalContentPersistentRule`     |
| 5.1.9   | Conteúdo adicional dispensável        | depende de fechamento real por teclado e contexto visual          | `src/rules/keyboard-interaction.ts` `additionalContentDismissibleRule`    |
| 5.1.11  | Atalhos sem modificadora              | indício baseado em atributos e convenções, não em binding real    | `src/rules/keyboard-interaction.ts` `keyboardShortcutRule`                |
| 5.2.3   | Imagens decorativas                   | difícil distinguir função real vs. decoração apenas por DOM       | `src/rules/images.ts` `imageDecorativeRule`                               |
| 5.2.4   | Descrição para imagens complexas      | complexidade e suficiência descritiva dependem do conteúdo        | `src/rules/images.ts` `complexImageDescriptionRule`                       |
| 5.2.5   | Imagens de texto                      | depende de interpretação visual e semântica do ativo gráfico      | `src/rules/images.ts` `imageOfTextRule`                                   |
| 5.4.2   | Uso de regiões                        | exige julgamento editorial sobre estrutura informacional          | `src/rules/structural-navigation-controls.ts` `regionUsageRule`           |
| 5.5.2   | Uso de listas                         | depende de leitura semântica do conteúdo e da intenção editorial  | `src/rules/structural-navigation-controls.ts` `listUsageRule`             |
| 5.6.2   | Uso de tabelas                        | requer distinguir layout visual de estrutura tabular real         | `src/rules/structural-navigation-controls.ts` `tableUsageRule`            |
| 5.7.4   | Propósito do link no contexto         | contexto semântico do texto e da vizinhança varia muito           | `src/rules/structural-navigation-controls.ts` `linkPurposeRule`           |
| 5.7.15  | Navegação consistente                 | depende de comparação entre páginas e jornadas equivalentes       | `src/rules/structural-navigation-controls.ts` `navigationConsistencyRule` |
| 5.7.16  | Ajuda consistente                     | depende de recorrência entre telas, não de uma página isolada     | `src/rules/structural-navigation-controls.ts` `helpConsistencyRule`       |
| 5.8.5   | Identificação consistente             | depende de equivalência entre páginas e decisões de produto       | `src/rules/structural-navigation-controls.ts` `buttonConsistencyRule`     |
| 5.8.9   | Mudança de contexto no foco           | comportamento depende de script e fluxo interativo real           | `src/rules/structural-navigation-controls.ts` `contextChangeOnFocusRule`  |
| 5.8.10  | Mudança de contexto na entrada        | comportamento depende de script e fluxo interativo real           | `src/rules/structural-navigation-controls.ts` `contextChangeOnInputRule`  |
| 5.8.11  | Acionamento por ponteiro único        | difícil comprovar alternativa equivalente sem interação real      | `src/rules/structural-navigation-controls.ts` `singlePointerRule`         |
| 5.8.12  | Operação por gestos                   | gestos e alternativas não ficam totalmente explícitos no DOM      | `src/rules/structural-navigation-controls.ts` `pointerGestureRule`        |
| 5.8.13  | Movimento de arrastar                 | depende de comportamento gestual e alternativas disponíveis       | `src/rules/structural-navigation-controls.ts` `dragMovementRule`          |
| 5.8.14  | Operação por movimento                | depende de sensores/eventos e de alternativas de uso              | `src/rules/structural-navigation-controls.ts` `motionOperationRule`       |
| 5.9.12  | Prevenção de erro crítica             | suficiência da prevenção depende do risco real do formulário      | `src/rules/content-forms-media.ts` `criticalFormPreventionRule`           |
| 5.9.15  | Reentrada de dados                    | exige memória de fluxo, conta e jornada entre etapas              | `src/rules/content-forms-media.ts` `dataReentryRule`                      |
| 5.9.16  | Validação sensorial                   | depende de interpretação funcional do mecanismo de validação      | `src/rules/content-forms-media.ts` `sensoryValidationRule`                |
| 5.9.18  | Autenticação acessível mínima         | heurística baseada em indícios como captcha e integrações comuns  | `src/rules/forms.ts` `accessibleAuthenticationRule`                       |
| 5.10.1  | Características sensoriais            | linguagem natural e referência espacial variam bastante           | `src/rules/content-forms-media.ts` `sensoryCharacteristicsRule`           |
| 5.11.1  | Uso de cores                          | texto pode descrever cor sem realmente depender só dela           | `src/rules/content-forms-media.ts` `colorUsageRule`                       |
| 5.12.11 | Siglas e abreviaturas                 | nem toda sigla precisa expansão explícita no mesmo contexto       | `src/rules/text-content.ts` `abbreviationMeaningRule`                     |
| 5.13.9  | Propósito identificável               | a intenção do controle varia com o fluxo e o domínio da página    | `src/rules/semantics.ts` `identifiablePurposeRule`                        |
| 5.13.11 | Elementos nativos                     | exige julgamento sobre custo-benefício de abstrações customizadas | `src/rules/semantics.ts` `nativeElementsRule`                             |
| 5.13.12 | Semântica de componentes customizados | depende do contrato funcional do componente                       | `src/rules/content-forms-media.ts` `customComponentSemanticRule`          |
| 5.14.1  | Alternativa em texto para áudio       | presença e suficiência da alternativa dependem do conteúdo        | `src/rules/content-forms-media.ts` `audioTranscriptRule`                  |
| 5.14.2  | Legendas descritivas para vídeo       | depende de mídia, player e disponibilidade fora do DOM principal  | `src/rules/content-forms-media.ts` `videoCaptionsRule`                    |
| 5.14.3  | Transcrição para vídeo                | depende de mídia, player e disponibilidade fora do DOM principal  | `src/rules/content-forms-media.ts` `videoTranscriptRule`                  |
| 5.14.4  | Audiodescrição para vídeo             | depende de conteúdo audiovisual e recursos externos               | `src/rules/content-forms-media.ts` `audioDescriptionRule`                 |
| 5.14.9  | Legendas ao vivo                      | depende de transmissão, player e contexto operacional             | `src/rules/content-forms-media.ts` `liveCaptionsRule`                     |
| 5.15.1  | Controle de animação                  | requer observação temporal e resposta da interface                | `src/rules/content-forms-media.ts` `animationControlRule`                 |
| 5.16.1  | Limite de tempo                       | depende de fluxo, sessão e comportamento do servidor              | `src/rules/time.ts` `timeLimitRule`                                       |
| 5.16.2  | Limite de tempo ajustável             | depende de affordance real de extensão, pausa ou ajuste           | `src/rules/content-forms-media.ts` `adjustableTimeLimitRule`              |
| 5.16.3  | Controle de atualização               | atualização automática nem sempre é observável no estado estático | `src/rules/time.ts` `refreshControlRule`                                  |

## Observações Desta Revisão

- evidências, falsos positivos, falsos negativos e limites residuais das 40 heurísticas fracas estão registrados em `HEURISTIC_EVIDENCE_REGISTER.md`;

- `5.9.1` e `5.9.3` deixaram de denunciar exatamente o mesmo cenário: agora `5.9.1` cobre ausência de rótulo visível e `5.9.3` cobre ausência de associação programática quando já existe indício visual de rótulo.
- `5.13.6` deixou de repetir o mesmo sinal de `order` em CSS já tratado por `5.10.2`.
- Esta classificação é documental. A execução da Beta é controlada pelo estado `ready` ou `not_ready` definido em cada regra e documentado em `RULE_READINESS.md`.
