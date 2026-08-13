# Processo de execução das regras na Beta

Este documento define como uma regra do catálogo v1 entra ou sai da execução da Beta.
O catálogo completo fica documentado. A auditoria roda apenas regras habilitadas para avaliação assistida.

## Estado definido para a Beta atual

A versão atual tem 146 regras documentadas. Todas estão habilitadas, mas regras de site e jornada só são executadas no contexto compatível. Regras manuais apresentam roteiro de revisão e não emitem conclusão automática.

## Estados

- `ready`: regra executada pela auditoria Beta e considerada na nota.
- `not_ready`: regra documentada, mas fora da execução e fora da nota da Beta.

Quando o campo `readiness` não aparece na definição da regra, o estado operacional é `ready`.
Toda regra `not_ready` deve ter `readinessReason`.

## Critério para entrar na execução da Beta

Uma regra só deve entrar na execução da Beta quando atender a todos os pontos abaixo:

- possui sinal técnico observável no DOM, CSS, ARIA, metadados ou contexto visível;
- tem falso positivo conhecido corrigido ou tratado como revisão humana;
- apresenta mensagem, sugestão e remediação acionáveis;
- foi validada em pelo menos um cenário positivo e um negativo;
- foi testada em `/`, `/rules.html` e `/privacy.html` da Page;
- não depende de consistência entre páginas, a menos que o motor compare páginas de fato.

## Incluir uma regra na execução

1. Ajustar a heurística ou a implementação da regra.
2. Rodar auditorias nas três páginas da Page: `/`, `/rules.html` e `/privacy.html`.
3. Registrar neste documento:
   - regra e referência NBR;
   - data;
   - páginas testadas;
   - falso positivo corrigido;
   - limite residual;
   - decisão.
4. Remover `readiness: 'not_ready'` e `readinessReason` da regra.
5. Rodar `verify-rules`, `type-check`, `lint`, testes e `build`.

## Retirar uma regra da execução

Uma regra deve ser rebaixada quando gerar falso positivo grave, inferir intenção demais ou depender de contexto que o motor ainda não observa.
Nesse caso, marque `readiness: 'not_ready'` imediatamente e registre uma razão curta em `readinessReason`.

## Regras antes fora da execução

As oito regras abaixo foram ativadas com escopo explícito. Elas não são avaliadas como se dependessem apenas da página atual.

| Regra                        | Referência | Motivo resumido               |
| ---------------------------- | ---------- | ----------------------------- |
| `special-text-usage`         | 5.12.9     | Manual, escopo de página.     |
| `custom-component-semantics` | 5.13.12    | Manual, escopo de página.     |
| `navigation-consistency`     | 5.7.15     | Assistida, escopo de site.    |
| `help-consistency`           | 5.7.16     | Assistida, escopo de site.    |
| `button-consistency`         | 5.8.5      | Assistida, escopo de site.    |
| `location-alternatives`      | 5.7.13     | Assistida, escopo de site.    |
| `critical-form-prevention`   | 5.9.12     | Assistida, escopo de jornada. |
| `data-reentry`               | 5.9.15     | Assistida, escopo de jornada. |
