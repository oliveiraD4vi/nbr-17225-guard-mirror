import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Catálogo v1 revisado contra a referência pública da ABNT NBR 17225.
// A verificação garante consistência entre esse catálogo e src/rules.
const requirements = [
  ['5.1.1', 'Indicador de foco visivel', 'AA', 'Semi-Automatizavel'],
  ['5.1.2', 'Elemento em foco totalmente visivel', 'AAA', 'Semi-Automatizavel'],
  ['5.1.3', 'Elemento em foco parcialmente visivel', 'A', 'Semi-Automatizavel'],
  ['5.1.4', 'Ordem de foco previsivel', 'A', 'Semi-Automatizavel'],
  ['5.1.6', 'Armadilha de foco', 'A', 'Semi-Automatizavel'],
  ['5.1.8', 'Conteudo adicional persistente', 'AA', 'Semi-Automatizavel'],
  ['5.1.9', 'Conteudo adicional dispensavel', 'AA', 'Semi-Automatizavel'],
  ['5.1.11', 'Atalhos de teclado sem tecla modificadora', 'A', 'Semi-Automatizavel'],
  ['5.1.13', 'Acessibilidade por teclado parcial', 'A', 'Totalmente Automatizavel'],
  ['5.1.16', 'Instrucoes para componentes customizados', 'A', 'Semi-Automatizavel'],
  ['5.2.1', 'Texto alternativo para imagens de conteudo', 'A', 'Totalmente Automatizavel'],
  ['5.2.2', 'Texto alternativo para imagens funcionais', 'A', 'Totalmente Automatizavel'],
  ['5.2.3', 'Texto alternativo para imagens decorativas', 'A', 'Semi-Automatizavel'],
  ['5.2.4', 'Descricao para imagens complexas', 'A', 'Semi-Automatizavel'],
  ['5.2.5', 'Imagens de texto', 'AA', 'Semi-Automatizavel'],
  ['5.2.6', 'Texto alternativo para mapas de imagens', 'A', 'Totalmente Automatizavel'],
  ['5.3.1', 'Semantica de cabecalho', 'A', 'Totalmente Automatizavel'],
  ['5.3.2', 'Uso de cabecalhos', 'A', 'Semi-Automatizavel'],
  ['5.3.3', 'Cabecalho principal', 'AAA', 'Semi-Automatizavel'],
  ['5.3.5', 'Estrutura de cabecalhos', 'A', 'Totalmente Automatizavel'],
  ['5.4.1', 'Semantica de regiao', 'A', 'Totalmente Automatizavel'],
  ['5.4.2', 'Uso de regioes', 'A', 'Semi-Automatizavel'],
  ['5.4.3', 'Conteudo em regioes', 'AAA', 'Semi-Automatizavel'],
  ['5.4.5', 'Regioes identificadas unicamente', 'A', 'Totalmente Automatizavel'],
  ['5.5.1', 'Semantica de lista', 'A', 'Totalmente Automatizavel'],
  ['5.5.2', 'Uso de listas', 'A', 'Semi-Automatizavel'],
  ['5.6.1', 'Semantica de tabela', 'A', 'Totalmente Automatizavel'],
  ['5.6.2', 'Uso de tabelas', 'A', 'Semi-Automatizavel'],
  ['5.6.3', 'Cabecalhos de tabela', 'A', 'Totalmente Automatizavel'],
  ['5.6.5', 'Titulo de tabela associado', 'A', 'Totalmente Automatizavel'],
  ['5.7.1', 'Semantica de link', 'A', 'Totalmente Automatizavel'],
  ['5.7.2', 'Uso de links', 'A', 'Semi-Automatizavel'],
  ['5.7.4', 'Proposito do link no contexto', 'A', 'Semi-Automatizavel'],
  ['5.7.6', 'Links que abrem em uma nova guia ou janela', 'AAA', 'Semi-Automatizavel'],
  ['5.7.7', 'Links para arquivos nao HTML', 'AAA', 'Semi-Automatizavel'],
  ['5.7.8', 'Links para sites externos', 'AAA', 'Semi-Automatizavel'],
  [
    '5.7.12',
    'Links para contornar blocos de conteudo em conjunto de paginas',
    'A',
    'Totalmente Automatizavel',
  ],
  ['5.7.13', 'Alternativas para localizacao', 'A', 'Semi-Automatizavel'],
  ['5.7.15', 'Navegacao consistente', 'AA', 'Semi-Automatizavel'],
  ['5.7.16', 'Ajuda consistente', 'A', 'Semi-Automatizavel'],
  ['5.8.1', 'Semantica de botao', 'A', 'Totalmente Automatizavel'],
  ['5.8.2', 'Uso de botoes', 'A', 'Semi-Automatizavel'],
  ['5.8.3', 'Proposito do botao', 'A', 'Semi-Automatizavel'],
  ['5.8.5', 'Identificacao consistente em conjunto de paginas', 'AA', 'Semi-Automatizavel'],
  ['5.8.6', 'Area de acionamento aprimorada', 'AAA', 'Totalmente Automatizavel'],
  ['5.8.7', 'Area de acionamento minima', 'AA', 'Totalmente Automatizavel'],
  ['5.8.9', 'Mudanca de contexto previsivel no foco', 'A', 'Semi-Automatizavel'],
  ['5.8.10', 'Mudanca de contexto previsivel na entrada', 'A', 'Semi-Automatizavel'],
  ['5.8.11', 'Acionamento por ponteiro unico', 'A', 'Semi-Automatizavel'],
  ['5.8.12', 'Operacao por gestos de ponteiro', 'A', 'Semi-Automatizavel'],
  ['5.8.13', 'Operacao por movimento de arrastar', 'AA', 'Semi-Automatizavel'],
  ['5.8.14', 'Operacao por movimento', 'A', 'Semi-Automatizavel'],
  ['5.9.1', 'Rotulo de campo', 'A', 'Totalmente Automatizavel'],
  ['5.9.2', 'Rotulo de campo previsivel', 'A', 'Semi-Automatizavel'],
  ['5.9.3', 'Rotulo de campo associado', 'A', 'Totalmente Automatizavel'],
  ['5.9.4', 'Rotulo de campo descritivo', 'A', 'Semi-Automatizavel'],
  ['5.9.5', 'Textos de ajuda previsiveis', 'A', 'Semi-Automatizavel'],
  ['5.9.6', 'Campos relacionados', 'A', 'Totalmente Automatizavel'],
  ['5.9.7', 'Campos obrigatorios', 'A', 'Totalmente Automatizavel'],
  ['5.9.8', 'Tipo de dado determinado', 'AA', 'Totalmente Automatizavel'],
  ['5.9.9', 'Mensagem de erro descritiva', 'A', 'Semi-Automatizavel'],
  ['5.9.10', 'Sugestao de correcao', 'AA', 'Semi-Automatizavel'],
  ['5.9.12', 'Prevencao de erro para formularios criticos', 'AA', 'Semi-Automatizavel'],
  ['5.9.13', 'Ajuda contextual', 'AAA', 'Semi-Automatizavel'],
  ['5.9.14', 'Botao de submissao', 'AAA', 'Semi-Automatizavel'],
  ['5.9.15', 'Reentrada de dados', 'A', 'Semi-Automatizavel'],
  ['5.9.16', 'Validacao sensorial ou por movimento', 'A', 'Semi-Automatizavel'],
  ['5.9.18', 'Autenticacao acessivel minima', 'AA', 'Semi-Automatizavel'],
  ['5.10.1', 'Caracteristicas sensoriais', 'A', 'Semi-Automatizavel'],
  ['5.10.2', 'Ordem de apresentacao', 'A', 'Semi-Automatizavel'],
  ['5.10.3', 'Orientacao de exibicao', 'AA', 'Totalmente Automatizavel'],
  ['5.10.4', 'Design responsivo', 'AA', 'Totalmente Automatizavel'],
  ['5.11.1', 'Uso de cores', 'A', 'Semi-Automatizavel'],
  ['5.11.2', 'Contraste para texto aprimorado', 'AAA', 'Totalmente Automatizavel'],
  ['5.11.3', 'Contraste para texto minimo', 'AA', 'Totalmente Automatizavel'],
  ['5.11.4', 'Contraste para componentes', 'AA', 'Totalmente Automatizavel'],
  ['5.11.5', 'Contraste para objetos graficos', 'AA', 'Totalmente Automatizavel'],
  ['5.11.6', 'Contraste para indicador de foco visual', 'AA', 'Totalmente Automatizavel'],
  ['5.12.1', 'Espacamento entre as linhas', 'AA', 'Totalmente Automatizavel'],
  ['5.12.2', 'Espacamento entre os paragrafos', 'AA', 'Totalmente Automatizavel'],
  ['5.12.3', 'Espacamento entre as letras', 'AA', 'Totalmente Automatizavel'],
  ['5.12.4', 'Espacamento entre as palavras', 'AA', 'Totalmente Automatizavel'],
  ['5.12.5', 'Alinhamento de blocos de texto', 'AAA', 'Totalmente Automatizavel'],
  ['5.12.6', 'Largura de blocos de texto', 'AA', 'Totalmente Automatizavel'],
  ['5.12.7', 'Texto redimensionado', 'AA', 'Semi-Automatizavel'],
  ['5.12.8', 'Semantica de texto especial', 'A', 'Totalmente Automatizavel'],
  ['5.12.9', 'Uso de texto especial', 'A', 'Nao Automatizavel'],
  ['5.12.11', 'Siglas e abreviaturas', 'AAA', 'Semi-Automatizavel'],
  ['5.13.1', 'Titulo da pagina', 'A', 'Totalmente Automatizavel'],
  ['5.13.2', 'Idioma da pagina', 'A', 'Totalmente Automatizavel'],
  ['5.13.3', 'Idioma das partes da pagina', 'AA', 'Totalmente Automatizavel'],
  ['5.13.4', 'Titulo do frame', 'A', 'Totalmente Automatizavel'],
  ['5.13.5', 'Zoom nao bloqueado', 'AA', 'Totalmente Automatizavel'],
  ['5.13.6', 'Ordem de leitura', 'A', 'Semi-Automatizavel'],
  ['5.13.7', 'Texto visivel no nome acessivel', 'A', 'Semi-Automatizavel'],
  ['5.13.8', 'Mensagens de status', 'AA', 'Totalmente Automatizavel'],
  ['5.13.9', 'Proposito identificavel', 'AAA', 'Semi-Automatizavel'],
  ['5.13.10', 'Componentes com nome acessivel', 'A', 'Totalmente Automatizavel'],
  ['5.13.11', 'Elementos nativos', 'AAA', 'Semi-Automatizavel'],
  ['5.13.12', 'Semantica de componentes customizados', 'A', 'Semi-Automatizavel'],
  [
    '5.13.13',
    'Estados, propriedades e valores de componentes customizados',
    'A',
    'Totalmente Automatizavel',
  ],
  ['5.14.1', 'Alternativa em texto para audio', 'A', 'Semi-Automatizavel'],
  ['5.14.2', 'Legendas descritivas para video', 'A', 'Semi-Automatizavel'],
  ['5.14.3', 'Transcricao para video', 'AAA', 'Semi-Automatizavel'],
  ['5.14.4', 'Audiodescricao para video', 'A', 'Semi-Automatizavel'],
  ['5.14.7', 'Controle de audio', 'A', 'Totalmente Automatizavel'],
  ['5.14.9', 'Legendas para audio e video ao vivo', 'AA', 'Semi-Automatizavel'],
  ['5.15.1', 'Controle de animacao', 'A', 'Semi-Automatizavel'],
  ['5.15.4', 'Flash intermitente limitado', 'A', 'Totalmente Automatizavel'],
  ['5.16.1', 'Limite de tempo', 'AAA', 'Semi-Automatizavel'],
  ['5.16.2', 'Limite de tempo ajustavel', 'A', 'Semi-Automatizavel'],
  ['5.16.3', 'Controle de atualizacao', 'A', 'Semi-Automatizavel'],
  ['5.1.5', 'Uso de foco', 'AA', 'Nao Automatizavel'],
  ['5.1.7', 'Conteudo adicional', 'AA', 'Semi-Automatizavel'],
  ['5.1.10', 'Atalhos de teclado', 'A', 'Semi-Automatizavel'],
  ['5.1.12', 'Acessibilidade por teclado total', 'AAA', 'Nao Automatizavel'],
  ['5.1.14', 'Mecanismos de entrada simultaneos', 'AAA', 'Nao Automatizavel'],
  ['5.1.15', 'Comportamento de componentes customizados', 'A', 'Nao Automatizavel'],
  ['5.3.4', 'Secoes com cabecalhos', 'AAA', 'Semi-Automatizavel'],
  ['5.4.4', 'Regioes unicas', 'AAA', 'Semi-Automatizavel'],
  ['5.6.4', 'Titulo de tabela', 'AA', 'Semi-Automatizavel'],
  ['5.6.6', 'Descricao para tabelas complexas', 'AAA', 'Semi-Automatizavel'],
  ['5.7.3', 'Proposito do link sem contexto', 'AAA', 'Semi-Automatizavel'],
  ['5.7.5', 'Links com identificacao consistente', 'AA', 'Nao Automatizavel'],
  ['5.7.9', 'Texto complementar do link', 'AAA', 'Semi-Automatizavel'],
  ['5.7.10', 'Links adjacentes', 'AAA', 'Semi-Automatizavel'],
  ['5.7.11', 'Links para contornar blocos de conteudo', 'A', 'Semi-Automatizavel'],
  ['5.7.14', 'Localizacao em conjunto de paginas', 'AA', 'Nao Automatizavel'],
  ['5.8.4', 'Identificacao consistente na pagina', 'AA', 'Semi-Automatizavel'],
  ['5.8.8', 'Mudanca de contexto previsivel', 'AAA', 'Nao Automatizavel'],
  ['5.8.15', 'Controles com retorno', 'AA', 'Nao Automatizavel'],
  ['5.9.11', 'Prevencao de erro', 'AAA', 'Nao Automatizavel'],
  ['5.9.17', 'Autenticacao acessivel aprimorada', 'AAA', 'Nao Automatizavel'],
  ['5.10.5', 'Area do indicador de foco visivel', 'AAA', 'Nao Automatizavel'],
  ['5.12.10', 'Definicoes de significado', 'AAA', 'Nao Automatizavel'],
  ['5.12.12', 'Nivel de linguagem', 'AAA', 'Nao Automatizavel'],
  ['5.12.13', 'Pronuncia identificada', 'AAA', 'Nao Automatizavel'],
  ['5.14.5', 'Audiodescricao estendida para video', 'AAA', 'Nao Automatizavel'],
  ['5.14.6', 'Janela de Libras para conteudo em audio', 'AAA', 'Nao Automatizavel'],
  ['5.14.8', 'Audio sem ruido', 'AAA', 'Nao Automatizavel'],
  ['5.14.10', 'Transcricao para audio ao vivo', 'AAA', 'Nao Automatizavel'],
  ['5.15.2', 'Animacoes acionadas por interacao', 'AAA', 'Semi-Automatizavel'],
  ['5.15.3', 'Flash intermitente', 'AAA', 'Nao Automatizavel'],
  ['5.16.4', 'Interrupcoes', 'AAA', 'Nao Automatizavel'],
  ['5.16.5', 'Reautenticacao', 'AAA', 'Nao Automatizavel'],
  ['5.16.6', 'Tempo de inatividade', 'AAA', 'Nao Automatizavel'],
].map(([reference, name, wcagLevel, category]) => ({ reference, name, wcagLevel, category }))

