# Análise das Regras da ABNT NBR 17225

Esta análise consolida o catálogo v1 implementado e compara a cobertura com os módulos em `src/rules`.

O catálogo implementado atual contém 112 itens revisados contra a referência pública da ABNT NBR 17225.

## Resumo Atual

| Situação                          | Quantidade | Observação                                                                               |
| --------------------------------- | ---------: | ---------------------------------------------------------------------------------------- |
| Itens documentados                |        112 | V1 Farol com todos os requisitos e 16 recomendações incorporadas ao motor                |
| Regras com implementação no motor |        112 | Todas possuem `nbrReference` dedicado em `src/rules`                                     |
| Regras ausentes                   |          0 | Nenhuma pendência após esta atualização                                                  |
| Requisitos normativos             |         96 | Classificação extraída da ABNT NBR 17225, sem inferir por nível WCAG ou severidade       |
| Recomendações normativas          |         16 | Recomendações de maior valor operacional para a V1                                       |
| Totalmente automatizáveis         |         46 | Verificadas por DOM/CSS/metadados de forma objetiva                                      |
| Semi-automatizáveis               |         65 | Implementadas como heurísticas assistidas e exigem revisão humana em parte do julgamento |
| Não automatizáveis                |          1 | `5.12.9 Uso de texto especial`, registrado como revisão manual                           |

Duas entradas já estiveram declaradas no mapeamento sem regra própria no código:

- `5.9.3 Rótulo de campo associado`
- `5.12.9 Uso de texto especial`

Essas entradas agora possuem regras dedicadas e são verificadas pelo script `pnpm verify:rules`. O mesmo vale para `5.1.16`, `5.2.6`, `5.7.13` e para as 15 recomendações priorizadas para a V1 Farol.

## Cobertura por Seção

| Seção | Tema                             | Documentadas | Implementadas | Ausentes |
| ----- | -------------------------------- | -----------: | ------------: | -------: |
| 5.1   | Interação por teclado            |           10 |            10 |        0 |
| 5.2   | Imagens                          |            6 |             6 |        0 |
| 5.3   | Cabeçalhos                       |            4 |             4 |        0 |
| 5.4   | Regiões                          |            4 |             4 |        0 |
| 5.5   | Listas                           |            2 |             2 |        0 |
| 5.6   | Tabelas                          |            4 |             4 |        0 |
| 5.7   | Links e navegação                |           10 |            10 |        0 |
| 5.8   | Botões e controles               |           12 |            12 |        0 |
| 5.9   | Formulários e entrada de dados   |           16 |            16 |        0 |
| 5.10  | Apresentação                     |            4 |             4 |        0 |
| 5.11  | Uso de cores                     |            6 |             6 |        0 |
| 5.12  | Conteúdo textual                 |           10 |            10 |        0 |
| 5.13  | Codificação e marcação semântica |           13 |            13 |        0 |
| 5.14  | Áudio e vídeo                    |            6 |             6 |        0 |
| 5.15  | Animação                         |            2 |             2 |        0 |
| 5.16  | Tempo                            |            3 |             3 |        0 |

## Escopo Implementado e Limite Normativo

O escopo implementado atual é a V1 Farol, com 112 itens validados por `pnpm verify:rules`. A classificação normativa `Requisito` ou `Recomendação` é extraída da própria ABNT NBR 17225 e mantida em `src/normative.ts`; ela não é inferida por `wcagLevel`, `severity` nem por documentação local. Fontes públicas da NBR 17225 expõem 34 recomendações adicionais fora desse recorte. Elas não entram nesta versão, mas estão organizadas como plano de expansão futura.

Para o confronto formal regra a regra com a referência normativa pública, consulte `RULES_NORMATIVE_MATRIX.md`.

Para a lista completa dos itens fora do escopo v1 e a estratégia de implementação futura, consulte `FUTURE_RULES_PLAN.md`.

## Regras Totalmente Automatizáveis

As regras totalmente automatizáveis no catálogo v1 possuem verificação automática no motor. As implementações mais frágeis foram tornadas mais conservadoras para reduzir falso positivo e instabilidade entre execuções, especialmente em regras dependentes de foco, orientação, contraste, idioma e animação.

