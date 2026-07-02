/**
 * Motor de auditoria de acessibilidade
 */
import { t } from '@/i18n'
import { getNormativeRuleType } from '@/normative'
import type { AuditHistoryEntry, AuditResult } from '@/types'
import {
  compactAuditResultForStorage,
  dedupeAndSortAuditHistory,
  getDisplayAuditResult,
  getAuditSiteStorageKey,
  getAuditUrlStorageKey,
  hydrateAuditResult,
  inheritViolationStateFromHistory,
} from '@/utils/audit-history'
import { normalizeViolationFindingState } from '@/utils/audit-triage'

export class AuditStorageQuotaError extends Error {
  readonly code = 'quota_exceeded'

  constructor(message = t('engine.quotaExceeded')) {
    super(message)
    this.name = 'AuditStorageQuotaError'
  }
}

interface RunAuditOptions {
  includeRecommendations?: boolean
  includeHumanReview?: boolean
}

export interface AuditStorageDiagnostics {
  currentUrlEntryCount: number
  historyEntryCount: number
  level: 'ok' | 'warning' | 'critical'
  quotaBytes: number
  tabSnapshotCount: number
  urlCount: number
  usageRatio: number
  usedBytes: number
}

const STORAGE_WARNING_RATIO = 0.7
const STORAGE_CRITICAL_RATIO = 0.85
const FALLBACK_STORAGE_QUOTA_BYTES = 10 * 1024 * 1024

export async function getActiveTab(): Promise<chrome.tabs.Tab & { id: number }> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const activeTab = tabs[0]

  if (!activeTab?.id) {
    throw new Error(t('engine.noActiveTab'))
  }

  return activeTab as chrome.tabs.Tab & { id: number }
}

function getTabStorageKey(tabId: number): string {
  return String(tabId)
}

function normalizeAuditResult<T extends AuditResult>(result: T | null): T | null {
  if (!result) return null

  const violations = result.violations.map((violation) =>
    normalizeViolationFindingState({
      ...violation,
      normativeType: violation.normativeType ?? getNormativeRuleType(violation.nbrReference),
      humanReviewStatus:
        violation.humanReviewStatus ??
        (violation.requiresHumanReview ? 'pending' : 'not_applicable'),
    }),
  )
  const auditId = result.id || `${getAuditUrlStorageKey(result.url)}|${result.timestamp}`

  return hydrateAuditResult({
    ...result,
    id: auditId,
    includeRecommendations: result.includeRecommendations ?? true,
    includeHumanReview: result.includeHumanReview ?? true,
    violations,
    pageTitle: result.pageTitle ?? '',
  })
}

/**
 * Executa a auditoria de acessibilidade na aba ativa
 */
export async function runAccessibilityAudit(options: RunAuditOptions = {}): Promise<AuditResult> {
  try {
    const activeTab = await getActiveTab()

    if (!activeTab.url || !isSupportedTabUrl(activeTab.url)) {
      throw new Error(t('engine.unsupportedUrl'))
    }

    await ensureContentScriptReady(activeTab.id)

    const response = await chrome.tabs.sendMessage(activeTab.id, {
      action: 'RUN_AUDIT',
      includeRecommendations: options.includeRecommendations ?? false,
      includeHumanReview: options.includeHumanReview ?? true,
    })

    if (response?.error) {
      throw new Error(response.error)
    }

    if (!response?.result) {
      throw new Error(t('engine.contentExecutionError'))
    }

    const result: AuditResult = normalizeAuditResult(response.result)!
    result.url = activeTab.url
    result.timestamp = Date.now()
    result.includeRecommendations = options.includeRecommendations ?? false
    result.includeHumanReview = options.includeHumanReview ?? true

    return result
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao executar auditoria:', error)
    throw error
  }
}

