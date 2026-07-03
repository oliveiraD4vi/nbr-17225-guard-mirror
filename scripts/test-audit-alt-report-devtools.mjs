import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadAuditModules() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-alt-report-'))
  const sourcePaths = {
    comparison: path.resolve('src/utils/audit-comparison.ts'),
    export: path.resolve('src/utils/audit-export.ts'),
    history: path.resolve('src/utils/audit-history.ts'),
    normative: path.resolve('src/normative.ts'),
    reportSnapshots: path.resolve('src/utils/report-snapshots.ts'),
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
    reportSnapshots: (await fs.readFile(sourcePaths.reportSnapshots, 'utf8')).replace(
      "from '@/utils/audit-history'",
      "from './audit-history.mjs'",
    ),
    score: (await fs.readFile(sourcePaths.score, 'utf8'))
      .replace("from '@/normative'", "from './normative.mjs'")
      .replace("from '@/rules'", "from './rules.mjs'")
      .replace("from '@/utils/audit-triage'", "from './audit-triage.mjs'"),
    triage: await fs.readFile(sourcePaths.triage, 'utf8'),
    i18n: `
export function t(key, params = {}) {
  return Object.entries(params).reduce(
    (message, [name, value]) => message.replace(\`{{\${name}}}\`, String(value)),
    key,
  )
}
`,
    rules: `
export function getRunnableRules() {
  return []
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
    ['audit-export.mjs', sources.export, sourcePaths.export],
    ['audit-history.mjs', sources.history, sourcePaths.history],
    ['audit-score.mjs', sources.score, sourcePaths.score],
    ['audit-triage.mjs', sources.triage, sourcePaths.triage],
    ['normative.mjs', sources.normative, sourcePaths.normative],
    ['report-snapshots.mjs', sources.reportSnapshots, sourcePaths.reportSnapshots],
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
    const [comparisonModule, exportModule, historyModule, reportSnapshotsModule] =
      await Promise.all([
        import(pathToFileURL(path.join(tempDir, 'audit-comparison.mjs')).href),
        import(pathToFileURL(path.join(tempDir, 'audit-export.mjs')).href),
        import(pathToFileURL(path.join(tempDir, 'audit-history.mjs')).href),
        import(pathToFileURL(path.join(tempDir, 'report-snapshots.mjs')).href),
      ])

    return {
      ...comparisonModule,
      ...exportModule,
      ...historyModule,
      ...reportSnapshotsModule,
    }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const {
  buildExportableAuditResult,
  compareAuditResults,
  getReportSnapshot,
  inheritViolationStateFromHistory,
  REPORT_SNAPSHOTS_STORAGE_KEY,
  saveReportSnapshot,
} = await loadAuditModules()

function createViolation(overrides = {}) {
  return {
    id: 'image-alt-text-1',
    ruleId: 'image-alt-text',
    ruleName: 'Texto alternativo em imagem',
    nbrReference: '5.2.1',
    description: 'Imagem precisa ter alternativa textual adequada.',
    severity: 'error',
    wcagLevel: 'A',
    automationCategory: 'Totalmente Automatizável',
    normativeType: 'Requisito',
    requiresHumanReview: false,
    humanReviewStatus: 'not_applicable',
    findingOrigin: 'automatic',
    findingStatus: 'open',
    message: 'Imagem sem texto alternativo suficiente.',
    snippet: '<img src="produto.png" alt="">',
    suggestion: 'Descreva a função ou conteúdo relevante da imagem.',
    remediationAdvice: 'Ajuste o atributo alt ou o nome acessível equivalente.',
    customId: 'image-alt-text-1',
    elementSelector: 'img.product',
    elementTagName: 'img',
    alternativeTextReview: {
      currentSource: 'alt',
      currentText: '',
      targetAttribute: 'alt',
      proposedText: '',
    },
    ...overrides,
  }
}

function createAuditResult(overrides = {}) {
  const violations = overrides.violations ?? []

  return {
    id: 'audit-id',
    timestamp: 1700000000000,
    url: 'https://example.com/produto',
    pageTitle: 'Produto',
    includeRecommendations: true,
    includeHumanReview: true,
    totalViolations: violations.length,
    errors: violations.length,
    warnings: 0,
    humanReviewItems: 0,
    automatedFindings: violations.length,
    violations,
    violationsByRule: {},
    violationsBySeverity: { error: violations, warning: [] },
    ...overrides,
  }
}

const inheritedResult = inheritViolationStateFromHistory(
  createAuditResult({
    id: 'current',
    violations: [
      createViolation({
        alternativeTextReview: {
          currentSource: 'aria-label',
          currentText: 'Foto do produto',
          targetAttribute: 'aria-label',
          proposedText: '',
        },
      }),
    ],
  }),
  [
    createAuditResult({
      id: 'history',
      violations: [
        createViolation({
          alternativeTextReview: {
            currentSource: 'alt',
            currentText: '',
            targetAttribute: 'alt',
            proposedText: 'Tênis azul visto de lado',
            updatedAt: 1700000001000,
          },
        }),
      ],
    }),
  ],
)

assert.equal(inheritedResult.violations[0].alternativeTextReview.currentSource, 'aria-label')
assert.equal(inheritedResult.violations[0].alternativeTextReview.currentText, 'Foto do produto')
assert.equal(
  inheritedResult.violations[0].alternativeTextReview.proposedText,
  'Tênis azul visto de lado',
)
assert.equal(inheritedResult.violations[0].inheritedFromHistory, true)

const exportedAudit = buildExportableAuditResult(inheritedResult)

assert.equal(exportedAudit.summary.findings.alternativeTextReviews, 1)
assert.equal(
  exportedAudit.audit.violations[0].alternativeTextReview.proposedText,
  'Tênis azul visto de lado',
)

const comparison = compareAuditResults(
  createAuditResult({ id: 'baseline', violations: [createViolation()] }),
  inheritedResult,
)

assert.equal(comparison.baselineAlternativeTextReviewCount, 0)
assert.equal(comparison.targetAlternativeTextReviewCount, 1)
assert.equal(comparison.alternativeTextReviewsDeltaPercentage, 100)

const storageData = {}
globalThis.chrome = {
  storage: {
    local: {
      async get(key) {
        if (typeof key === 'string') return { [key]: storageData[key] }
        return {}
      },
      async set(patch) {
        Object.assign(storageData, patch)
      },
    },
  },
}

const snapshot = await saveReportSnapshot(inheritedResult)
const storedSnapshots = storageData[REPORT_SNAPSHOTS_STORAGE_KEY]

assert.equal(Boolean(storedSnapshots[snapshot.id]), true)
assert.equal('element' in storedSnapshots[snapshot.id].auditResult.violations[0], false)

const loadedSnapshot = await getReportSnapshot(snapshot.id)

assert.equal(loadedSnapshot.id, inheritedResult.id)
assert.equal(
  loadedSnapshot.violations[0].alternativeTextReview.proposedText,
  'Tênis azul visto de lado',
)

const manifest = JSON.parse(await fs.readFile(path.resolve('public/manifest.json'), 'utf8'))
const viteConfig = await fs.readFile(path.resolve('vite.config.ts'), 'utf8')
const devtoolsSource = await fs.readFile(path.resolve('src/devtools.ts'), 'utf8')
const devtoolsPanelSource = await fs.readFile(path.resolve('src/devtools-panel.tsx'), 'utf8')
const devtoolsPanelAppSource = await fs.readFile(
  path.resolve('src/components/DevToolsPanelApp.tsx'),
  'utf8',
)
const popupSource = await fs.readFile(path.resolve('src/components/PopupApp.tsx'), 'utf8')

assert.equal(manifest.devtools_page, 'src/devtools.html')
assert.match(viteConfig, /devtoolsPanel/)
assert.match(devtoolsSource, /chrome\.devtools\.panels\.create/)
assert.match(devtoolsPanelSource, /DevToolsPanelApp/)
assert.match(devtoolsPanelAppSource, /chrome\.devtools\?\.inspectedWindow\?\.tabId/)
assert.match(devtoolsPanelAppSource, /surface="devtools"/)
assert.match(devtoolsPanelAppSource, /targetTab=\{targetTab\}/)
assert.match(popupSource, /surface\?: 'popup' \| 'devtools'/)

console.log('Alternative text, report snapshot and DevTools checks passed.')
