# Versionamento

O Guardião NBR 17225 usa versionamento semântico para a extensão e nomes curtos para marcos funcionais maiores.

## Versão Atual

Produto: `1.1.0-beta.4`
Manifest Chrome: `1.1.0`

| Versão         | Nome              | Escopo                                                                                                                 |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `1.1.0-beta.4` | V1.1 Bússola Beta | Nota por regra, números objetivos, triagem opcional, achados manuais, ações em massa e prévia temporária de contraste. |

Regra executada na Beta significa regra habilitada para avaliação assistida. Não significa regra final.

## Critérios

- `MAJOR`: mudança de escopo normativo, contratos de auditoria, formato de histórico ou experiência principal.
- `MINOR`: nova regra, novo relatório, novo filtro, melhoria de histórico ou funcionalidade complementar compatível.
- `PATCH`: correção de bug, ajuste visual, refinamento de texto, redução de falso positivo ou melhoria interna sem quebra de contrato.

Versões Beta usam o identificador `MAJOR.MINOR.PATCH-beta.N`. O número final identifica a rodada pública da Beta e cresce a cada novo pacote publicado. O campo `version` do manifesto permanece numérico, enquanto `version_name` preserva o identificador completo exibido ao usuário.

O processo de preparação, validação, criação de tags e publicação está em `RELEASES.md`.

## Tema dos Nomes

As versões seguem um tema de navegação, orientação e sinalização. Esse tema combina com a ideia de guardião porque comunica direção, vigilância, segurança e progressão contínua sem depender de propriedade intelectual de franquias.

Critérios para escolher nomes:

- o nome deve ser curto, memorável e fácil de escrever em PT-BR;
- o significado deve estar ligado a orientar, sinalizar, guiar, atravessar ou manter rota;
- o nome não deve depender de personagem, marca registrada ou universo ficcional específico;
- o nome precisa funcionar em documentação técnica e comunicação pública;
- nomes de versões principais devem transmitir um salto claro de maturidade.

## Padrão por Tipo de Versão

### Major

Use nomes fortes de referência e orientação. Eles indicam mudança relevante de escopo, contrato de auditoria ou posicionamento do produto.

Sugestões:

- V1 Farol: primeira versão estável, focada em iluminar problemas e organizar prioridade.
- V2 Polaris: evolução orientada por histórico, consistência entre execuções e direção clara de melhoria.
- V3 Astrolábio: expansão para análise mais rica, cruzamento de sinais e apoio avançado à decisão.
- V4 Cartógrafo: maturidade em mapas de cobertura, jornadas completas e visão de produto.
- V5 Horizonte: expansão para integrações, distribuição e visão mais ampla de acessibilidade contínua.

### Minor

Use nomes de instrumentos, sinais, rotas ou componentes de navegação. Eles representam entrega funcional compatível com a major atual.

Exemplos para a V1 Farol:

- V1.1 Bússola: refinamento de score, exportações e orientação de priorização.
- V1.2 Baliza: melhoria de alertas, tooltips, status visuais e trilhas de revisão.
- V1.3 Carta Náutica: documentação de regras, rastreabilidade pública e comparação entre auditorias.
- V1.4 Sextante: leitura mais precisa de heurísticas sensíveis e redução de ruído.
- V1.5 Porto Seguro: estabilidade, quota de armazenamento, recuperação e robustez operacional.

### Patch

Use nomes menores ligados a ajustes de rota, luz, marcação e manutenção. O nome pode aparecer apenas em changelog interno, sem destaque público obrigatório.

Exemplos:

- Feixe: ajuste visual ou correção pequena de UI.
- Lente: correção de legibilidade, contraste ou foco visual.
- Marco: correção de documentação, contagem ou rastreabilidade.
- Nó: correção pequena de persistência ou integração.
- Rumo: refinamento pontual de fluxo ou comportamento.

## Sugestões de Próximas Versões

### V1.1 Bússola

- nota geral com leitura mais clara da composição;
- exportação de resumo simples;
- correções visuais em tooltips e estados auxiliares;
- documentação do padrão de versões.

### V1.2 Baliza

- melhoria dos sinais visuais de revisão contextual;
- maior clareza de estados abertos, confirmados e ignorados;
- ajustes de acessibilidade da própria interface da extensão;
- microinterações para reduzir confusão em listas longas.

### V1.3 Carta Náutica

- documentação pública mais completa de regras e limites;
- links cruzados entre extensão, Página do Projeto, políticas e issues;
- orientação formal para atualizar a Página do Projeto quando regras mudarem;
- melhoria de navegação da página pública de regras.

### V1.4 Sextante

- revisão técnica de heurísticas sensíveis;
- redução de ruído sem ocultar problemas reais;
- análise de fontes de não determinismo;
- testes direcionados por regra.

### V2 Polaris

- marco futuro para uma versão com auditoria mais orientada por jornada;
- comparação mais avançada entre execuções;
- leitura longitudinal de progresso;
- integração mais forte entre histórico, revisão humana e relatórios.

## Sincronização com a Página do Projeto

Quando uma versão alterar regra, função de verificação, texto normativo resumido ou limite residual, a página pública de regras deve ser atualizada. O PR da extensão deve referenciar a issue pública que solicita a atualização da Página do Projeto.

## Referências Conceituais

O tema de navegação pode se inspirar em referências gerais de orientação:

- faróis como auxílio à navegação costeira;
- Polaris e estrelas polares como referência de direção;
- astrolábios e sextantes como instrumentos de observação e cálculo de posição;
- cartas náuticas, balizas e portos como elementos de rota, segurança e chegada.