export async function ensureContentScriptReady(tabId: number): Promise<void> {
  if (await pingContentScript(tabId)) return

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-bootstrap.js'],
    })
  } catch (error) {
    console.warn('[Guardião NBR 17225] Erro ao injetar content script:', error)
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await pingContentScript(tabId)) return
    await new Promise((resolve) => setTimeout(resolve, 150))
  }

  throw new Error(t('engine.domUnavailable'))
}

async function pingContentScript(tabId: number): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { action: 'PING' })
    return response?.status === 'OK'
  } catch {
    return false
  }
}

function isSupportedTabUrl(url: string): boolean {
  return /^(https?:|file:)/.test(url)
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { message?: string }
  return candidate.message?.toLowerCase().includes('quota') ?? false
}

function throwIfQuotaExceeded(error: unknown): never {
  if (isQuotaExceededError(error)) {
    throw new AuditStorageQuotaError()
  }

  throw error
}

function getStorageQuotaBytes(): number {
  const configuredQuota = chrome.storage.local.QUOTA_BYTES
  return typeof configuredQuota === 'number' && configuredQuota > 0
    ? configuredQuota
    : FALLBACK_STORAGE_QUOTA_BYTES
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isImportedViolationCandidate(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.ruleId === 'string' &&
    typeof value.ruleName === 'string' &&
    typeof value.nbrReference === 'string' &&
    typeof value.description === 'string' &&
    typeof value.message === 'string' &&
    typeof value.suggestion === 'string' &&
    typeof value.remediationAdvice === 'string'
  )
}

export function parseImportedAuditReport(payload: unknown): AuditHistoryEntry {
  if (!isRecord(payload)) {
    throw new Error(t('engine.invalidImportReport'))
  }

  const candidate = isRecord(payload.audit) ? payload.audit : payload
  if (!isRecord(candidate)) {
    throw new Error(t('engine.invalidImportReport'))
  }

  const timestamp =
    typeof candidate.timestamp === 'number'
      ? candidate.timestamp
      : Number(candidate.timestamp)

  if (
    typeof candidate.url !== 'string' ||
    candidate.url.trim().length === 0 ||
    !Number.isFinite(timestamp) ||
    !Array.isArray(candidate.violations) ||
    candidate.violations.some((violation) => !isImportedViolationCandidate(violation))
  ) {
    throw new Error(t('engine.invalidImportReport'))
  }

  return normalizeAuditResult({
    ...(candidate as unknown as AuditResult),
    timestamp,
    url: candidate.url,
  }) as AuditHistoryEntry
}

/**
 * Reseta o cache de auditoria da aba ativa
 */
export async function resetAuditCache(): Promise<void> {
  try {
    const activeTab = await getActiveTab()
    const data = await chrome.storage.local.get('auditResultsByTab')
    const auditResultsByTab = {
      ...(data.auditResultsByTab as Record<string, AuditResult> | undefined),
    }

    delete auditResultsByTab[getTabStorageKey(activeTab.id)]

    await chrome.storage.local.set({
      auditResultsByTab,
    })

    console.log('[Guardião NBR 17225] Cache de auditoria limpo para a aba ativa')
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao limpar cache:', error)
  }
}

/**
 * Salva resultado da auditoria no storage
 */
export async function saveAuditResult(result: AuditResult, tabId?: number): Promise<AuditResult> {
  try {
    const resolvedTabId = tabId ?? (await getActiveTab()).id
    const data = await chrome.storage.local.get(['auditResultsByTab', 'auditHistoryByUrl'])
    const urlKey = getAuditUrlStorageKey(result.url)
    const history =
      (data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}
    const currentHistory = (history[urlKey] ?? []).map(
      (entry) => normalizeAuditResult(entry) as AuditHistoryEntry,
    )
    const normalizedResult = inheritViolationStateFromHistory(
      normalizeAuditResult(result)!,
      currentHistory,
    )
    const historyEntry: AuditHistoryEntry = normalizedResult as AuditHistoryEntry
    const auditResultsByTab = {
      ...(data.auditResultsByTab as Record<string, AuditResult> | undefined),
      [getTabStorageKey(resolvedTabId)]: compactAuditResultForStorage(normalizedResult),
    }
    const auditHistoryByUrl = {
      ...history,
      [urlKey]: dedupeAndSortAuditHistory([historyEntry, ...currentHistory]).map((entry) =>
        compactAuditResultForStorage(entry),
      ),
    }

    await chrome.storage.local.set({
      auditResultsByTab,
      auditHistoryByUrl,
    })

    console.log('[Guardião NBR 17225] Resultado da auditoria salvo')
    return normalizedResult
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao salvar resultado:', error)
    throwIfQuotaExceeded(error)
    throw error
  }
}

