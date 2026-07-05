import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

async function loadExtensionStorageModule() {
  const sourcePath = path.resolve('src/utils/extension-storage.ts')
  const runtimeSourcePath = path.resolve('src/utils/extension-runtime.ts')
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'extension-storage-'))
  const modulePath = path.join(tempDir, 'extension-storage.mjs')
  const source = (await fs.readFile(sourcePath, 'utf8')).replace(
    "from './extension-runtime'",
    "from './extension-runtime.mjs'",
  )
  const runtimeSource = await fs.readFile(runtimeSourcePath, 'utf8')

  await Promise.all([
    fs.writeFile(
      modulePath,
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: sourcePath,
      }).outputText,
      'utf8',
    ),
    fs.writeFile(
      path.join(tempDir, 'extension-runtime.mjs'),
      ts.transpileModule(runtimeSource, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: runtimeSourcePath,
      }).outputText,
      'utf8',
    ),
  ])

  try {
    return await import(pathToFileURL(modulePath).href)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const {
  extensionStorageGet,
  extensionStorageGetBytesInUse,
  extensionStorageGetQuotaBytes,
  extensionStorageSet,
} = await loadExtensionStorageModule()

const directCalls = []
globalThis.chrome = {
  runtime: {
    id: 'extension-id',
    sendMessage: async () => {
      throw new Error('O proxy não deve ser usado quando storage.local está disponível.')
    },
  },
  storage: {
    local: {
      QUOTA_BYTES: 10_485_760,
      get: async (keys) => {
        directCalls.push(['get', keys])
        return { auditResultsByTab: { 7: { id: 'audit-direct' } } }
      },
      set: async (items) => {
        directCalls.push(['set', items])
      },
      getBytesInUse: async (keys) => {
        directCalls.push(['getBytesInUse', keys])
        return 512
      },
    },
  },
}

assert.equal(
  (await extensionStorageGet('auditResultsByTab')).auditResultsByTab[7].id,
  'audit-direct',
)
await extensionStorageSet({ includeRecommendationsPreference: true })
assert.equal(await extensionStorageGetBytesInUse(null), 512)
assert.equal(await extensionStorageGetQuotaBytes(), 10_485_760)
assert.deepEqual(directCalls, [
  ['get', 'auditResultsByTab'],
  ['set', { includeRecommendationsPreference: true }],
  ['getBytesInUse', null],
])

const proxyCalls = []
globalThis.chrome = {
  runtime: {
    id: 'extension-id',
    sendMessage: async (request) => {
      proxyCalls.push(request)
      switch (request.action) {
        case 'STORAGE_LOCAL_GET':
          return { data: { auditResultsByTab: { 9: { id: 'audit-proxy' } } } }
        case 'STORAGE_LOCAL_SET':
          return { data: true }
        case 'STORAGE_LOCAL_GET_BYTES_IN_USE':
          return { data: 1024 }
        case 'STORAGE_LOCAL_GET_QUOTA_BYTES':
          return { data: 10_485_760 }
        default:
          return { error: 'Ação de armazenamento desconhecida.' }
      }
    },
  },
}

assert.equal(
  (await extensionStorageGet('auditResultsByTab')).auditResultsByTab[9].id,
  'audit-proxy',
)
await extensionStorageSet({ includeRecommendationsPreference: false })
assert.equal(await extensionStorageGetBytesInUse(null), 1024)
assert.equal(await extensionStorageGetQuotaBytes(), 10_485_760)
assert.deepEqual(proxyCalls, [
  { action: 'STORAGE_LOCAL_GET', keys: 'auditResultsByTab' },
  {
    action: 'STORAGE_LOCAL_SET',
    items: { includeRecommendationsPreference: false },
  },
  { action: 'STORAGE_LOCAL_GET_BYTES_IN_USE', keys: null },
  { action: 'STORAGE_LOCAL_GET_QUOTA_BYTES' },
])

globalThis.chrome.runtime.sendMessage = async () => ({ status: 'UNKNOWN_ACTION' })
await assert.rejects(
  () => extensionStorageGet('auditResultsByTab'),
  /armazenamento local da extensão não está disponível/,
)

const workspaceSource = await fs.readFile('src/components/AuditWorkspaceApp.tsx', 'utf8')
const backgroundSource = await fs.readFile('src/background.ts', 'utf8')

assert.doesNotMatch(workspaceSource, /chrome\.storage/)
assert.match(backgroundSource, /case 'STORAGE_LOCAL_GET'/)
assert.match(backgroundSource, /case 'STORAGE_LOCAL_SET'/)
assert.match(backgroundSource, /MANUAL_FINDING_DRAFT_CHANGED/)

console.log('Extension storage checks passed.')
