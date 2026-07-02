import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadAuditHistoryModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-history-'))
  const sourcePath = path.resolve('src/utils/audit-history.ts')
  const triageSourcePath = path.resolve('src/utils/audit-triage.ts')
  const normativeSourcePath = path.resolve('src/normative.ts')
  const source = (await fs.readFile(sourcePath, 'utf8'))
    .replace("from '@/normative'", "from './normative.mjs'")
    .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'")
  const triageSource = await fs.readFile(triageSourcePath, 'utf8')
  const normativeSource = await fs.readFile(normativeSourcePath, 'utf8')
  const transpileOptions = {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
  const transpiled = ts.transpileModule(source, {
    ...transpileOptions,
    fileName: sourcePath,
  }).outputText
  const transpiledTriage = ts.transpileModule(triageSource, {
    ...transpileOptions,
    fileName: triageSourcePath,
  }).outputText
  const transpiledNormative = ts.transpileModule(normativeSource, {
    ...transpileOptions,
    fileName: normativeSourcePath,
  }).outputText

  const tempFile = path.join(tempDir, 'audit-history.mjs')
  const tempTriageFile = path.join(tempDir, 'audit-triage.mjs')
  const tempNormativeFile = path.join(tempDir, 'normative.mjs')
  await fs.writeFile(tempFile, transpiled, 'utf8')
  await fs.writeFile(tempTriageFile, transpiledTriage, 'utf8')
  await fs.writeFile(tempNormativeFile, transpiledNormative, 'utf8')

  try {
    return await import(pathToFileURL(tempFile).href)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const auditHistoryModule = await loadAuditHistoryModule()
const {
  compactAuditResultForStorage,
  dedupeAndSortAuditHistory,
  getAuditSiteStorageKey,
  getAuditUrlStorageKey,
  getVisibleAuditViolations,
  hydrateAuditResult,
  inheritViolationStateFromHistory,
} = auditHistoryModule

function createViolation(overrides = {}) {
  return {
    id: 'violation-id',
    ruleId: 'rule-id',
    ruleName: 'Regra',
    nbrReference: '5.0.0',
    description: 'Descrição',
    severity: 'warning',
    wcagLevel: 'A',
    automationCategory: 'Semi-Automatizável',
    normativeType: 'Requisito',
    requiresHumanReview: false,
    humanReviewStatus: 'not_applicable',
    message: 'Mensagem',
    snippet: '',
    suggestion: 'Sugestão',
    remediationAdvice: 'Correção',
    customId: 'custom-id',
    ...overrides,
  }
}

function createAuditEntry(overrides = {}) {
  const violations = overrides.violations ?? []

  return {
    id: 'audit-id',
    timestamp: 0,
    url: 'https://example.com',
    pageTitle: 'Página',
    totalViolations: violations.length,
    errors: violations.filter((violation) => violation.normativeType === 'Requisito').length,
    warnings: violations.filter((violation) => violation.normativeType === 'Recomendação').length,
    humanReviewItems: violations.filter((violation) => violation.requiresHumanReview).length,
    automatedFindings: violations.filter((violation) => !violation.requiresHumanReview).length,
    violations,
    violationsByRule: {},
    violationsBySeverity: { error: [], warning: [] },
    ...overrides,
  }
}

assert.equal(getAuditUrlStorageKey('https://example.com/path#section'), 'https://example.com/path')
assert.equal(getAuditUrlStorageKey('https://example.com/path?debug=1'), 'https://example.com/path')
assert.equal(
  getAuditUrlStorageKey('https://example.com/path/?debug=1#section'),
  'https://example.com/path',
)
assert.equal(getAuditUrlStorageKey('https://example.com/path/a'), 'https://example.com/path/a')
assert.equal(getAuditUrlStorageKey('https://example.com/path/b'), 'https://example.com/path/b')
assert.equal(getAuditSiteStorageKey('https://example.com/path/b?debug=1'), 'https://example.com')

const dedupedHistory = dedupeAndSortAuditHistory(
  [
    createAuditEntry({ id: 'older', timestamp: 100 }),
    createAuditEntry({ id: 'newer', timestamp: 300 }),
    createAuditEntry({ id: 'older', timestamp: 100 }),
    createAuditEntry({ id: 'middle', timestamp: 200 }),
  ],
  10,
)

assert.deepEqual(
  dedupedHistory.map((entry) => entry.id),
  ['newer', 'middle', 'older'],
)

const visibleViolations = getVisibleAuditViolations(
  createAuditEntry({
    violations: [
      createViolation({ id: 'kept', requiresHumanReview: true, humanReviewStatus: 'confirmed' }),
      createViolation({ id: 'hidden', requiresHumanReview: true, humanReviewStatus: 'dismissed' }),
      createViolation({
        id: 'auto',
        requiresHumanReview: false,
        humanReviewStatus: 'not_applicable',
      }),
    ],
  }),
)

assert.deepEqual(
  visibleViolations.map((violation) => violation.id),
  ['kept', 'auto'],
)

const inheritedResult = inheritViolationStateFromHistory(
  createAuditEntry({
    id: 'current',
    violations: [
      createViolation({
        id: 'same-key',
        ruleId: 'rule-a',
        message: 'Mensagem A',
        suggestion: 'Sugestão A',
        elementSelector: '#campo-a',
        requiresHumanReview: true,
        humanReviewStatus: 'pending',
      }),
      createViolation({
        id: 'other-key',
        ruleId: 'rule-b',
        message: 'Mensagem B',
        suggestion: 'Sugestão B',
        elementSelector: '#campo-b',
        requiresHumanReview: true,
        humanReviewStatus: 'pending',
      }),
    ],
  }),
  [
    createAuditEntry({
      id: 'history-1',
      violations: [
        createViolation({
          id: 'same-key',
          ruleId: 'rule-a',
          message: 'Mensagem A',
          suggestion: 'Sugestão A',
          elementSelector: '#campo-a',
          requiresHumanReview: true,
          humanReviewStatus: 'dismissed',
          userNote: 'Não se aplica neste fluxo',
          noteUpdatedAt: 123,
        }),
      ],
    }),
  ],
)

assert.equal(inheritedResult.violations[0].humanReviewStatus, 'dismissed')
assert.equal(inheritedResult.violations[0].userNote, 'Não se aplica neste fluxo')
assert.equal(inheritedResult.violations[0].noteUpdatedAt, 123)
assert.equal(inheritedResult.violations[0].inheritedFromHistory, true)
assert.equal(inheritedResult.violations[1].humanReviewStatus, 'pending')
assert.equal(inheritedResult.violations[1].userNote, undefined)

const auditWithDerivedData = createAuditEntry({
  id: 'with-derived-data',
  summary: {
    auditScore: {
      score: 91,
    },
  },
  violations: [
    createViolation({
      id: 'error-a',
      ruleId: 'rule-a',
      severity: 'error',
      nbrReference: '5.1.1',
      element: { nodeName: 'INPUT' },
      inheritedFromHistory: true,
    }),
    createViolation({
      id: 'warning-b',
      ruleId: 'rule-b',
      severity: 'warning',
      nbrReference: '5.3.3',
      userNote: 'Revisar com o time',
    }),
  ],
})
const compactedAudit = compactAuditResultForStorage(auditWithDerivedData)

assert.equal('violationsByRule' in compactedAudit, false)
assert.equal('violationsBySeverity' in compactedAudit, false)
assert.equal('summary' in compactedAudit, false)
assert.equal('element' in compactedAudit.violations[0], false)
assert.equal('inheritedFromHistory' in compactedAudit.violations[0], false)
assert.equal(compactedAudit.violations[1].userNote, 'Revisar com o time')

const hydratedAudit = hydrateAuditResult(compactedAudit)

assert.equal(hydratedAudit.totalViolations, 2)
assert.equal(hydratedAudit.violationsByRule['rule-a'].length, 1)
assert.equal(hydratedAudit.violationsBySeverity.error.length, 1)
assert.equal(hydratedAudit.violationsBySeverity.warning.length, 1)

console.log('Audit history utility checks passed.')
