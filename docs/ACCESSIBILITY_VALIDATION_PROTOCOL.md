# Protocolo de validação da acessibilidade do Guardião

Este protocolo orienta a validação qualitativa da extensão e da Página do Projeto. Ele não substitui uma avaliação de conformidade e não autoriza generalizações sobre todas as pessoas com deficiência.

## Participantes e combinações

Conduzir ciclos com 6 a 8 profissionais com deficiência que já utilizem suas próprias tecnologias assistivas. O grupo deve incluir, sem tratar os perfis como equivalentes:

- pessoas usuárias de NVDA com Chrome;
- pessoas que utilizem ampliação e alto contraste ou cores forçadas no Windows;
- pessoas que naveguem apenas por teclado;
- sempre que possível, diferentes níveis de familiaridade com auditoria de acessibilidade.

Registrar somente as características necessárias para interpretar a sessão, com consentimento e sem dados pessoais desnecessários.

## Fluxos principais

Cada participante deve tentar, com o mínimo possível de orientação:

1. abrir o painel do Guardião e configurar o escopo da auditoria;
2. iniciar uma auditoria e compreender o estado de carregamento e a conclusão;
3. localizar um resultado, ler sua evidência e responder a uma pergunta de revisão;
4. adicionar ou editar uma anotação e retornar à lista;
5. abrir o histórico, comparar duas execuções e voltar ao resultado atual;
6. exportar um relatório e confirmar o retorno da operação;
7. abrir e fechar modais, drawers e painéis expansíveis;
8. acessar a Página do Projeto, a rastreabilidade, a explicação da nota e a declaração de acessibilidade.

## Verificações por sessão

- nome, papel, estado e valor dos controles são compreensíveis;
- a ordem de foco acompanha a tarefa e o foco permanece visível;
- abrir e fechar superfícies move e devolve o foco de forma previsível;
- mensagens de carregamento, sucesso e erro são percebidas sem interromper a tarefa;
- nenhum passo depende apenas de cor, hover ou posição visual;
- conteúdo permanece utilizável em zoom de 200% e 400%, reflow, cores forçadas e movimento reduzido;
- o vocabulário distingue conclusão automática, candidato assistido e roteiro manual.

## Registro de evidências

Para cada barreira, registrar:

| Campo      | Conteúdo esperado                                          |
| ---------- | ---------------------------------------------------------- |
| Sessão     | Identificador não pessoal                                  |
| Combinação | Navegador, tecnologia assistiva e configurações relevantes |
| Fluxo      | Tarefa em que a barreira ocorreu                           |
| Evidência  | O que aconteceu e o que era esperado                       |
| Impacto    | Bloqueio, dificuldade relevante ou inconveniência          |
| Frequência | Única, recorrente ou consistente                           |
| Correção   | Referência da alteração e situação da nova validação       |

Consolidar padrões entre sessões sem ocultar experiências divergentes. Os resultados publicados devem ser descritos como evidência qualitativa do grupo participante.

## Critérios de saída do marco

- nenhum problema crítico ou sério nas verificações automatizadas;
- todos os fluxos principais concluídos sem mouse;
- nenhum controle interativo sem nome, papel e estado programaticamente determináveis;
- auditoria, revisão, histórico, exportação e escopo concluídos com NVDA e Chrome;
- problemas encontrados por participantes corrigidos ou publicados como limitações conhecidas.

O marco só pode ser descrito como validado com usuários depois da execução documentada das sessões. Até lá, a declaração de acessibilidade deve informar que essa validação está pendente.