Quando uma regra catalogada como automatizável só consegue observar indícios, o item específico pode ser enviado para revisão contextual. Isso preserva o catálogo v1 sem apresentar heurísticas frágeis como conclusões definitivas.

5.1.13, 5.2.1, 5.2.2, 5.2.6, 5.3.1, 5.3.5, 5.4.1, 5.4.5, 5.5.1, 5.6.1, 5.6.3, 5.6.5, 5.7.1, 5.7.12, 5.8.1, 5.8.6, 5.8.7, 5.9.1, 5.9.3, 5.9.6, 5.9.7, 5.9.8, 5.10.3, 5.10.4, 5.11.2, 5.11.3, 5.11.4, 5.11.5, 5.11.6, 5.12.1, 5.12.2, 5.12.3, 5.12.4, 5.12.5, 5.12.6, 5.12.8, 5.13.1, 5.13.2, 5.13.3, 5.13.4, 5.13.5, 5.13.8, 5.13.10, 5.13.13, 5.14.7, 5.15.4.

## Regras Semi-Automatizáveis

As regras semi-automatizáveis possuem heurísticas para encontrar indícios de problema, mas o julgamento final depende de contexto visual, fluxo de interação, consistência entre páginas ou equivalência do conteúdo.

5.1.1, 5.1.2, 5.1.3, 5.1.4, 5.1.6, 5.1.8, 5.1.9, 5.1.11, 5.1.16, 5.2.3, 5.2.4, 5.2.5, 5.3.2, 5.3.3, 5.4.2, 5.4.3, 5.5.2, 5.6.2, 5.7.2, 5.7.4, 5.7.6, 5.7.7, 5.7.8, 5.7.13, 5.7.15, 5.7.16, 5.8.2, 5.8.3, 5.8.5, 5.8.9, 5.8.10, 5.8.11, 5.8.12, 5.8.13, 5.8.14, 5.9.2, 5.9.4, 5.9.5, 5.9.9, 5.9.10, 5.9.12, 5.9.13, 5.9.14, 5.9.15, 5.9.16, 5.9.18, 5.10.1, 5.10.2, 5.11.1, 5.12.7, 5.12.11, 5.13.6, 5.13.7, 5.13.9, 5.13.11, 5.13.12, 5.14.1, 5.14.2, 5.14.3, 5.14.4, 5.14.9, 5.15.1, 5.16.1, 5.16.2, 5.16.3.

Nesta revisão, duas sobreposições de ruído foram tratadas explicitamente:

- `5.9.1` passou a focar a presença de rótulo visível, enquanto `5.9.3` ficou restrita à associação programática quando já existe indício visual de rótulo;
- `5.13.6` deixou de repetir o mesmo sinal de `order` em CSS já coberto por `5.10.2`.

Para a classificação ordenada das heurísticas mais frágeis e a priorização futura de endurecimento, consulte `RULES_HEURISTIC_CLASSIFICATION.md`.

## Regra Não Automatizável

`5.12.9 Uso de texto especial` exige avaliação semântica do conteúdo textual. O motor registra a regra e sinaliza candidatos à revisão manual quando encontra texto especial.

## Funcionalidades Agregadas

As funcionalidades agregadas do produto já estão cobertas e distribuídas na documentação deste diretório:

| Funcionalidade                                  | Status       | Implementação                                                                |
| ----------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| Destaque visual de problemas                    | Implementada | `src/content.ts` e painel DevTools                                           |
| Painel de detalhes e sugestões contextualizadas | Implementada | `src/components/ViolationsList.tsx` e `src/components/ViolationsSummary.tsx` |
| Simulação de visão                              | Implementada | `src/components/VisionSimulator.tsx` e filtros injetados pelo content script |
| Exportação simplificada de relatórios           | Implementada | JSON, CSV e página de relatório                                              |

## Verificação

Execute:

```bash
pnpm verify:rules
```

O script valida individualmente cada requisito documentado contra o código:

- existência de uma regra com o mesmo `nbrReference`;
- nível WCAG igual ao documento;
- categoria de automação igual ao documento;
- ausência de referências duplicadas;
- ausência de regras extras não documentadas.

Observação: o script valida contra o catálogo implementado atual, não contra uma leitura dinâmica do arquivo em tempo de execução.