/**
 * Recupera resultado da auditoria do storage
 */
export async function getAuditResult(
  tabId?: number,
  currentUrl?: string,
): Promise<AuditResult | null> {
  try {
    const resolvedTabId = tabId ?? (await getActiveTab()).id
    const data = await chrome.storage.local.get('auditResultsByTab')
    const auditResultsByTab = data.auditResultsByTab as Record<string, AuditResult> | undefined
    const result = normalizeAuditResult(auditResultsByTab?.[getTabStorageKey(resolvedTabId)] || null)
    if (
      result &&
      currentUrl &&
      getAuditUrlStorageKey(result.url) !== getAuditUrlStorageKey(currentUrl)
    ) {
      return null
    }
    return result
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao recuperar resultado:', error)
    return null
  }
}

export async function deleteAuditHistoryEntry(
  url: string,
  historyId: string,
): Promise<AuditHistoryEntry[]> {
  try {
    const data = await chrome.storage.local.get('auditHistoryByUrl')
    const auditHistoryByUrl = {
      ...((data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}),
    }
    const urlKey = getAuditUrlStorageKey(url)
    const currentHistory = auditHistoryByUrl[urlKey] ?? []
    auditHistoryByUrl[urlKey] = currentHistory.filter((entry) => entry.id !== historyId)

    auditHistoryByUrl[urlKey] = auditHistoryByUrl[urlKey].map((entry) =>
      compactAuditResultForStorage(normalizeAuditResult(entry) as AuditHistoryEntry),
    )

    await chrome.storage.local.set({ auditHistoryByUrl })
    return dedupeAndSortAuditHistory(
      auditHistoryByUrl[urlKey].map((entry) => normalizeAuditResult(entry) as AuditHistoryEntry),
    )
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao remover histórico:', error)
    return []
  }
}

export function getDisplayResultForScope(
  result: AuditResult | null,
  includeRecommendations: boolean,
  includeHumanReview = true,
): AuditResult | null {
  return result ? getDisplayAuditResult(result, includeRecommendations, includeHumanReview) : null
}

export async function getAuditHistoryForUrl(url?: string): Promise<AuditHistoryEntry[]> {
  try {
    const resolvedUrl = url ?? (await getActiveTab()).url
    if (!resolvedUrl) return []

    const data = await chrome.storage.local.get('auditHistoryByUrl')
    const auditHistoryByUrl = data.auditHistoryByUrl as
      | Record<string, AuditHistoryEntry[]>
      | undefined
    return dedupeAndSortAuditHistory(
      (auditHistoryByUrl?.[getAuditUrlStorageKey(resolvedUrl)] || []).map(
        (entry) => normalizeAuditResult(entry) as AuditHistoryEntry,
      ),
    )
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao recuperar histórico:', error)
    return []
  }
}

