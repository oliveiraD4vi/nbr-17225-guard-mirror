import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadAuditEngineModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-import-'))
  const engineSourcePath = path.resolve('src/utils/audit-engine.ts')
  const historySourcePath = path.resolve('src/utils/audit-history.ts')
  const triageSourcePath = path.resolve('src/utils/audit-triage.ts')
  const normativeSourcePath = path.resolve('src/normative.ts')
  const extensionStorageSourcePath = path.resolve('src/utils/extension-storage.ts')
  const extensionRuntimeSourcePath = path.resolve('src/utils/extension-runtime.ts')

  const engineSource = (await fs.readFile(engineSourcePath, 'utf8'))
    .replace("from '@/i18n'", "from './i18n.mjs'")
    .replace("from '@/normative'", "from './normative.mjs'")
    .replace("from '@/utils/audit-score'", "from './audit-score.mjs'")
    .replace("from '@/utils/audit-history'", "from './audit-history.mjs'")
    .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'")
    .replace("from '@/utils/audit-sessions'", "from './audit-sessions.mjs'")
    .replace("from '@/utils/extension-storage'", "from './extension-storage.mjs'")
  const historySource = (await fs.readFile(historySourcePath, 'utf8'))
    .replace("from '@/normative'", "from './normative.mjs'")
    .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'")
  const triageSource = await fs.readFile(triageSourcePath, 'utf8')
  const normativeSource = await fs.readFile(normativeSourcePath, 'utf8')
  const extensionStorageSource = (await fs.readFile(extensionStorageSourcePath, 'utf8')).replace(
    "from './extension-runtime'",
    "from './extension-runtime.mjs'",
  )
  const extensionRuntimeSource = await fs.readFile(extensionRuntimeSourcePath, 'utf8')
  const i18nSource = `
export function t(key) {
  const messages = {
    'engine.invalidImportReport': 'Relatório inválido para importação',
    'engine.quotaExceeded': 'Quota exceeded',
  }

  return messages[key] ?? key
}
`
  const auditScoreSource = `
export function getAuditScoreData(result) {
  return {
    conservativeScore: result.scoreRange?.conservative ?? 100,
    confirmedScore: result.scoreRange?.confirmed ?? 100,
  }
}
`
  const auditSessionsSource = `
export async function recordJourneyAuditStep() { return undefined }
export async function recordSiteAuditPage() { return undefined }
`

  const transpileOptions = {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }

  const transpiledEngine = ts.transpileModule(engineSource, {
    ...transpileOptions,
    fileName: engineSourcePath,
  }).outputText
  const transpiledHistory = ts.transpileModule(historySource, {
    ...transpileOptions,
    fileName: historySourcePath,
  }).outputText
  const transpiledTriage = ts.transpileModule(triageSource, {
    ...transpileOptions,
    fileName: triageSourcePath,
  }).outputText
  const transpiledNormative = ts.transpileModule(normativeSource, {
    ...transpileOptions,
    fileName: normativeSourcePath,
  }).outputText
  const transpiledExtensionStorage = ts.transpileModule(extensionStorageSource, {
    ...transpileOptions,
    fileName: extensionStorageSourcePath,
  }).outputText
  const transpiledExtensionRuntime = ts.transpileModule(extensionRuntimeSource, {
    ...transpileOptions,
    fileName: extensionRuntimeSourcePath,
  }).outputText

  const engineFile = path.join(tempDir, 'audit-engine.mjs')
  const historyFile = path.join(tempDir, 'audit-history.mjs')
  const triageFile = path.join(tempDir, 'audit-triage.mjs')
  const normativeFile = path.join(tempDir, 'normative.mjs')
  const i18nFile = path.join(tempDir, 'i18n.mjs')
  const extensionStorageFile = path.join(tempDir, 'extension-storage.mjs')
  const extensionRuntimeFile = path.join(tempDir, 'extension-runtime.mjs')
  const auditScoreFile = path.join(tempDir, 'audit-score.mjs')
  const auditSessionsFile = path.join(tempDir, 'audit-sessions.mjs')

  await fs.writeFile(engineFile, transpiledEngine, 'utf8')
  await fs.writeFile(historyFile, transpiledHistory, 'utf8')
  await fs.writeFile(triageFile, transpiledTriage, 'utf8')
  await fs.writeFile(normativeFile, transpiledNormative, 'utf8')
  await fs.writeFile(i18nFile, i18nSource, 'utf8')
  await fs.writeFile(extensionStorageFile, transpiledExtensionStorage, 'utf8')
  await fs.writeFile(extensionRuntimeFile, transpiledExtensionRuntime, 'utf8')
  await fs.writeFile(auditScoreFile, auditScoreSource, 'utf8')
  await fs.writeFile(auditSessionsFile, auditSessionsSource, 'utf8')

  try {
    return await import(pathToFileURL(engineFile).href)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const { getAuditHistoryForSite, getAuditResult, parseImportedAuditReport } =
  await loadAuditEngineModule()

function createViolation(overrides = {}) {
  return {
    id: 'violation-id',
    ruleId: 'rule-id',
    ruleName: 'Regra',
    nbrReference: '5.1.1',
    description: 'Descrição',
    severity: 'error',
    wcagLevel: 'A',
    automationCategory: 'Semi-Automatizável',
    requiresHumanReview: false,
    message: 'Mensagem',
    snippet: '<button>Enviar</button>',
    suggestion: 'Sugestão',
    remediationAdvice: 'Correção',
    customId: 'custom-id',
    ...overrides,
  }
}

function createAuditResult(overrides = {}) {
  const violations = overrides.violations ?? []

  return {
    id: 'audit-id',
    timestamp: 0,
    url: 'https://example.com',
    pageTitle: 'Pagina',
    totalViolations: violations.length,
    errors: violations.filter((violation) => violation.normativeType === 'Requisito').length,
    warnings: violations.filter((violation) => violation.normativeType === 'Recomendacao').length,
    humanReviewItems: violations.filter((violation) => violation.requiresHumanReview).length,
    automatedFindings: violations.filter((violation) => !violation.requiresHumanReview).length,
    violations,
    violationsByRule: {},
    violationsBySeverity: { error: [], warning: [] },
    ...overrides,
  }
}

const wrappedPayload = {
  audit: {
    timestamp: '1717351200000',
    url: 'https://example.com/checkout#resumo',
    pageTitle: 'Checkout',
    includeRecommendations: true,
    totalViolations: 1,
    errors: 1,
    warnings: 0,
    humanReviewItems: 1,
    automatedFindings: 0,
    violations: [
      createViolation({
        id: 'human-review-item',
        requiresHumanReview: true,
      }),
    ],
    summary: {
      auditScore: {
        score: 76,
      },
    },
  },
}

const importedAudit = parseImportedAuditReport(wrappedPayload)

assert.equal(importedAudit.url, 'https://example.com/checkout#resumo')
assert.equal(importedAudit.timestamp, 1717351200000)
assert.equal(importedAudit.id, 'https://example.com/checkout|1717351200000')
assert.equal(importedAudit.includeRecommendations, true)
assert.equal(importedAudit.violations.length, 1)
assert.equal(importedAudit.violations[0].humanReviewStatus, 'pending')
assert.equal(importedAudit.violations[0].normativeType, 'Requisito')

const rawPayload = {
  timestamp: 1717351300000,
  url: 'https://example.com/relatorio',
  totalViolations: 1,
  errors: 0,
  warnings: 1,
  humanReviewItems: 0,
  automatedFindings: 1,
  violations: [
    createViolation({
      id: 'raw-entry',
      nbrReference: '7.3.2',
      severity: 'warning',
    }),
  ],
}

const importedRawAudit = parseImportedAuditReport(rawPayload)

assert.equal(importedRawAudit.id, 'https://example.com/relatorio|1717351300000')
assert.equal(importedRawAudit.violations[0].humanReviewStatus, 'not_applicable')
assert.equal(importedRawAudit.totalViolations, 1)

const storageData = {
  auditResultsByTab: {
    7: createAuditResult({
      id: 'cached-a',
      url: 'https://example.com/a?source=cache#old',
    }),
  },
  auditHistoryByUrl: {
    'https://example.com/a': [
      createAuditResult({
        id: 'current-page',
        timestamp: 4000,
        url: 'https://example.com/a',
      }),
    ],
    'https://example.com/rules.html': [
      createAuditResult({
        id: 'rules-old',
        timestamp: 1000,
        url: 'https://example.com/rules.html',
      }),
      createAuditResult({
        id: 'rules-new',
        timestamp: 3000,
        url: 'https://example.com/rules.html?debug=1',
      }),
    ],
    'https://example.com/privacy.html': [
      createAuditResult({
        id: 'privacy',
        timestamp: 2000,
        url: 'https://example.com/privacy.html#top',
      }),
    ],
    'https://other.example.com/rules.html': [
      createAuditResult({
        id: 'other-origin',
        timestamp: 5000,
        url: 'https://other.example.com/rules.html',
      }),
    ],
  },
}

globalThis.chrome = {
  storage: {
    local: {
      get: async () => storageData,
    },
  },
}

assert.equal((await getAuditResult(7, 'https://example.com/a?source=current#new'))?.id, 'cached-a')
assert.equal(await getAuditResult(7, 'https://example.com/b'), null)

const siteHistory = await getAuditHistoryForSite('https://example.com/a?utm=1#hero')
assert.deepEqual(
  siteHistory.map((entry) => entry.id),
  ['rules-new', 'privacy'],
)

assert.throws(
  () =>
    parseImportedAuditReport({
      audit: {
        timestamp: 'abc',
        url: '',
        violations: [],
      },
    }),
  /Relatório inválido para importação/,
)

assert.throws(
  () =>
    parseImportedAuditReport({
      foo: 'bar',
    }),
  /Relatório inválido para importação/,
)

console.log('Audit import checks passed.')