const normalize = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')

const rulesDir = join(process.cwd(), 'src', 'rules')
const normativeSource = readFileSync(join(process.cwd(), 'src', 'normative.ts'), 'utf8')
const ruleFiles = readdirSync(rulesDir).filter(
  (file) => file.endsWith('.ts') && file !== 'index.ts',
)
const source = ruleFiles.map((file) => ({
  file,
  content: readFileSync(join(rulesDir, file), 'utf8'),
}))
const rules = []

const getNormativeType = (reference) =>
  normativeSource.includes(`'${reference}'`) ? 'Recomendação' : 'Requisito'

for (const { file, content } of source) {
  const blocks = content.matchAll(
    /export const\s+(\w+):\s*Rule\s*=\s*{([\s\S]*?)(?=\nexport const\s+\w+:\s*Rule\s*=|\nexport const\s+\w+Rules\s*:|\n$)/g,
  )
  for (const match of blocks) {
    const [, exportName, body] = match
    const get = (key) => body.match(new RegExp(`${key}:\\s*'([^']+)'`))?.[1]
    const id = get('id')
    const reference = get('nbrReference')
    const name = get('name')
    const wcagLevel = get('wcagLevel')
    const category = get('category')
    const readiness = get('readiness') || 'ready'
    const hasReadinessReason = /\breadinessReason\s*:/.test(body)
    rules.push({
      exportName,
      file,
      id,
      reference,
      name,
      wcagLevel,
      category: normalize(category || ''),
      readiness,
      hasReadinessReason,
    })
  }
}

const byReference = new Map()
for (const rule of rules) {
  if (!rule.reference) continue
  if (!byReference.has(rule.reference)) byReference.set(rule.reference, [])
  byReference.get(rule.reference).push(rule)
}

const failures = []

for (const requirement of requirements) {
  const matches = byReference.get(requirement.reference) || []
  if (!matches.length) {
    failures.push(`MISSING ${requirement.reference} ${requirement.name}`)
    continue
  }

  for (const rule of matches) {
    if (rule.wcagLevel !== requirement.wcagLevel) {
      failures.push(
        `WCAG ${requirement.reference} expected ${requirement.wcagLevel}, got ${rule.wcagLevel} in ${rule.file}:${rule.exportName}`,
      )
    }
    if (rule.category !== requirement.category) {
      failures.push(
        `CATEGORY ${requirement.reference} expected ${requirement.category}, got ${rule.category} in ${rule.file}:${rule.exportName}`,
      )
    }
  }
}

for (const rule of rules) {
  if (!requirements.some((requirement) => requirement.reference === rule.reference)) {
    failures.push(`EXTRA ${rule.reference || '<none>'} ${rule.file}:${rule.exportName}`)
  }
  if (!['ready', 'not_ready'].includes(rule.readiness)) {
    failures.push(
      `READINESS ${rule.reference || '<none>'} has invalid readiness "${rule.readiness}" in ${rule.file}:${rule.exportName}`,
    )
  }
  if (rule.readiness === 'not_ready' && !rule.hasReadinessReason) {
    failures.push(
      `READINESS ${rule.reference || '<none>'} is not_ready without readinessReason in ${rule.file}:${rule.exportName}`,
    )
  }
}

for (const [reference, matches] of byReference.entries()) {
  if (matches.length > 1) {
    failures.push(
      `DUPLICATE ${reference} ${matches.map((rule) => `${rule.file}:${rule.exportName}`).join(', ')}`,
    )
  }
}

if (failures.length) {
  console.error(`Rule verification failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const normativeTypeCounts = requirements.reduce(
  (acc, requirement) => {
    acc[getNormativeType(requirement.reference)] += 1
    return acc
  },
  { Requisito: 0, Recomendação: 0 },
)
const recommendationLabel =
  normativeTypeCounts.Recomendação === 1 ? 'recomendação' : 'recomendações'

const readinessCounts = rules.reduce(
  (acc, rule) => {
    acc[rule.readiness] += 1
    return acc
  },
  { ready: 0, not_ready: 0 },
)

console.log(
  `Regras em execução experimental na Beta: ${readinessCounts.ready}; fora da execução da Beta: ${readinessCounts.not_ready}.`,
)

console.log(
  `Verificação de regras concluída: ${requirements.length} itens documentados mapeados para ${rules.length} implementação(ões): ${normativeTypeCounts.Requisito} requisitos e ${normativeTypeCounts.Recomendação} ${recommendationLabel}.`,
)