export async function getAuditHistoryForSite(url?: string): Promise<AuditHistoryEntry[]> {
  try {
    const resolvedUrl = url ?? (await getActiveTab()).url
    if (!resolvedUrl) return []

    const currentUrlKey = getAuditUrlStorageKey(resolvedUrl)
    const siteKey = getAuditSiteStorageKey(resolvedUrl)
    const data = await chrome.storage.local.get('auditHistoryByUrl')
    const auditHistoryByUrl =
      (data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}

    const latestEntriesByUrl = Object.entries(auditHistoryByUrl)
      .filter(([urlKey]) => urlKey !== currentUrlKey && getAuditSiteStorageKey(urlKey) === siteKey)
      .map(([, entries]) =>
        dedupeAndSortAuditHistory(
          entries.map((entry) => normalizeAuditResult(entry) as AuditHistoryEntry),
          1,
        )[0],
      )
      .filter((entry): entry is AuditHistoryEntry => Boolean(entry))
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 20)

    return latestEntriesByUrl
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao recuperar histórico do site:', error)
    return []
  }
}

export async function importAuditReportToHistory(
  importedResult: AuditResult,
): Promise<{ entry: AuditHistoryEntry; history: AuditHistoryEntry[]; urlKey: string }> {
  try {
    const data = await chrome.storage.local.get('auditHistoryByUrl')
    const auditHistoryByUrl = {
      ...((data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}),
    }
    const normalizedEntry = {
      ...(normalizeAuditResult(importedResult) as AuditHistoryEntry),
      importedAt: Date.now(),
    }
    const urlKey = getAuditUrlStorageKey(normalizedEntry.url)
    const currentHistory = (auditHistoryByUrl[urlKey] ?? []).map(
      (entry) => normalizeAuditResult(entry) as AuditHistoryEntry,
    )
    const history = dedupeAndSortAuditHistory([normalizedEntry, ...currentHistory])

    auditHistoryByUrl[urlKey] = history.map((entry) => compactAuditResultForStorage(entry))

    await chrome.storage.local.set({ auditHistoryByUrl })

    return { entry: normalizedEntry, history, urlKey }
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao importar relatório:', error)
    throwIfQuotaExceeded(error)
    throw error
  }
}

export async function updateStoredAuditResult(
  updatedResult: AuditResult,
  tabId?: number,
): Promise<void> {
  try {
    const normalizedResult = normalizeAuditResult(updatedResult)
    if (!normalizedResult) return

    const resolvedTabId = tabId ?? (await getActiveTab()).id
    const data = await chrome.storage.local.get([
      'auditResultsByTab',
      'auditHistoryByUrl',
    ])
    const auditResultsByTab = {
      ...(data.auditResultsByTab as Record<string, AuditResult> | undefined),
    }
    const currentTabResult = auditResultsByTab[getTabStorageKey(resolvedTabId)]

    if (currentTabResult?.id === normalizedResult.id) {
      auditResultsByTab[getTabStorageKey(resolvedTabId)] =
        compactAuditResultForStorage(normalizedResult)
    }

    const auditHistoryByUrl = {
      ...((data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}),
    }
    const urlKey = getAuditUrlStorageKey(normalizedResult.url)
    const currentHistory = auditHistoryByUrl[urlKey] ?? []
    auditHistoryByUrl[urlKey] = dedupeAndSortAuditHistory(
      currentHistory.map((entry) =>
        compactAuditResultForStorage(
          normalizeAuditResult(
            entry.id === normalizedResult.id ? (normalizedResult as AuditHistoryEntry) : entry,
          ) as AuditHistoryEntry,
        ),
      ),
    )

    await chrome.storage.local.set({
      auditResultsByTab,
      auditHistoryByUrl,
    })
  } catch (error) {
    console.error('[Guardião NBR 17225] Erro ao atualizar auditoria persistida:', error)
    throwIfQuotaExceeded(error)
  }
}

export function isAuditStorageQuotaError(error: unknown): error is AuditStorageQuotaError {
  return error instanceof AuditStorageQuotaError
}

export async function clearAuditHistoryForUrl(url: string): Promise<AuditHistoryEntry[]> {
  const data = await chrome.storage.local.get('auditHistoryByUrl')
  const auditHistoryByUrl = {
    ...((data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}),
  }
  const urlKey = getAuditUrlStorageKey(url)
  delete auditHistoryByUrl[urlKey]

  await chrome.storage.local.set({ auditHistoryByUrl })
  return []
}

