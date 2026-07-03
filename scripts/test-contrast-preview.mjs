import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadContrastPreviewModule() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'contrast-preview-'))
  const sourcePath = path.resolve('src/utils/contrast-preview.ts')
  const source = (await fs.readFile(sourcePath, 'utf8')).replaceAll(
    "from '@/types'",
    "from './types.mjs'",
  )
  await fs.writeFile(path.join(tempDir, 'types.mjs'), '', 'utf8')
  await fs.writeFile(
    path.join(tempDir, 'contrast-preview.mjs'),
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      fileName: sourcePath,
    }).outputText,
    'utf8',
  )

  try {
    return await import(pathToFileURL(path.join(tempDir, 'contrast-preview.mjs')).href)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

class FakeStyle {
  values = new Map()

  getPropertyValue(property) {
    return this.values.get(property)?.value ?? ''
  }

  getPropertyPriority(property) {
    return this.values.get(property)?.priority ?? ''
  }

  setProperty(property, value, priority = '') {
    this.values.set(property, { value, priority })
  }

  removeProperty(property) {
    const previous = this.getPropertyValue(property)
    this.values.delete(property)
    return previous
  }
}

const {
  applyInlinePreviewStyle,
  captureInlineStyle,
  getContrastPreviewProperties,
  restoreInlineStyle,
} = await loadContrastPreviewModule()

assert.deepEqual(getContrastPreviewProperties('text'), {
  foreground: 'color',
  background: 'background-color',
})
assert.deepEqual(getContrastPreviewProperties('component'), {
  foreground: 'border-color',
  background: 'background-color',
})
assert.deepEqual(getContrastPreviewProperties('focus'), {
  foreground: 'outline-color',
  background: 'background-color',
})
assert.deepEqual(getContrastPreviewProperties('graphic', 'stroke'), {
  foreground: 'stroke',
  background: 'background-color',
})
assert.equal(getContrastPreviewProperties('graphic'), null)

const styleWithInlineValue = new FakeStyle()
styleWithInlineValue.setProperty('color', '#123456', 'important')
const originalColor = captureInlineStyle(styleWithInlineValue, 'color')
applyInlinePreviewStyle(styleWithInlineValue, 'color', '#abcdef')
assert.equal(styleWithInlineValue.getPropertyValue('color'), '#abcdef')
assert.equal(styleWithInlineValue.getPropertyPriority('color'), 'important')
restoreInlineStyle(styleWithInlineValue, 'color', originalColor)
assert.equal(styleWithInlineValue.getPropertyValue('color'), '#123456')
assert.equal(styleWithInlineValue.getPropertyPriority('color'), 'important')

const styleWithoutInlineValue = new FakeStyle()
const originalBackground = captureInlineStyle(styleWithoutInlineValue, 'background-color')
applyInlinePreviewStyle(styleWithoutInlineValue, 'background-color', '#ffffff')
restoreInlineStyle(styleWithoutInlineValue, 'background-color', originalBackground)
assert.equal(styleWithoutInlineValue.getPropertyValue('background-color'), '')

const contentSource = await fs.readFile(path.resolve('src/content.ts'), 'utf8')
const popupSource = await fs.readFile(path.resolve('src/components/PopupApp.tsx'), 'utf8')
const violationsSource = await fs.readFile(
  path.resolve('src/components/ViolationsList.tsx'),
  'utf8',
)

assert.match(contentSource, /SYNC_CONTRAST_PREVIEWS/)
assert.match(contentSource, /CLEAR_CONTRAST_PREVIEWS/)
assert.match(contentSource, /port\.onDisconnect\.addListener\(clearContrastPreviews\)/)
assert.match(contentSource, /window\.addEventListener\('pagehide', clearContrastPreviews\)/)
assert.match(contentSource, /document\.querySelector<HTMLElement>\(preview\.selector\)/)
assert.match(popupSource, /isHistoricalView \|\| !canRerunViewedAudit/)
assert.match(popupSource, /contrast-preview-session/)
assert.match(violationsSource, /window\.setTimeout\(\(\) => \{/)
assert.match(violationsSource, /contrastPagePreviewNote/)

console.log('Contrast preview checks passed.')
