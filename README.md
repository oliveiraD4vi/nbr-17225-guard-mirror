# Guardião NBR 17225

Verificador de acessibilidade para navegadores Chromium, alinhado à V1 Farol Beta do catálogo documental da ABNT NBR 17225:2025.

## Visão geral

O Guardião NBR 17225 executa auditorias diretamente na página inspecionada e organiza as violações com referência normativa, severidade, contexto do elemento afetado, triagem opcional e histórico local por URL.

## Principais capacidades

### Auditoria e diagnóstico

- cobertura de 112 regras revisadas contra a referência pública da ABNT NBR 17225: 96 requisitos normativos e 16 recomendações normativas;
- execução por aba, com suporte a páginas HTTP, HTTPS e arquivos locais com permissão;
- auditoria por escopo:
  - somente requisitos;
  - requisitos e recomendações;
- destaque visual dos itens na página, limpeza de destaques e navegação por prioridades;
- grupos de violações por regra, severidade e categoria natural do motor, como `cores`, `formulários`, `cabeçalhos` e `teclado`;
- filtro por categoria na listagem de violações;
- leitura curta mais clara nos cards de violação, com resumo orientado por família de regra antes do detalhe técnico;
- link de regra por violação, abrindo a explicação completa e a rastreabilidade na Página do Projeto;
- explicação pública por regra, ajudando a entender expectativa normativa, sinal verificado, limite residual e foco de revisão;
- board auxiliar para regras de contraste, com ajuste em tempo real, pré-visualização temporária na página auditada e restauração exata dos estilos originais;
- criação de violações manuais a partir da seleção de um elemento na página, vinculadas a uma regra da NBR;
- ações em massa para ignorar ocorrências semelhantes e reaplicar propostas de contraste compatíveis.

### Triagem de violações

- origem explícita para violações automáticas e manuais;
- estados persistidos por item: aberto, confirmado ou ignorado;
- possibilidade de ignorar qualquer violação, sem transformar confirmação manual em etapa obrigatória;
- motivo obrigatório ao ignorar, com nota complementar opcional;
- violações ignoradas permanecem no histórico, nas comparações e nas exportações, mas ficam fora da nota e dos números acionáveis;
- drawer de itens ignorados, acessível pelo filtro de violações e com ação para reabrir;
- anotações por item e decisões de triagem reaproveitadas entre auditorias equivalentes.

### Histórico e comparação

- histórico compacto de auditorias por URL;
- herança de decisões de triagem, anotações, correções de contraste e propostas de texto alternativo entre auditorias equivalentes;
- exclusão de entradas do histórico com confirmação explícita no painel DevTools;
- comparação entre auditorias salvas, com indicadores de evolução, regressão e estabilidade;
- comparação detalhada por escopo comum, separando novas violações, itens não detectados novamente, persistências e decisões de triagem;
- ignorar ou reabrir uma violação não é tratado como melhoria ou regressão técnica;
- importação de relatórios JSON exportados pela própria extensão para retomar a análise em outro navegador ou computador;
- exportação da auditoria em JSON e CSV;
- exportação de comparações em Markdown, JSON e CSV.

### Textos alternativos

- leitura comparativa do texto alternativo atual em violações de imagem e mapa de imagem;
- identificação da origem do texto atual, como `alt`, `aria-label`, `aria-labelledby`, `title`, nome acessível ou ausência de texto;
- proposta editável de texto alternativo, preservada no histórico, na comparação, no relatório e na exportação JSON;
- a proposta é registro de auditoria e não altera o DOM nem o código-fonte da página.

### Apoio à decisão

