import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadManualFindingModules() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-manual-findings-'))
  const sourcePaths = {
    auditComparison: path.resolve('src/utils/audit-comparison.ts'),
    auditEngine: path.resolve('src/utils/audit-engine.ts'),
    auditExport: path.resolve('src/utils/audit-export.ts'),
    auditHistory: path.resolve('src/utils/audit-history.ts'),
    auditScore: path.resolve('src/utils/audit-score.ts'),
    auditTriage: path.resolve('src/utils/audit-triage.ts'),
    manualFindings: path.resolve('src/utils/manual-findings.ts'),
    normative: path.resolve('src/normative.ts'),
    types: path.resolve('src/types/index.ts'),
    utils: path.resolve('src/utils/index.ts'),
  }
  const sources = {
    auditComparison: (await fs.readFile(sourcePaths.auditComparison, 'utf8'))
      .replaceAll("from '@/utils/audit-history'", "from './audit-history.mjs'")
      .replaceAll("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    auditEngine: (await fs.readFile(sourcePaths.auditEngine, 'utf8'))
      .replaceAll("from '@/i18n'", "from './i18n.mjs'")
      .replaceAll("from '@/normative'", "from './normative.mjs'")
      .replaceAll("from '@/utils/audit-history'", "from './audit-history.mjs'")
      .replaceAll("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    auditExport: (await fs.readFile(sourcePaths.auditExport, 'utf8'))
      .replaceAll("from '@/i18n'", "from './i18n.mjs'")
      .replaceAll("from '@/utils/audit-comparison'", "from './audit-comparison.mjs'")
      .replaceAll("from '@/utils/audit-score'", "from './audit-score.mjs'")
      .replaceAll("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    auditHistory: (await fs.readFile(sourcePaths.auditHistory, 'utf8'))
      .replaceAll("from '@/normative'", "from './normative.mjs'")
      .replaceAll("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    auditScore: (await fs.readFile(sourcePaths.auditScore, 'utf8'))
      .replaceAll("from '@/normative'", "from './normative.mjs'")
      .replaceAll("from '@/rules'", "from './rules.mjs'")
      .replaceAll("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    auditTriage: await fs.readFile(sourcePaths.auditTriage, 'utf8'),
    manualFindings: (await fs.readFile(sourcePaths.manualFindings, 'utf8')).replaceAll(
      "from '@/types'",
      "from './types.mjs'",
    ),
    normative: await fs.readFile(sourcePaths.normative, 'utf8'),
    types: (await fs.readFile(sourcePaths.types, 'utf8')).replaceAll(
      "from '@/normative'",
      "from './normative.mjs'",
    ),
    utils: (await fs.readFile(sourcePaths.utils, 'utf8'))
      .replaceAll("from '@/types'", "from './types.mjs'")
      .replaceAll("from '@/normative'", "from './normative.mjs'")
      .replaceAll("from '@/utils/manual-findings'", "from './manual-findings.mjs'"),
    i18n: `
export function t(key, params = {}) {
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replace(\`{{\${name}}}\`, String(value)),
    key,
  )
}
`,
    rules: `
export const allRules = [
  {
    id: 'manual-rule',
    nbrReference: '5.1.1',
    name: 'Regra manual',
    description: 'Descrição da regra manual',
    severity: 'error',
    wcagLevel: 'A',
    category: 'Não Automatizável',
    check: async () => [],
  },
  {
    id: 'automatic-rule',
    nbrReference: '5.1.2',
    name: 'Regra automática',
    description: 'Descrição da regra automática',
    severity: 'error',
    wcagLevel: 'A',
    category: 'Totalmente Automatizável',
    check: async () => [],
  },
  {
    id: 'recommendation-rule',
    nbrReference: '5.3.3',
    name: 'Recomendação',
    description: 'Descrição da recomendação',
    severity: 'warning',
    wcagLevel: 'AA',
    category: 'Totalmente Automatizável',
    check: async () => [],
  },
]

export function getRunnableRules(includeRecommendations, includeHumanReview) {
  return allRules.filter((rule) => {
    if (!includeRecommendations && rule.id === 'recommendation-rule') return false
    if (!includeHumanReview && rule.category === 'Não Automatizável') return false
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
    ['audit-comparison.mjs', sources.auditComparison, sourcePaths.auditComparison],
    ['audit-engine.mjs', sources.auditEngine, sourcePaths.auditEngine],
    ['audit-export.mjs', sources.auditExport, sourcePaths.auditExport],
    ['audit-history.mjs', sources.auditHistory, sourcePaths.auditHistory],
    ['audit-score.mjs', sources.auditScore, sourcePaths.auditScore],
    ['audit-triage.mjs', sources.auditTriage, sourcePaths.auditTriage],
    ['manual-findings.mjs', sources.manualFindings, sourcePaths.manualFindings],
    ['normative.mjs', sources.normative, sourcePaths.normative],
    ['types.mjs', sources.types, sourcePaths.types],
    ['utils.mjs', sources.utils, sourcePaths.utils],
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
    const [
      auditEngineModule,
      auditExportModule,
      auditHistoryModule,
      auditScoreModule,
      utilsModule,
    ] = await Promise.all([
      import(pathToFileURL(path.join(tempDir, 'audit-engine.mjs')).href),
      import(pathToFileURL(path.join(tempDir, 'audit-export.mjs')).href),
      import(pathToFileURL(path.join(tempDir, 'audit-history.mjs')).href),
      import(pathToFileURL(path.join(tempDir, 'audit-score.mjs')).href),
      import(pathToFileURL(path.join(tempDir, 'utils.mjs')).href),
    ])

    return {
      ...auditEngineModule,
      ...auditExportModule,
      ...auditHistoryModule,
      ...auditScoreModule,
      ...utilsModule,
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const {
  buildExportableAuditResult,
  createManualViolation,
  getAuditScoreData,
  getDisplayAuditResult,
  getManualFindingReapplyCandidates,
  mergeResolvedManualFindings,
} = await loadManualFindingModules()

const manualRule = {
  id: 'manual-rule',
  nbrReference: '5.1.1',
  name: 'Regra manual',
  description: 'Descrição da regra manual',
  severity: 'error',
  wcagLevel: 'A',
  category: 'Não Automatizável',
}

const manualDraft = {
  tabId: 7,
  selector: '#target',
  tagName: 'button',
  snippet: '<button id="target">Enviar</button>',
  accessibleName: 'Enviar formulário',
  visibleText: 'Enviar',
  url: 'https://example.com/form',
  pageTitle: 'Formulário',
  selectedAt: 1234,
}

function createAuditResult(overrides = {}) {
  const violations = overrides.violations ?? []

  return {
    id: 'audit-id',
    timestamp: 1000,
    url: 'https://example.com/form',
    pageTitle: 'Formulário',
    includeRecommendations: false,
    includeHumanReview: false,
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

const manualViolation = createManualViolation(manualRule, {
  draft: manualDraft,
  message: '  Botão sem indicação suficiente.  ',
  suggestion: '  Ajustar identificação do botão.  ',
  remediationAdvice: '  Revise o texto, rótulo e contexto do controle.  ',
  userNote: '  Evidência registrada na avaliação.  ',
  createdAt: 5000,
})

assert.equal(manualViolation.findingOrigin, 'manual')
assert.equal(manualViolation.findingStatus, 'confirmed')
assert.equal(manualViolation.humanReviewStatus, 'confirmed')
assert.equal(manualViolation.findingStatusUpdatedAt, 5000)
assert.equal(manualViolation.message, 'Botão sem indicação suficiente.')
assert.equal(manualViolation.suggestion, 'Ajustar identificação do botão.')
assert.equal(manualViolation.remediationAdvice, 'Revise o texto, rótulo e contexto do controle.')
assert.equal(manualViolation.userNote, 'Evidência registrada na avaliação.')
assert.equal(manualViolation.elementSelector, '#target')
assert.equal(manualViolation.elementAccessibleName, 'Enviar formulário')
assert.equal(manualViolation.elementVisibleText, 'Enviar')

const manualAudit = createAuditResult({ violations: [manualViolation] })
const manualScore = getAuditScoreData(manualAudit)

assert.equal(manualScore.manualFindingCount, 1)
assert.equal(manualScore.confirmedFindingCount, 1)
assert.equal(manualScore.activeOccurrenceCount, 1)
assert.equal(manualScore.violatedRequirementRules, 1)
assert.equal(manualScore.failedRequirementWeight, 2)

const displayedWithoutHumanReview = getDisplayAuditResult(manualAudit, false, false)

assert.equal(displayedWithoutHumanReview.violations.length, 1)
assert.equal(displayedWithoutHumanReview.violations[0].id, manualViolation.id)

const exportableAudit = buildExportableAuditResult(manualAudit)

assert.equal(exportableAudit.audit.violations.length, 1)
assert.equal(exportableAudit.audit.violations[0].findingOrigin, 'manual')
assert.equal(exportableAudit.audit.violations[0].findingStatus, 'confirmed')
assert.equal(exportableAudit.summary.findings.actionable, 1)
assert.equal(exportableAudit.summary.findings.confirmed, 1)

const olderManualViolation = {
  ...manualViolation,
  message: 'Versão antiga do achado',
}
const automaticViolation = {
  ...manualViolation,
  id: 'automatic',
  ruleId: 'automatic-rule',
  findingOrigin: 'automatic',
  findingStatus: 'open',
  humanReviewStatus: 'not_applicable',
  elementSelector: '#automatic',
}
const reapplyCandidates = getManualFindingReapplyCandidates([
  createAuditResult({
    id: 'newer-history',
    timestamp: 2000,
    violations: [manualViolation, automaticViolation],
  }),
  createAuditResult({
    id: 'older-history',
    timestamp: 1000,
    violations: [olderManualViolation],
  }),
])

assert.equal(reapplyCandidates.length, 1)
assert.equal(reapplyCandidates[0].id, manualViolation.id)
assert.equal(reapplyCandidates[0].message, manualViolation.message)

const emptyCurrentAudit = createAuditResult({ id: 'rerun', timestamp: 3000, violations: [] })
const mergedAudit = mergeResolvedManualFindings(emptyCurrentAudit, reapplyCandidates, [
  {
    id: manualViolation.id,
    selector: '#target',
    tagName: 'button',
    snippet: '<button id="target">Enviar agora</button>',
    accessibleName: 'Enviar agora',
    visibleText: 'Enviar agora',
  },
])

assert.equal(mergedAudit.violations.length, 1)
assert.equal(mergedAudit.violations[0].id, manualViolation.id)
assert.equal(mergedAudit.violations[0].snippet, '<button id="target">Enviar agora</button>')
assert.equal(mergedAudit.violations[0].elementVisibleText, 'Enviar agora')
assert.equal(mergedAudit.violations[0].inheritedFromHistory, true)

const unresolvedAudit = mergeResolvedManualFindings(emptyCurrentAudit, reapplyCandidates, [])

assert.equal(unresolvedAudit.violations.length, 0)

const duplicateAudit = mergeResolvedManualFindings(
  createAuditResult({ violations: [manualViolation] }),
  reapplyCandidates,
  [
    {
      id: manualViolation.id,
      selector: '#target',
      tagName: 'button',
      snippet: '<button id="target">Enviar agora</button>',
    },
  ],
)

assert.equal(duplicateAudit.violations.length, 1)

const popupSource = await fs.readFile(
  path.resolve('src/components/AuditWorkspaceApp.tsx'),
  'utf8',
)
const contentSource = await fs.readFile(path.resolve('src/content.ts'), 'utf8')

assert.match(popupSource, /popup\.manualFinding\.validation\.rule/)
assert.match(popupSource, /popup\.manualFinding\.validation\.message/)
assert.match(popupSource, /popup\.manualFinding\.validation\.suggestion/)
assert.match(popupSource, /popup\.manualFinding\.validation\.remediationAdvice/)
assert.match(contentSource, /START_MANUAL_FINDING_SELECTION/)
assert.match(contentSource, /RESOLVE_MANUAL_FINDING_SELECTORS/)
assert.match(contentSource, /event\.key !== 'Escape'/)
assert.match(contentSource, /isGuardInjectedElement\(element\)/)

console.log('Manual finding checks passed.')
