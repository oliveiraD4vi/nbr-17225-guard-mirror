# Padrão de commits

Este projeto usa Conventional Commits para manter o histórico legível, permitir automações e reduzir ambiguidade na revisão.

## Formato

```text
tipo(escopo opcional): descrição curta
```

Regras:

- Use letras minúsculas no tipo.
- Escreva a descrição em PT-BR, no presente ou imperativo, sem ponto final.
- Mantenha o cabeçalho com até 100 caracteres.
- Use corpo quando a motivação ou o impacto não couberem na descrição.
- Use rodapé para referências, issues e breaking changes.

## Tipos permitidos

- `feat`: nova funcionalidade.
- `fix`: correção de comportamento.
- `docs`: documentação.
- `refactor`: mudança interna sem alterar comportamento esperado.
- `test`: testes novos ou ajustes em testes.
- `chore`: manutenção sem impacto direto no produto.
- `build`: dependências, empacotamento ou configuração de build.
- `ci`: pipelines e automações de integração.
- `perf`: melhoria de desempenho.
- `style`: formatação ou estilo de código sem mudança lógica.
- `revert`: reversão de commit anterior.

## Exemplos

```text
feat(auditoria): permite ignorar qualquer violação
fix(contraste): preserva cor original ao redefinir proposta
docs(commits): documenta padrão de mensagens
ci(commitlint): valida commits em merge requests
refactor(nota): separa cálculo de requisitos e recomendações
test(historico): cobre comparação com mudança de escopo
```

## Breaking changes

Quando uma alteração exigir migração manual ou quebrar compatibilidade, marque no cabeçalho e detalhe no rodapé:

```text
feat(schema)!: versiona modelo de violações

BREAKING CHANGE: relatórios antigos precisam passar pela rotina de migração ao serem importados.
```

## Validação local

O hook `commit-msg` valida a mensagem no momento do commit. O hook `pre-push` valida todos os commits novos que serão enviados antes de rodar testes e build.

Comandos úteis:

```bash
node scripts/check-commits.mjs --edit .git/COMMIT_EDITMSG
pnpm commitlint:range -- --from origin/main --to HEAD
```