- nota geral baseada em regras com falha, com peso 2 para erros e peso 1 para avisos;
- cada regra penaliza a nota no máximo uma vez, independentemente do número de ocorrências semelhantes;
- requisitos representam 100% da nota no escopo padrão e 90% quando recomendações são incluídas;
- painel objetivo com violações acionáveis, tipos de problema, regras obrigatórias com falha, ignorados e volume total de ocorrências;
- controles de escopo com linguagem orientada à ação, deixando explícito o que será incluído ou removido da leitura atual;
- feedback visual para a nota, com leitura rápida de risco;
- contadores acionáveis que excluem violações ignoradas sem apagar seu registro;
- relatório detalhado em página dedicada, com snapshot imprimível da auditoria visualizada;
- painel do Chrome DevTools como superfície principal para auditar e revisar a página inspecionada;
- popup enxuto com orientação de acesso ao DevTools e atalho para o relatório da auditoria atual;
- exportação de resumo simples da auditoria diretamente pela aba de resumo.

### Simulador de percepção visual

- simulação de:
  - protanopia;
  - deuteranopia;
  - tritanopia;
  - desfoque;
- aplicação direta sobre a página auditada;
- uso complementar ao motor de regras, para inspeção visual assistida;
- filtros apresentados como apoio técnico, sem alegar que reproduzem integralmente a experiência de uma pessoa com deficiência.

### Governança técnica

- verificação automática de cobertura entre catálogo documentado, requisitos incorporados e regras implementadas;
- matriz normativa formal em `docs/RULES_NORMATIVE_MATRIX.md`;
- plano de expansão futura em `docs/FUTURE_RULES_PLAN.md`, com as 34 recomendações ainda não implementadas listadas individualmente;
- centralização de textos visíveis em catálogo de i18n PT-BR UTF-8;
- tema centralizado em variáveis CSS, compartilhado entre popup, relatório, painel DevTools e superfícies do Ant Design;
- resolução correta dos tokens do Ant Design a partir das variáveis CSS, preservando consistência visual em CTAs, tags, modais, drawers, tooltips e popovers.

### Resiliência de armazenamento

- acesso ao armazenamento mediado pelo service worker quando a API não está exposta diretamente no painel DevTools;
- tratamento orientado para `QuotaExceeded` no `chrome.storage.local`;
- persistência enxuta do histórico, removendo dados derivados e reconstruindo agrupamentos na leitura sem descartar decisões de triagem, anotações ou correções de contraste;
- aviso preventivo quando o armazenamento local se aproxima do limite, com leitura de uso atual, ação de compactação e orientação sobre retenção local;
- importação de relatórios como caminho de continuidade quando o armazenamento local não for suficiente para reter todo o histórico indefinidamente;
- opções de recuperação no painel DevTools:
  - limpar o histórico da URL atual;
  - excluir a auditoria mais antiga;
  - compactar o armazenamento;
  - manter a auditoria somente em memória até a próxima recarga.

## Definição da Beta

Produto: `1.1.3-beta.7`
Manifest Chrome: `1.1.3`
Nome: **V1 Farol Beta**

Escopo da Beta:

- 112 regras documentadas;
- 104 regras executadas na auditoria Beta;
- 8 regras documentadas, fora da execução e fora da nota;
- escopo padrão com requisitos; recomendações entram por opção do usuário;
- histórico local por página normalizada, preservando o caminho da URL e ignorando query string e hash;
- explicações completas na Página do Projeto, principalmente em `/rules.html` e `/score.html`.

## Cobertura de regras

O escopo documentado atual contém a V1 Farol, com 112 regras revisadas contra a referência pública da ABNT NBR 17225. Na Beta, uma regra executada significa regra habilitada para avaliação assistida; não significa regra final.

| Situação                               | Quantidade |
| -------------------------------------- | ---------: |
| Itens documentados                     |        112 |
| Regras implementadas no motor          |        112 |
| Regras executadas na Beta              |        104 |
| Regras fora da execução da Beta        |          8 |
| Regras ausentes                        |          0 |
| Requisitos normativos implementados    |         96 |
| Recomendações normativas implementadas |         16 |
| Totalmente automatizáveis              |         46 |
| Semi-automatizáveis                    |         65 |
| Não automatizáveis                     |          1 |

Importante:

