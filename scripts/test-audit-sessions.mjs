import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-sessions-'))
const sourcePath = path.resolve('src/utils/audit-sessions.ts')
const source = (await fs.readFile(sourcePath, 'utf8')).replace(
  "from '@/utils/extension-storage'",
  "from './extension-storage.mjs'",
)

await Promise.all([
  fs.writeFile(
    path.join(tempDir, 'audit-sessions.mjs'),
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: sourcePath,
    }).outputText,
    'utf8',
  ),
  fs.writeFile(
    path.join(tempDir, 'extension-storage.mjs'),
    'export async function extensionStorageGet() { return {} }\nexport async function extensionStorageSet() {}\n',
    'utf8',
  ),
])

try {
  const { buildJourneyReviewCandidates, buildSiteReviewCandidates } = await import(
    pathToFileURL(path.join(tempDir, 'audit-sessions.mjs')).href
  )
  const baseContext = {
    navigationSignatures: ['início|produtos|contato'],
    helpSignatures: ['ajuda'],
    locationMechanisms: ['navegação'],
    controlActions: [{ action: '/salvar', name: 'salvar' }],
    criticalActions: [],
    formFieldKeys: [],
    hasReviewCue: false,
  }
  const siteCandidates = buildSiteReviewCandidates([
    { url: 'https://example.com/a', auditedAt: 1, context: baseContext },
    {
      url: 'https://example.com/b',
      auditedAt: 2,
      context: {
        ...baseContext,
        navigationSignatures: ['início|contato|produtos'],
        helpSignatures: [],
        controlActions: [{ action: '/salvar', name: 'gravar' }],
      },
    },
  ])

  assert.deepEqual(
    new Set(siteCandidates.map((candidate) => candidate.nbrReference)),
    new Set(['5.7.13', '5.7.15', '5.7.16', '5.8.5']),
  )

  const journeyCandidates = buildJourneyReviewCandidates([
    {
      id: 'step-1',
      url: 'https://example.com/etapa-1',
      label: 'Dados',
      recordedAt: 1,
      evidenceSelectors: [],
      context: { ...baseContext, formFieldKeys: ['email:e-mail'] },
    },
    {
      id: 'step-2',
      url: 'https://example.com/etapa-2',
      label: 'Pagamento',
      recordedAt: 2,
      evidenceSelectors: [],
      context: {
        ...baseContext,
        criticalActions: ['pagar'],
        formFieldKeys: ['email:e-mail'],
      },
    },
  ])

  assert.deepEqual(
    new Set(journeyCandidates.map((candidate) => candidate.nbrReference)),
    new Set(['5.9.12', '5.9.15']),
  )
  console.log('Site and journey session checks passed.')
} finally {
  await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
}
