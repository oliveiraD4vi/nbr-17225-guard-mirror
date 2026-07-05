import {
  assertExtensionRuntimeAvailable,
  EXTENSION_CONTEXT_INVALIDATED_MESSAGE,
  isExtensionContextInvalidatedError,
} from './extension-runtime'

type StorageGetKeys = string | string[] | Record<string, unknown> | null
type StorageUsageKeys = string | string[] | null

interface StorageProxyResponse<T> {
  data?: T
  error?: string
}

function getLocalStorageArea(): typeof chrome.storage.local | undefined {
  return typeof chrome !== 'undefined' ? chrome.storage?.local : undefined
}

async function sendStorageRequest<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  assertExtensionRuntimeAvailable()

  let response: StorageProxyResponse<T>
  try {
    response = (await chrome.runtime.sendMessage({
      action,
      ...payload,
    })) as StorageProxyResponse<T>
  } catch (error) {
    if (isExtensionContextInvalidatedError(error)) {
      throw new Error(EXTENSION_CONTEXT_INVALIDATED_MESSAGE)
    }

    throw error
  }

  if (response?.error) throw new Error(response.error)
  if (!response || !Object.prototype.hasOwnProperty.call(response, 'data')) {
    throw new Error('O armazenamento local da extensão não está disponível.')
  }
  return response.data as T
}

export async function extensionStorageGet(
  keys: StorageGetKeys = null,
): Promise<Record<string, unknown>> {
  const storageArea = getLocalStorageArea()
  if (storageArea) return storageArea.get(keys)
  return sendStorageRequest<Record<string, unknown>>('STORAGE_LOCAL_GET', { keys })
}

export async function extensionStorageSet(items: Record<string, unknown>): Promise<void> {
  const storageArea = getLocalStorageArea()
  if (storageArea) {
    await storageArea.set(items)
    return
  }
  await sendStorageRequest<true>('STORAGE_LOCAL_SET', { items })
}

export async function extensionStorageGetBytesInUse(
  keys: StorageUsageKeys = null,
): Promise<number> {
  const storageArea = getLocalStorageArea()
  if (storageArea) return storageArea.getBytesInUse(keys)
  return sendStorageRequest<number>('STORAGE_LOCAL_GET_BYTES_IN_USE', { keys })
}

export async function extensionStorageGetQuotaBytes(): Promise<number | undefined> {
  const storageArea = getLocalStorageArea()
  if (storageArea) return storageArea.QUOTA_BYTES
  return sendStorageRequest<number | undefined>('STORAGE_LOCAL_GET_QUOTA_BYTES')
}
