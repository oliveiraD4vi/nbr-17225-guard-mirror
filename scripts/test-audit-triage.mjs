import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadAuditModules() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-triage-'))
  const sourcePaths = {
    comparison: path.resolve('src/utils/audit-comparison.ts'),
    export: path.resolve('src/utils/audit-export.ts'),
    history: path.resolve('src/utils/audit-history.ts'),
    normative: path.resolve('src/normative.ts'),
    score: path.resolve('src/utils/audit-score.ts'),
    triage: path.resolve('src/utils/audit-triage.ts'),
  }
  const sources = {
    comparison: (await fs.readFile(sourcePaths.comparison, 'utf8'))
      .replace("from '@/utils/audit-history'", "from './audit-history.mjs'")
      .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    export: (await fs.readFile(sourcePaths.export, 'utf8'))
      .replace("from '@/i18n'", "from './i18n.mjs'")
      .replace("from '@/utils/audit-comparison'", "from './audit-comparison.mjs'")
      .replace("from '@/utils/audit-score'", "from './audit-score.mjs'")
      .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    history: (await fs.readFile(sourcePaths.history, 'utf8'))
      .replace("from '@/normative'", "from './normative.mjs'")
      .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    normative: await fs.readFile(sourcePaths.normative, 'utf8'),
    score: (await fs.readFile(sourcePaths.score, 'utf8'))
      .replace("from '@/normative'", "from './normative.mjs'")
      .replace("from '@/rules'", "from './rules.mjs'")
      .replace("from '@/utils/audit-contract'", "from './audit-contract.mjs'")
      .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    triage: await fs.readFile(sourcePaths.triage, 'utf8'),
    auditContract: `
export function getRuleVerificationMode(rule) {
  if (rule.verificationMode) return rule.verificationMode
  if (rule.category === 'Totalmente Automatizável') return 'automatic'
  if (rule.category === 'Semi-Automatizável') return 'assisted'
  return 'manual'
}
`,
    i18n: `
export function t(key, params = {}) {
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replace(\`{{\${name}}}\`, String(value)),
    key,
  )
}
`,
    rules: `
const rules = [
  {
    id: 'requirement-rule',
    nbrReference: '5.1.1',
    name: 'Regra obrigatória',
    description: 'Descrição',
    severity: 'error',
    wcagLevel: 'A',
    category: 'Totalmente Automatizável',
    check: async () => [],
  },
  {
    id: 'human-rule',
    nbrReference: '5.2.1',
    name: 'Regra humana',
    description: 'Descrição',
    severity: 'error',
    wcagLevel: 'A',
    category: 'Semi-Automatizável',
    check: async () => [],
  },
  {
    id: 'recommendation-rule',
    nbrReference: '5.3.3',
    name: 'Recomendação',
    description: 'Descrição',
    severity: 'warning',
    wcagLevel: 'AA',
    category: 'Totalmente Automatizável',
    check: async () => [],
  },
  {
    id: 'manual-route',
    nbrReference: '5.4.1',
    name: 'Roteiro manual',
    description: 'Sem conclusão automática',
    severity: 'error',
    wcagLevel: 'A',
    category: 'Não Automatizável',
    verificationMode: 'manual',
    check: async () => [],
  },
]

export function getRunnableRules(includeRecommendations, includeHumanReview) {
  return rules.filter((rule) => {
    if (!includeRecommendations && rule.id === 'recommendation-rule') return false
    if (!includeHumanReview && rule.id === 'human-rule') return false
    return true
  })
}
`,
  }
  const transpileOptions = {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
  const files = [
    ['audit-comparison.mjs', sources.comparison, sourcePaths.comparison],
    ['audit-contract.mjs', sources.auditContract, 'audit-contract.mjs'],
    ['audit-export.mjs', sources.export, sourcePaths.export],
    ['audit-history.mjs', sources.history, sourcePaths.history],
    ['audit-score.mjs', sources.score, sourcePaths.score],
    ['audit-triage.mjs', sources.triage, sourcePaths.triage],
    ['normative.mjs', sources.normative, sourcePaths.normative],
    ['i18n.mjs', sources.i18n, 'i18n.mjs'],
    ['rules.mjs', sources.rules, 'rules.mjs'],
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
    const [comparisonModule, exportModule, historyModule, scoreModule, triageModule] =
      await Promise.all([
        import(pathToFileURL(path.join(tempDir, 'audit-comparison.mjs')).href),
        import(pathToFileURL(path.join(tempDir, 'audit-export.mjs')).href),
        import(pathToFileURL(path.join(tempDir, 'audit-history.mjs')).href),
        import(pathToFileURL(path.join(tempDir, 'audit-score.mjs')).href),
        import(pathToFileURL(path.join(tempDir, 'audit-triage.mjs')).href),
      ])

    return {
      ...comparisonModule,
      ...exportModule,
      ...historyModule,
      ...scoreModule,
      ...triageModule,
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const {
  applyFindingStatusUpdate,
  buildExportableAuditResult,
  compareAuditResults,
  getAuditScoreData,
  getVisibleAuditViolations,
  normalizeViolationFindingState,
} = await loadAuditModules()

function createViolation(overrides = {}) {
  return {
    id: 'violation-id',
    ruleId: 'requirement-rule',
    ruleName: 'Regra',
    nbrReference: '5.1.1',
    description: 'Descrição',
    severity: 'error',
    wcagLevel: 'A',
    automationCategory: 'Totalmente Automatizável',
    normativeType: 'Requisito',
    requiresHumanReview: false,
    humanReviewStatus: 'not_applicable',
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
    pageTitle: 'Página',
    includeRecommendations: false,
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

const legacyPending = normalizeViolationFindingState(
  createViolation({ requiresHumanReview: true, humanReviewStatus: 'pending' }),
)
const legacyNotApplicable = normalizeViolationFindingState(
  createViolation({ humanReviewStatus: 'not_applicable' }),
)
const legacyConfirmed = normalizeViolationFindingState(
  createViolation({ requiresHumanReview: true, humanReviewStatus: 'confirmed' }),
)
const legacyDismissed = normalizeViolationFindingState(
  createViolation({ requiresHumanReview: true, humanReviewStatus: 'dismissed' }),
)

assert.equal(legacyPending.findingStatus, 'open')
assert.equal(legacyPending.findingOrigin, 'automatic')
assert.equal(legacyNotApplicable.findingStatus, 'open')
assert.equal(legacyConfirmed.findingStatus, 'confirmed')
assert.equal(legacyDismissed.findingStatus, 'ignored')
assert.equal(legacyDismissed.ignoreReason, 'false_positive')

const ignoredAutomatic = applyFindingStatusUpdate(
  normalizeViolationFindingState(createViolation()),
  {
    status: 'ignored',
    ignoreReason: 'accepted_risk',
    ignoreNote: '  Aceito no contexto atual.  ',
  },
  1000,
)

assert.equal(ignoredAutomatic.findingStatus, 'ignored')
assert.equal(ignoredAutomatic.humanReviewStatus, 'dismissed')
assert.equal(ignoredAutomatic.ignoreReason, 'accepted_risk')
assert.equal(ignoredAutomatic.ignoreNote, 'Aceito no contexto atual.')
assert.equal(ignoredAutomatic.findingStatusUpdatedAt, 1000)

const reopenedAutomatic = applyFindingStatusUpdate(ignoredAutomatic, { status: 'open' }, 2000)

assert.equal(reopenedAutomatic.findingStatus, 'open')
assert.equal(reopenedAutomatic.humanReviewStatus, 'not_applicable')
assert.equal(reopenedAutomatic.ignoreReason, undefined)
assert.equal(reopenedAutomatic.ignoreNote, undefined)
assert.equal(reopenedAutomatic.findingStatusUpdatedAt, 2000)

const confirmedHuman = applyFindingStatusUpdate(
  normalizeViolationFindingState(
    createViolation({
      id: 'human',
      ruleId: 'human-rule',
      requiresHumanReview: true,
      humanReviewStatus: 'pending',
    }),
  ),
  { status: 'confirmed' },
  3000,
)

assert.equal(confirmedHuman.findingStatus, 'confirmed')
assert.equal(confirmedHuman.humanReviewStatus, 'confirmed')

const reopenedHuman = applyFindingStatusUpdate(confirmedHuman, { status: 'open' }, 4000)

assert.equal(reopenedHuman.findingStatus, 'open')
assert.equal(reopenedHuman.humanReviewStatus, 'pending')

const violationsListSource = await fs.readFile(
  path.resolve('src/components/ViolationsList.tsx'),
  'utf8',
)

assert.match(violationsListSource, /if \(!ignoreReason\)/)
assert.match(violationsListSource, /ignoreReasonRequired/)

const ignoredAudit = createAuditResult({
  violations: [
    createViolation({
      id: 'ignored-score',
      findingStatus: 'ignored',
      humanReviewStatus: 'dismissed',
      ignoreReason: 'false_positive',
    }),
  ],
})
const ignoredScore = getAuditScoreData(ignoredAudit)

assert.equal(ignoredScore.violatedRequirementRules, 0)
assert.equal(ignoredScore.activeOccurrenceCount, 0)
assert.equal(ignoredScore.ignoredFindingCount, 1)

const humanPendingAudit = createAuditResult({
  violations: [
    createViolation({
      id: 'human-open',
      ruleId: 'human-rule',
      requiresHumanReview: true,
      humanReviewStatus: 'pending',
    }),
  ],
})
const humanPendingScore = getAuditScoreData(humanPendingAudit)

assert.equal(humanPendingScore.totalRequirementRules, 2)
assert.equal(humanPendingScore.violatedRequirementRules, 1)
assert.equal(humanPendingScore.confirmedViolatedRequirementRules, 0)
assert.equal(humanPendingScore.activeOccurrenceCount, 1)
assert.equal(humanPendingScore.pendingHumanReviewItems, 1)
assert.equal(humanPendingScore.isProvisional, true)
assert.equal(humanPendingScore.conservativeScore, 50)
assert.equal(humanPendingScore.confirmedScore, 100)

const humanConfirmedAudit = createAuditResult({
  violations: [confirmedHuman],
})
const humanConfirmedScore = getAuditScoreData(humanConfirmedAudit)

assert.equal(humanConfirmedScore.violatedRequirementRules, 1)
assert.equal(humanConfirmedScore.confirmedViolatedRequirementRules, 1)
assert.equal(humanConfirmedScore.confirmedFindingCount, 1)

const visibleViolations = getVisibleAuditViolations(ignoredAudit)
const exportableAudit = buildExportableAuditResult(ignoredAudit)

assert.deepEqual(visibleViolations, [])
assert.equal(exportableAudit.audit.violations.length, 1)
assert.equal(exportableAudit.audit.violations[0].findingStatus, 'ignored')
assert.equal(exportableAudit.summary.findings.ignored, 1)

const openToIgnoredSummary = compareAuditResults(
  createAuditResult({
    id: 'baseline',
    timestamp: 1000,
    violations: [
      createViolation({
        id: 'same',
        ruleId: 'requirement-rule',
        message: 'Mesmo achado',
        suggestion: 'Corrigir',
      }),
    ],
  }),
  createAuditResult({
    id: 'target',
    timestamp: 2000,
    violations: [
      createViolation({
        id: 'same',
        ruleId: 'requirement-rule',
        message: 'Mesmo achado',
        suggestion: 'Corrigir',
        findingStatus: 'ignored',
        humanReviewStatus: 'dismissed',
        ignoreReason: 'false_positive',
      }),
    ],
  }),
)

assert.equal(openToIgnoredSummary.resolvedViolations.length, 0)
assert.equal(openToIgnoredSummary.stateChangedViolations.length, 1)

console.log('Audit triage checks passed.')