export async function compactAuditStorage(preserveTabId?: number): Promise<void> {
  const data = await chrome.storage.local.get([
    'auditResultsByTab',
    'auditHistoryByUrl',
  ])
  const currentTabKey = preserveTabId ? getTabStorageKey(preserveTabId) : null
  const auditResultsByTab = {
    ...(data.auditResultsByTab as Record<string, AuditResult> | undefined),
  }
  const compactedResultsByTab =
    currentTabKey && auditResultsByTab[currentTabKey]
      ? {
          [currentTabKey]: compactAuditResultForStorage(
            normalizeAuditResult(auditResultsByTab[currentTabKey]) as AuditResult,
          ),
        }
      : {}
  const sourceHistory =
    (data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}
  const compactedHistory = Object.fromEntries(
    Object.entries(sourceHistory)
      .map(([urlKey, entries]) => [
        urlKey,
        dedupeAndSortAuditHistory(
          entries.map((entry) => normalizeAuditResult(entry) as AuditHistoryEntry),
          1,
        ).map((entry) => compactAuditResultForStorage(entry)),
      ])
      .filter(([, entries]) => entries.length > 0),
  )

  await chrome.storage.local.set({
    auditResultsByTab: compactedResultsByTab,
    auditHistoryByUrl: compactedHistory,
  })
}

export async function deleteOldestAuditHistoryEntry(): Promise<boolean> {
  const data = await chrome.storage.local.get('auditHistoryByUrl')
  const auditHistoryByUrl = {
    ...((data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}),
  }

  let oldestUrlKey: string | null = null
  let oldestEntryId: string | null = null
  let oldestTimestamp = Number.POSITIVE_INFINITY

  Object.entries(auditHistoryByUrl).forEach(([urlKey, entries]) => {
    entries.forEach((entry) => {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestUrlKey = urlKey
        oldestEntryId = entry.id
      }
    })
  })

  if (!oldestUrlKey || !oldestEntryId) {
    return false
  }

  auditHistoryByUrl[oldestUrlKey] = auditHistoryByUrl[oldestUrlKey].filter(
    (entry) => entry.id !== oldestEntryId,
  )

  if (auditHistoryByUrl[oldestUrlKey].length === 0) {
    delete auditHistoryByUrl[oldestUrlKey]
  }

  await chrome.storage.local.set({ auditHistoryByUrl })
  return true
}

export async function getAuditStorageDiagnostics(
  currentUrl?: string,
): Promise<AuditStorageDiagnostics> {
  const [data, usedBytes] = await Promise.all([
    chrome.storage.local.get(['auditResultsByTab', 'auditHistoryByUrl']),
    chrome.storage.local.getBytesInUse(null),
  ])

  const auditResultsByTab = (data.auditResultsByTab as Record<string, AuditResult> | undefined) ?? {}
  const auditHistoryByUrl =
    (data.auditHistoryByUrl as Record<string, AuditHistoryEntry[]> | undefined) ?? {}
  const urlCount = Object.keys(auditHistoryByUrl).length
  const historyEntryCount = Object.values(auditHistoryByUrl).reduce(
    (total, entries) => total + entries.length,
    0,
  )
  const currentUrlEntryCount = currentUrl
    ? (auditHistoryByUrl[getAuditUrlStorageKey(currentUrl)] ?? []).length
    : 0
  const quotaBytes = getStorageQuotaBytes()
  const usageRatio = quotaBytes > 0 ? usedBytes / quotaBytes : 0
  const level =
    usageRatio >= STORAGE_CRITICAL_RATIO
      ? 'critical'
      : usageRatio >= STORAGE_WARNING_RATIO
        ? 'warning'
        : 'ok'

  return {
    currentUrlEntryCount,
    historyEntryCount,
    level,
    quotaBytes,
    tabSnapshotCount: Object.keys(auditResultsByTab).length,
    urlCount,
    usageRatio,
    usedBytes,
  }
}
