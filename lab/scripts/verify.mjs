import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve('lab')
const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'))
const panel = await fs.readFile(path.join(root, 'panel.html'), 'utf8')
const script = await fs.readFile(path.join(root, 'panel.js'), 'utf8')
const styles = await fs.readFile(path.join(root, 'styles.css'), 'utf8')

assert.equal(manifest.name, 'Guardião Lab')
assert.deepEqual(manifest.permissions, ['debugger'])
assert.equal(manifest.devtools_page, 'devtools.html')
assert.match(panel, /lang="pt-BR"/)
assert.match(panel, /Guardião Lab não é um leitor de tela/)
assert.match(panel, /Prévia de leitura sintetizada/)
assert.match(panel, /role="tree"/)
assert.match(script, /Accessibility\.getFullAXTree/)
assert.match(script, /chrome\.debugger\.detach/)
assert.match(script, /Page\.frameNavigated/)
assert.doesNotMatch(script, /fetch\(|XMLHttpRequest|storage\./)
assert.match(styles, /prefers-reduced-motion/)
assert.match(styles, /forced-colors: active/)

console.log('Guardião Lab verificado: manifesto isolado, CDP, desconexão e privacidade local.')
