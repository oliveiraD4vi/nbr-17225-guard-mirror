import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadAuditComparisonModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-comparison-'))
  const comparisonSourcePath = path.resolve('src/utils/audit-comparison.ts')
  const historySourcePath = path.resolve('src/utils/audit-history.ts')
  const triageSourcePath = path.resolve('src/utils/audit-triage.ts')
  const normativeSourcePath = path.resolve('src/normative.ts')

  const comparisonSource = (await fs.readFile(comparisonSourcePath, 'utf8'))
    .replace("from '@/utils/audit-history'", "from './audit-history.mjs'")
    .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'")
  const historySource = (await fs.readFile(historySourcePath, 'utf8'))
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

  const files = [
    ['audit-comparison.mjs', comparisonSource, comparisonSourcePath],
    ['audit-history.mjs', historySource, historySourcePath],
    ['audit-triage.mjs', triageSource, triageSourcePath],
    ['normative.mjs', normativeSource, normativeSourcePath],
  ]

  await Promise.all(
    files.map(([fileName, source, sourcePath]) =>
      fs.writeFile(
        path.join(tempDir, fileName),
        ts.transpileModule(source, {
          ...transpileOptions,
          fileName: sourcePath,
        }).outputText,
        'utf8',
      ),
    ),
  )

  try {
    return await import(pathToFileURL(path.join(tempDir, 'audit-comparison.mjs')).href)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const {
  compareAuditResults,
  getConfirmedFindingCount,
  getDismissedHumanReviewCount,
  getIgnoredFindingCount,
  getPendingHumanReviewCount,
} = await loadAuditComparisonModule()

assert.equal(typeof compareAuditResults, 'function', 'compareAuditResults não foi exportada')
assert.equal(
  typeof getConfirmedFindingCount,
  'function',
  'getConfirmedFindingCount não foi exportada',
)
assert.equal(typeof getIgnoredFindingCount, 'function', 'getIgnoredFindingCount não foi exportada')
assert.equal(
  typeof getPendingHumanReviewCount,
  'function',
  'getPendingHumanReviewCount não foi exportada',
)

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

function createAuditResult(overrides = {}) {
  const violations = overrides.violations ?? []

  return {
    id: 'audit-id',
    timestamp: 0,
    url: 'https://example.com',
    pageTitle: 'Página',
    includeRecommendations: true,
    includeHumanReview: true,
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

const baseline = createAuditResult({
  id: 'baseline',
  timestamp: 1000,
  violations: [
    createViolation({
      id: 'open-persistent',
      ruleId: 'rule-persistent',
      message: 'Persistente',
      suggestion: 'Corrigir persistente',
    }),
    createViolation({
      id: 'review-ignored',
      ruleId: 'rule-ignored',
      message: 'Ignorado',
      suggestion: 'Não deve aparecer nos acionáveis',
      requiresHumanReview: true,
      humanReviewStatus: 'dismissed',
    }),
    createViolation({
      id: 'review-confirmed',
      ruleId: 'rule-confirmed',
      message: 'Confirmado',
      suggestion: 'Corrigir confirmado',
      requiresHumanReview: true,
      humanReviewStatus: 'confirmed',
      userNote: 'Confirmado manualmente',
    }),
  ],
})

const target = createAuditResult({
  id: 'target',
  timestamp: 2000,
  violations: [
    createViolation({
      id: 'open-persistent',
      ruleId: 'rule-persistent',
      message: 'Persistente',
      suggestion: 'Corrigir persistente',
    }),
    createViolation({
      id: 'new-open',
      ruleId: 'rule-new',
      message: 'Novo problema',
      suggestion: 'Corrigir novo',
    }),
    createViolation({
      id: 'review-pending',
      ruleId: 'rule-pending',
      message: 'Pendente',
      suggestion: 'Revisar pendente',
      requiresHumanReview: true,
      humanReviewStatus: 'pending',
    }),
  ],
})

const summary = compareAuditResults(baseline, target)

assert.equal(summary.baselineId, 'baseline')
assert.equal(summary.targetId, 'target')
assert.equal(summary.persistentViolations.length, 1)
assert.equal(summary.newViolations.length, 2)
assert.equal(summary.resolvedViolations.length, 1)
assert.equal(summary.stateChangedViolations.length, 0)
assert.equal(summary.baselineOpenCount, 2)
assert.equal(summary.targetOpenCount, 3)
assert.equal(summary.baselineConfirmedReviews, 1)
assert.equal(summary.baselineDismissedReviews, 1)
assert.equal(summary.baselinePendingReviews, 0)
assert.equal(summary.targetConfirmedReviews, 0)
assert.equal(summary.targetDismissedReviews, 0)
assert.equal(summary.targetPendingReviews, 1)
assert.equal(summary.baselineNoteCount, 1)
assert.equal(summary.targetNoteCount, 0)

assert.equal(getConfirmedFindingCount(baseline), 1)
assert.equal(getIgnoredFindingCount(baseline), 1)
assert.equal(getDismissedHumanReviewCount(baseline), 1)
assert.equal(getPendingHumanReviewCount(target), 1)

const openToIgnoredBaseline = createAuditResult({
  id: 'open-baseline',
  timestamp: 3000,
  violations: [
    createViolation({
      id: 'same-finding',
      ruleId: 'rule-state',
      message: 'Mesmo achado',
      suggestion: 'Corrigir',
    }),
  ],
})

const openToIgnoredTarget = createAuditResult({
  id: 'ignored-target',
  timestamp: 4000,
  violations: [
    createViolation({
      id: 'same-finding',
      ruleId: 'rule-state',
      message: 'Mesmo achado',
      suggestion: 'Corrigir',
      findingStatus: 'ignored',
      ignoreReason: 'false_positive',
      humanReviewStatus: 'dismissed',
    }),
  ],
})

const stateChangeSummary = compareAuditResults(openToIgnoredBaseline, openToIgnoredTarget)

assert.equal(stateChangeSummary.resolvedViolations.length, 0)
assert.equal(stateChangeSummary.stateChangedViolations.length, 1)
assert.equal(stateChangeSummary.targetOpenCount, 0)
assert.equal(stateChangeSummary.targetDismissedReviews, 1)
assert.equal(stateChangeSummary.technicalTrend, 'unchanged')
assert.equal(stateChangeSummary.ignoredSinceBaseline.length, 1)

const reopenedSummary = compareAuditResults(openToIgnoredTarget, openToIgnoredBaseline)
assert.equal(reopenedSummary.technicalTrend, 'unchanged')
assert.equal(reopenedSummary.reopenedSinceBaseline.length, 1)
assert.equal(reopenedSummary.newViolations.length, 0)

const mixedSummary = compareAuditResults(
  createAuditResult({
    id: 'mixed-baseline',
    violations: [createViolation({ id: 'removed-item', ruleId: 'removed-rule' })],
  }),
  createAuditResult({
    id: 'mixed-target',
    violations: [createViolation({ id: 'new-item', ruleId: 'new-rule' })],
  }),
)
assert.equal(mixedSummary.technicalTrend, 'mixed')
assert.equal(mixedSummary.newViolations.length, 1)
assert.equal(mixedSummary.noLongerDetectedViolations.length, 1)
assert.equal(mixedSummary.resolvedViolations, mixedSummary.noLongerDetectedViolations)

const partialScopeSummary = compareAuditResults(
  createAuditResult({
    id: 'partial-baseline',
    includeRecommendations: true,
    violations: [
      createViolation({ id: 'requirement-removed', ruleId: 'requirement-removed' }),
      createViolation({
        id: 'recommendation-outside-scope',
        ruleId: 'recommendation-outside-scope',
        normativeType: 'Recomendação',
      }),
    ],
  }),
  createAuditResult({
    id: 'partial-target',
    includeRecommendations: false,
    violations: [],
  }),
)
assert.equal(partialScopeSummary.comparisonScope.mode, 'partial')
assert.deepEqual(partialScopeSummary.comparisonScope.excluded, ['recommendations'])
assert.equal(partialScopeSummary.noLongerDetectedViolations.length, 1)
assert.equal(partialScopeSummary.technicalTrend, 'improvement')

const reviewChangeSummary = compareAuditResults(
  createAuditResult({
    id: 'review-change-baseline',
    violations: [
      createViolation({
        id: 'review-change',
        userNote: 'Texto anterior',
        alternativeTextReview: {
          currentSource: 'alt',
          currentText: '',
          proposedText: 'Descrição anterior',
          targetAttribute: 'alt',
          updatedAt: 100,
        },
        userContrastOverride: {
          foregroundHex: '#000000',
          backgroundHex: '#ffffff',
          updatedAt: 100,
        },
      }),
    ],
  }),
  createAuditResult({
    id: 'review-change-target',
    violations: [
      createViolation({
        id: 'review-change',
        userNote: 'Texto atualizado',
        alternativeTextReview: {
          currentSource: 'alt',
          currentText: '',
          proposedText: 'Descrição atualizada',
          targetAttribute: 'alt',
          updatedAt: 200,
        },
        userContrastOverride: {
          foregroundHex: '#111111',
          backgroundHex: '#ffffff',
          updatedAt: 200,
        },
      }),
    ],
  }),
)
assert.deepEqual(reviewChangeSummary.reviewChangedViolations[0].changedFields, [
  'user_note',
  'alternative_text',
  'contrast',
])
assert.equal(reviewChangeSummary.technicalTrend, 'unchanged')

const timestampOnlySummary = compareAuditResults(
  createAuditResult({
    id: 'timestamp-baseline',
    violations: [
      createViolation({
        id: 'timestamp-only',
        userContrastOverride: {
          foregroundHex: '#111111',
          backgroundHex: '#ffffff',
          updatedAt: 100,
        },
      }),
    ],
  }),
  createAuditResult({
    id: 'timestamp-target',
    violations: [
      createViolation({
        id: 'timestamp-only',
        userContrastOverride: {
          foregroundHex: '#111111',
          backgroundHex: '#ffffff',
          updatedAt: 200,
        },
      }),
    ],
  }),
)
assert.equal(timestampOnlySummary.reviewChangedViolations.length, 0)
assert.equal(timestampOnlySummary.technicalTrend, 'unchanged')

console.log('Audit history comparison checks passed.')
