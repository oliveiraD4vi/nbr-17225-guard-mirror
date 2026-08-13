# Registro de incorporação das recomendações

Este documento preserva a rastreabilidade das 34 recomendações que antes estavam fora do catálogo operacional. Todas foram incorporadas ao motor. A incorporação não significa automação integral: cada item declara um modo `automatic`, `assisted` ou `manual` e um escopo `page`, `site` ou `journey`.

## Estado atual

| Grupo                                           | Quantidade |
| ----------------------------------------------- | ---------: |
| Requisitos normativos                           |         96 |
| Recomendações já presentes no catálogo anterior |         16 |
| Recomendações incorporadas neste lote           |         34 |
| Total operacional                               |        146 |

## Lotes incorporados

### Estrutura e semântica

`5.3.4`, `5.4.4`, `5.6.4`, `5.6.6`, `5.7.3`, `5.7.9`, `5.7.10`, `5.7.11` e `5.8.4` usam sinais estruturais conservadores. Quando o sinal não sustenta uma conclusão, o resultado é um candidato assistido.

### Interação na página

`5.1.5`, `5.1.7`, `5.1.10`, `5.1.12`, `5.1.14`, `5.1.15`, `5.8.8`, `5.8.15`, `5.10.5`, `5.15.2` e `5.15.3` registram sinais observáveis e perguntas de revisão. Testes de comportamento, foco, entrada simultânea, retorno, animação e flash continuam humanos.

### Site e jornada

`5.7.5` e `5.7.14` só entram no escopo de site. `5.9.11`, `5.9.17`, `5.16.4`, `5.16.5` e `5.16.6` só entram no escopo de jornada. O Guardião registra páginas e etapas, mas não submete operações da página automaticamente.

### Conteúdo e mídia

`5.12.10`, `5.12.12`, `5.12.13`, `5.14.5`, `5.14.6`, `5.14.8` e `5.14.10` são roteiros manuais apoiados por evidência inicial. Qualidade editorial, pronúncia, equivalência, Libras, ruído, audiodescrição e transmissão ao vivo não são inferidos pelo DOM.

## Critérios permanentes

- cada regra possui fixture positiva, negativa e limítrofe no catálogo de testes;
- cada resultado preserva confiança, evidência e pergunta de revisão;
- candidatos pendentes não são apresentados como falhas confirmadas;
- rastreabilidade pública e matriz normativa são atualizadas no mesmo lote;
- quantidade de regras não é usada como evidência isolada de maturidade ou certificação.
