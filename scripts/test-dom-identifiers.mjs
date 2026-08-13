import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadUtilities() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dom-identifiers-'))
  const sourcePath = path.resolve('src/utils/index.ts')
  const source = (await fs.readFile(sourcePath, 'utf8'))
    .replace("from '@/normative'", "from './normative.mjs'")
    .replaceAll("from '@/types'", "from './types.mjs'")
    .replace("from '@/utils/audit-contract'", "from './audit-contract.mjs'")
    .replace("from '@/utils/manual-findings'", "from './manual-findings.mjs'")

  await Promise.all([
    fs.writeFile(
      path.join(tempDir, 'normative.mjs'),
      "export function getNormativeRuleType() { return 'Requisito' }\n",
      'utf8',
    ),
    fs.writeFile(
      path.join(tempDir, 'types.mjs'),
      'export function isFullyAutomatedCategory() { return true }\n',
      'utf8',
    ),
    fs.writeFile(
      path.join(tempDir, 'audit-contract.mjs'),
      [
        'export function getDefaultReviewQuestion() { return undefined }',
        "export function getFindingConfidence() { return 'high' }",
        "export function getRuleAuditScope() { return 'page' }",
        "export function getRuleVerificationMode() { return 'automatic' }",
      ].join('\n'),
      'utf8',
    ),
    fs.writeFile(
      path.join(tempDir, 'manual-findings.mjs'),
      [
        "export const MANUAL_FINDING_SELECTION_HOST_ID = 'nbr-manual-finding-selection-host'",
        "export const MANUAL_FINDING_SELECTION_ID_PREFIX = 'nbr-manual-finding-selection-'",
      ].join('\n'),
      'utf8',
    ),
    fs.writeFile(
      path.join(tempDir, 'utils.mjs'),
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: sourcePath,
      }).outputText,
      'utf8',
    ),
  ])

  try {
    return await import(pathToFileURL(path.join(tempDir, 'utils.mjs')).href)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

class FakeHTMLElement {
  constructor(idAttribute = '', clobberedId = '') {
    this.idAttribute = idAttribute
    this.id = clobberedId
    this.parentElement = null
  }

  getAttribute(name) {
    return name === 'id' && this.idAttribute ? this.idAttribute : null
  }

  closest() {
    return null
  }
}

globalThis.HTMLElement = FakeHTMLElement
globalThis.SVGElement = class FakeSVGElement extends FakeHTMLElement {}
globalThis.CSS = { escape: (value) => value }

const { getElementIdAttribute, getElementSelector, isGuardInjectedElement } = await loadUtilities()

const clobberedForm = new FakeHTMLElement('audit-form', { tagName: 'INPUT' })
assert.equal(typeof clobberedForm.id, 'object')
assert.equal(getElementIdAttribute(clobberedForm), 'audit-form')
assert.equal(getElementSelector(clobberedForm), '#audit-form')
assert.equal(isGuardInjectedElement(clobberedForm), false)

const guardElement = new FakeHTMLElement('nbr-highlight-example', { tagName: 'INPUT' })
assert.equal(isGuardInjectedElement(guardElement), true)

const elementWithoutId = new FakeHTMLElement('', { tagName: 'INPUT' })
assert.equal(getElementIdAttribute(elementWithoutId), '')

console.log('DOM identifier checks passed.')
