import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const files = [
  'src/components/AuditWorkspaceApp.tsx',
  'src/components/ViolationsList.tsx',
  'src/components/VisionSimulator.tsx',
]

const sources = await Promise.all(
  files.map(async (file) => ({
    file,
    source: await readFile(resolve(root, file), 'utf8'),
  })),
)

const failures = []

for (const { file, source } of sources) {
  const emptyIconButtons = source.matchAll(
    /<Button(?<props>[\s\S]*?icon=\{[\s\S]*?\})(?:\s*\/?>|[\s\S]*?<\/Button>)/g,
  )

  for (const match of emptyIconButtons) {
    const markup = match[0]
    const isSelfClosing = markup.trimEnd().endsWith('/>')
    const hasEmptyBody = /<Button[\s\S]*?>\s*<\/Button>/.test(markup)
    if ((isSelfClosing || hasEmptyBody) && !/aria-label=/.test(markup)) {
      const line = source.slice(0, match.index).split('\n').length
      failures.push(`${file}:${line} botão somente com ícone sem aria-label`)
    }
  }
}

const theme = await readFile(resolve(root, 'src/styles/theme.css'), 'utf8')
if (!theme.includes('@media (prefers-reduced-motion: reduce)')) {
  failures.push('src/styles/theme.css não respeita prefers-reduced-motion')
}
if (!theme.includes('@media (forced-colors: active)')) {
  failures.push('src/styles/theme.css não possui suporte explícito a forced-colors')
}

const workspace = sources.find(({ file }) => file.endsWith('AuditWorkspaceApp.tsx'))?.source ?? ''
if (!workspace.includes('useAccessibleMessage')) {
  failures.push('AuditWorkspaceApp não possui anunciador acessível para mensagens de estado')
}

if (failures.length > 0) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Accessible UI source checks passed.')
