import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadBulkActionModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-bulk-actions-'))
  const sourcePath = path.resolve('src/utils/audit-bulk-actions.ts')
  const source = await fs.readFile(sourcePath, 'utf8')

  await fs.writeFile(
    path.join(tempDir, 'audit-bulk-actions.mjs'),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: sourcePath,
    }).outputText,
    'utf8',
  )

  try {
    return await import(pathToFileURL(path.join(tempDir, 'audit-bulk-actions.mjs')).href)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const { areSimilarViolations, countSimilarViolations, getViolationSimilarityKey } =
  await loadBulkActionModule()

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
    findingOrigin: 'automatic',
    findingStatus: 'open',
    message: 'Mensagem',
    snippet: '<button>Enviar</button>',
    suggestion: 'Sugestão',
    remediationAdvice: 'Correção',
    elementTagName: 'button',
    elementSelector: '#target',
    customId: 'custom-id',
    ...overrides,
  }
}

function createContrastDetails(overrides = {}) {
  return {
    foregroundHex: '#777777',
    backgroundHex: '#ffffff',
    comparisonHex: '#777777',
    context: 'text',
    measuredRatio: 3.2,
    minimumRatio: 4.5,
    fontSizePx: 14,
    isLargeText: false,
    ...overrides,
  }
}

const contrastBase = createViolation({
  id: 'contrast-1',
  ruleId: 'contrast',
  message: 'Contraste insuficiente',
  elementSelector: '.steps li:nth-child(1)',
  contrastDetails: createContrastDetails(),
})
const contrastSimilar = createViolation({
  id: 'contrast-2',
  ruleId: 'contrast',
  message: 'Texto diferente não altera o lote de contraste',
  elementSelector: '.steps li:nth-child(2)',
  contrastDetails: createContrastDetails({ foregroundHex: '#777777', backgroundHex: '#FFFFFF' }),
})
const contrastDifferentColor = createViolation({
  id: 'contrast-3',
  ruleId: 'contrast',
  elementSelector: '.steps li:nth-child(3)',
  contrastDetails: createContrastDetails({ foregroundHex: '#666666' }),
})

assert.equal(areSimilarViolations(contrastBase, contrastSimilar), true)
assert.equal(areSimilarViolations(contrastBase, contrastDifferentColor), false)
assert.equal(getViolationSimilarityKey(contrastBase), getViolationSimilarityKey(contrastSimilar))

const genericBase = createViolation({
  id: 'generic-1',
  ruleId: 'label',
  message: 'Campo sem rótulo',
  suggestion: 'Adicione um rótulo',
  remediationAdvice: 'Associe label e campo.',
  elementTagName: 'input',
  elementSelector: '#email',
})
const genericSimilar = createViolation({
  id: 'generic-2',
  ruleId: 'label',
  message: '  Campo sem rótulo  ',
  suggestion: 'Adicione um rótulo',
  remediationAdvice: 'Associe label e campo.',
  elementTagName: 'INPUT',
  elementSelector: '#telefone',
})
const genericDifferentElement = createViolation({
  id: 'generic-3',
  ruleId: 'label',
  message: 'Campo sem rótulo',
  suggestion: 'Adicione um rótulo',
  remediationAdvice: 'Associe label e campo.',
  elementTagName: 'button',
})
const ignoredGenericSimilar = createViolation({
  ...genericSimilar,
  id: 'generic-ignored',
  findingStatus: 'ignored',
  ignoreReason: 'duplicate',
})

assert.equal(areSimilarViolations(genericBase, genericSimilar), true)
assert.equal(areSimilarViolations(genericBase, genericDifferentElement), false)
assert.equal(
  countSimilarViolations(contrastBase, [
    contrastBase,
    contrastSimilar,
    contrastDifferentColor,
    genericBase,
  ]),
  2,
)
assert.equal(
  countSimilarViolations(genericBase, [genericBase, genericSimilar, ignoredGenericSimilar]),
  3,
)
assert.equal(
  countSimilarViolations(
    genericBase,
    [genericBase, genericSimilar, ignoredGenericSimilar],
    (violation) => violation.findingStatus !== 'ignored',
  ),
  2,
)

const popupSource = await fs.readFile(
  path.resolve('src/components/AuditWorkspaceApp.tsx'),
  'utf8',
)
const violationsListSource = await fs.readFile(
  path.resolve('src/components/ViolationsList.tsx'),
  'utf8',
)
const summarySource = await fs.readFile(
  path.resolve('src/components/ViolationsSummary.tsx'),
  'utf8',
)
const scoreSource = await fs.readFile(path.resolve('src/utils/audit-score.ts'), 'utf8')
const reportSource = await fs.readFile(path.resolve('src/report.tsx'), 'utf8')

assert.match(popupSource, /const defaultIncludeHumanReview = true/)
assert.match(popupSource, /const showHumanReviewScopeToggle = false/)
assert.match(popupSource, /showHumanReviewScopeToggle &&/)

const highlightActionStart = popupSource.indexOf("key: 'highlight'")
const priorityActionStart = popupSource.indexOf("key: 'priority'")
const csvActionStart = popupSource.indexOf("key: 'csv'")
const jsonActionStart = popupSource.indexOf("key: 'json'")
const reportActionStart = popupSource.indexOf("key: 'report'")
const reportActionEnd = popupSource.indexOf(']', reportActionStart)

assert.ok(highlightActionStart > 0)
assert.ok(priorityActionStart > highlightActionStart)
assert.ok(csvActionStart > priorityActionStart)
assert.ok(jsonActionStart > csvActionStart)
assert.ok(reportActionStart > jsonActionStart)
assert.doesNotMatch(popupSource.slice(jsonActionStart, reportActionStart), /type: 'primary'/)
assert.match(popupSource.slice(reportActionStart, reportActionEnd), /type: 'primary'/)
assert.doesNotMatch(popupSource.slice(highlightActionStart, priorityActionStart), /type: 'primary'/)
assert.match(popupSource, /downloadLabel \? 'footer-download-action' : 'footer-icon-action'/)
assert.match(popupSource, /shape=\{downloadLabel \? undefined : 'circle'\}/)
assert.match(popupSource, /aria-label=\{action\.label\}/)

assert.doesNotMatch(violationsListSource, /findingActionConfirm|findingTriage/)
assert.match(violationsListSource, /findingActionIgnoreSimilar/)
assert.match(violationsListSource, /contrastApplyToSimilar/)

assert.match(summarySource, /summary-score-metrics/)
assert.match(summarySource, /aria-expanded=\{isScorePanelOpen\}/)
assert.match(summarySource, /useState\(\{ key: resultKey, open: false \}\)/)
assert.match(summarySource, /scorePanelActionableFindings/)
assert.doesNotMatch(summarySource, /summary-score-fact-grid|summary-review-progress/)
assert.doesNotMatch(summarySource, /pendingHumanReviewScore|provisionalScore/)
assert.doesNotMatch(summarySource, /summary-status-pill|summary-meta-item|actionRequired/)
assert.match(popupSource, /handleCopyAuditUrl/)
assert.match(popupSource, /displayedAuditResult\?\.pageTitle \|\| activeTab\?\.title/)
assert.doesNotMatch(reportSource, /getPendingHumanReviewCount|pendingReviews/)
assert.match(scoreSource, /isProvisional: false/)

console.log('Audit bulk action checks passed.')