- `pnpm verify:rules` valida o motor contra o catálogo implementado atual;
- regras fora da execução da Beta continuam documentadas, mas não entram na execução nem na nota;
- a classificação `Requisito` ou `Recomendação` segue a própria ABNT NBR 17225, não o nível WCAG nem a severidade técnica da violação;
- recomendações fora do catálogo implementado seguem registradas como backlog público, sem aumentar o ruído da auditoria padrão.

Consulte também:

- [docs/README.md](docs/README.md)
- [RULES_ANALYSIS.md](docs/RULES_ANALYSIS.md)
- [RULES_HEURISTIC_CLASSIFICATION.md](docs/RULES_HEURISTIC_CLASSIFICATION.md)
- [RULES_CODE_MAPPING.md](docs/RULES_CODE_MAPPING.md)
- [RULES_NORMATIVE_MATRIX.md](docs/RULES_NORMATIVE_MATRIX.md)
- [FUTURE_RULES_PLAN.md](docs/FUTURE_RULES_PLAN.md)
- [VERSIONING.md](docs/VERSIONING.md)
- [RELEASES.md](docs/RELEASES.md)

## Rastreabilidade pública

A Página do Projeto possui uma página dedicada de rastreabilidade em `/rules.html`. Ela apresenta, para cada uma das 112 regras implementadas:

- referência da ABNT NBR 17225;
- recorte normativo interpretativo com referência à fonte pública;
- função implementada na extensão;
- trecho de código da regra;
- link para o arquivo no repositório público;
- classificação de automação;
- limite residual da verificação.

Essa página usa a matriz `docs/RULES_NORMATIVE_MATRIX.md` como fonte e não substitui a leitura da norma.

## Fluxo recomendado de uso

### 1. Rodar a auditoria de requisitos

Comece com o escopo padrão `Somente requisitos`. Isso reduz ruído inicial e ajuda a priorizar não conformidades diretas.

Abra o Chrome DevTools e use o painel `Guardião NBR 17225`. A auditoria, a triagem, o histórico e as propostas de correção ficam nessa superfície, junto da página inspecionada. O popup orienta esse acesso e permite abrir o relatório da auditoria atual.

### 2. Revisar a aba de violações

Use:

- os grupos por regra;
- o filtro por categoria;
- a navegação por itens prioritários;
- os resumos curtos dos cards para leitura rápida da violação;
- o link da regra para abrir a explicação completa, os limites e a rastreabilidade em `https://guardiaonbr.com.br/rules.html`;
- a board de contraste, quando aplicável;
- a seção de texto alternativo nas violações de imagem, quando aplicável.

### 3. Registrar decisões de triagem

Quando uma violação não se aplicar ao contexto, use `Ignorar violação`, informe o motivo e acrescente uma observação quando necessário. Não é preciso confirmar cada item para que ele conte como falha: violações abertas já entram nos números acionáveis, enquanto as ignoradas permanecem documentadas e podem ser reabertas.

### 4. Incluir recomendações

Ative o escopo `Requisitos e recomendações` quando a base obrigatória já estiver compreendida. O Guardião amplia a auditoria atual sem criar um novo histórico só por causa dessa troca de escopo.

### 5. Exportar ou importar contexto quando necessário

Use `Abrir relatório` para gerar uma nova aba com snapshot da auditoria visualizada, adequada para leitura e impressão. Quando a auditoria precisar continuar em outro ambiente, exporte o relatório em JSON e depois use a importação pela aba de histórico ou pela tela inicial. Se a URL importada for a mesma da aba atual, o relatório volta pronto para comparação.

Se o painel DevTools avisar que o armazenamento local está em atenção, compacte o histórico e exporte os relatórios que precisarem de retenção de longo prazo.

### 6. Usar o simulador de percepção visual

O simulador de percepção visual deve entrar como validação complementar, não como substituto da auditoria automática nem como reprodução completa da experiência de pessoas com deficiência. Um fluxo profissional de uso é:

