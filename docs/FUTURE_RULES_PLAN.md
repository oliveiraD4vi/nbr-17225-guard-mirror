# Plano para Recomendações Futuras Fora da V1

Este documento lista as recomendações da ABNT NBR 17225:2025 que ainda não fazem parte da V1 Farol do Guardião NBR 17225.

A V1 Farol possui 112 regras documentadas e implementadas no catálogo: todos os 96 requisitos normativos identificados na referência pública e 16 recomendações priorizadas por relevância operacional, baixo risco de ruído e possibilidade de verificação assistida. A Beta executa apenas as regras habilitadas no motor.

Fontes usadas para esta lista:

- cópia pública da ABNT NBR 17225:2025 hospedada pela Câmara dos Deputados;
- matriz local `RULES_NORMATIVE_MATRIX.md`;
- catálogo validado por `pnpm verify:rules`.

## Resumo

| Grupo                                 | Quantidade |
| ------------------------------------- | ---------: |
| Requisitos obrigatórios pendentes     |          0 |
| Recomendações implementadas na V1     |         16 |
| Recomendações ainda não implementadas |         34 |
| Total fora do escopo implementado     |         34 |

## Recomendações incorporadas na V1 Farol

Além de `5.1.2 Elemento em foco totalmente visível`, a V1 Farol incorpora 15 recomendações adicionais:

- `5.3.3` — Cabeçalho principal;
- `5.4.3` — Conteúdo em regiões;
- `5.7.6` — Links que abrem em uma nova guia ou janela;
- `5.7.7` — Links para arquivos não HTML;
- `5.7.8` — Links para sites externos;
- `5.8.6` — Área de acionamento aprimorada;
- `5.9.13` — Ajuda contextual;
- `5.9.14` — Botão de submissão;
- `5.11.2` — Contraste para texto aprimorado;
- `5.12.5` — Alinhamento de blocos de texto;
- `5.12.11` — Siglas e abreviaturas;
- `5.13.9` — Propósito identificável;
- `5.13.11` — Elementos nativos;
- `5.14.3` — Transcrição para vídeo;
- `5.16.1` — Limite de tempo.

Essas recomendações entram apenas quando o usuário ativa o escopo `Requisitos e recomendações`, preservando a auditoria padrão focada em requisitos.

## Recomendações ainda não implementadas

### Interação por teclado

- `5.1.5` — Uso de foco
- `5.1.7` — Conteúdo adicional
- `5.1.10` — Atalhos de teclado
- `5.1.12` — Acessibilidade por teclado total
- `5.1.14` — Mecanismos de entrada simultâneos
- `5.1.15` — Comportamento de componentes customizados

Direção técnica:

- priorizar recomendações que possam ser analisadas por DOM e ARIA;
- manter como confirmação humana quando depender de interação real, ordem dinâmica ou comportamento customizado.

### Cabeçalhos

- `5.3.4` — Seções com cabeçalhos

Direção técnica:

- reaproveitar a base das regras de cabeçalho;
- diferenciar ausência estrutural objetiva de julgamento editorial.

### Regiões

- `5.4.4` — Regiões únicas

Direção técnica:

- validar landmarks duplicados e nomes acessíveis conflitantes;
- evitar exigir landmarks em páginas pequenas sem estrutura complexa.

### Tabelas

- `5.6.4` — Título de tabela
- `5.6.6` — Descrição para tabelas complexas

Direção técnica:

- detectar tabelas com sinais de complexidade;
- separar ausência estrutural de título/descrição da qualidade textual do conteúdo.

### Links e navegação

- `5.7.3` — Propósito do link sem contexto
- `5.7.5` — Links com identificação consistente
- `5.7.9` — Texto complementar do link
- `5.7.10` — Links adjacentes
- `5.7.11` — Links para contornar blocos de conteúdo
- `5.7.14` — Localização em conjunto de páginas

Direção técnica:

- dividir as recomendações entre verificações estruturais objetivas e verificações dependentes de conjunto de páginas;
- evitar duplicidade com os requisitos já implementados de propósito, skip link e localização.

### Botões e controles

- `5.8.4` — Identificação consistente na página
- `5.8.8` — Mudança de contexto previsível
- `5.8.15` — Controles com retorno

Direção técnica:

- reaproveitar a identidade de controles já usada na V1;
- exigir confirmação humana para retorno visual, sonoro ou háptico de controles.

### Formulários e entrada de dados

- `5.9.11` — Prevenção de erro
- `5.9.17` — Autenticação acessível aprimorada

Direção técnica:

- validar padrões estruturais de revisão, confirmação e ajuda;
- manter autenticação aprimorada como revisão humana assistida.

### Apresentação

- `5.10.5` — Área do indicador de foco visível

Direção técnica:

- usar medição geométrica do indicador quando possível;
- manter confirmação humana quando o estado de foco depender de interação real.

### Conteúdo textual

- `5.12.10` — Definições de significado
- `5.12.12` — Nível de linguagem
- `5.12.13` — Pronúncia identificada

Direção técnica:

- tratar significado, linguagem e pronúncia como revisão humana, com heurísticas conservadoras;
- evitar análise semântica agressiva que gere excesso de falso positivo.

### Áudio e vídeo

- `5.14.5` — Audiodescrição estendida para vídeo
- `5.14.6` — Janela de Libras para conteúdo em áudio
- `5.14.8` — Áudio sem ruído
- `5.14.10` — Transcrição para áudio ao vivo

Direção técnica:

- detectar presença estrutural de trilhas, links e descrições;
- manter qualidade, sincronização e suficiência como confirmação humana.

### Animação

- `5.15.2` — Animações acionadas por interação
- `5.15.3` — Flash intermitente

Direção técnica:

- aproveitar inspeção de CSS animations e mídia;
- evitar prometer medição completa de luminância sem análise visual dedicada.

### Tempo

- `5.16.4` — Interrupções
- `5.16.5` — Reautenticação
- `5.16.6` — Tempo de inatividade

Direção técnica:

- detectar sessão expirada, padrões de interrupção e fluxos de reautenticação;
- manter como revisão humana quando depender de fluxo autenticado ou evento em tempo real.

## Critérios de priorização

1. Implementar recomendações com baixa ambiguidade estrutural e baixo risco de duplicidade com requisitos.
2. Avançar em recomendações que dependem de contexto de página atual, mantendo revisão humana explícita.
3. Tratar por último recomendações que exigem conjunto de páginas, fluxo autenticado, mídia ou julgamento humano forte.

## Critérios para aceitar novas regras

- cada regra deve ter entrada no catálogo i18n;
- a implementação deve declarar claramente se a violação é automática ou exige revisão contextual;
- regras com heurística frágil devem preferir poucas violações de alta confiança;
- a matriz normativa e a página pública de rastreabilidade devem ser atualizadas no mesmo lote;
- `pnpm verify:rules`, `pnpm type-check`, `pnpm test` e `pnpm build` devem passar.