1. rodar a auditoria de requisitos;
2. revisar violações de contraste, foco, componentes e leitura;
3. ativar o simulador de percepção visual;
4. inspecionar visualmente:
   - contraste textual;
   - contraste de componentes;
   - diferenciação visual de estados;
   - foco visível;
   - legibilidade de blocos críticos;
5. registrar observações nas anotações dos itens;
6. reexecutar a auditoria após ajustes.

Na prática, o simulador é mais útil em três momentos:

- validação complementar de regras de cor e contraste;
- revisão de áreas densas ou críticas da interface;
- checagem final antes de comparar auditorias no histórico.

## Verificação

Para validar o mapeamento de regras contra o catálogo documental:

```bash
pnpm verify:rules
```

O script verifica:

- existência de regra para cada `nbrReference` do catálogo v1;
- consistência de nível WCAG;
- consistência de categoria de automação;
- duplicidade de referências;
- presença de regras fora do catálogo adotado.

## Escopo da ABNT NBR 17225 x escopo implementado

A norma possui recomendações adicionais fora do escopo implementado aqui. Elas não serão adicionadas à V1 Farol, mas estão registradas como backlog para futuras contribuições em `docs/FUTURE_RULES_PLAN.md`.

## Origem, abertura e governança pública

O Guardião NBR 17225 nasceu como projeto acadêmico e mantém a extensão como software open-source hoje e sempre.

- Repositório principal da extensão: <https://github.com/oliveiraD4vi/nbr-17225-guard>
- Issues públicas: <https://github.com/oliveiraD4vi/nbr-17225-guard/issues>
- Domínio: `guardiaonbr.com.br`
- Página do Projeto: `https://guardiaonbr.com.br`
- Página pública de regras: `https://guardiaonbr.com.br/rules.html`
- Explicação da nota: `https://guardiaonbr.com.br/score.html`
- Política de privacidade: `https://guardiaonbr.com.br/privacy.html`

A Página do Projeto é a vitrine oficial do projeto e não faz parte do código open-source da extensão. Bugs, pedidos de ajuste visual, problemas de conteúdo e solicitações de atualização da página de regras devem ser abertos como issue no GitHub público da extensão.

Quando um PR alterar, remover ou criar uma função de verificação de regra, o PR deve referenciar a issue que solicita a atualização correspondente na Página do Projeto. A alteração da Página do Projeto é mantida separadamente.

## Versionamento

Produto: `1.1.3-beta.7`
Manifest Chrome: `1.1.3`
Nome: **V1 Farol Beta**

A política de nomes e evolução está documentada em `docs/VERSIONING.md`.

## Instalação

Pré-requisitos:

- Node.js 16+
- pnpm
- Chrome, Edge ou outro navegador Chromium compatível com Manifest V3

Instalação:

```bash
pnpm install
pnpm build
```

Depois, carregue a pasta `dist/` em `chrome://extensions/` usando `Carregar extensão não empacotada`.

## Scripts

```bash
pnpm dev
pnpm build
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm stage-lint
pnpm type-check
pnpm verify:rules
pnpm test:audit-history
pnpm test:audit-history-utils
pnpm test
```

## Automação local de Git

Após `pnpm install`, o Husky passa a controlar os hooks locais do repositório.

- `pre-commit`:
  - roda `pnpm stage-lint` para aplicar `prettier` e `eslint --fix` apenas nos arquivos staged.
- `pre-push`:
  - roda `pnpm test`;
  - roda `pnpm build`.

## Estrutura

```text
nbr-17225-guard/
|-- docs/                         # Documentação de regras, governança, versão e requisitos-fonte
|-- scripts/                      # Verificações de cobertura e utilitários
|-- src/
|   |-- components/               # Popup, relatório, histórico e simulador
|   |-- i18n/                     # Catálogos PT-BR UTF-8
|   |-- rules/                    # Regras do motor de auditoria
|   |-- styles/                   # Tema centralizado e estilos da interface
|   |-- utils/                    # Persistência, histórico, comparação e exportação
|-- public/                       # Manifesto e bootstrap do content script
```
