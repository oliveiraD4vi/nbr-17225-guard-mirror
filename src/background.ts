/**
 * Background Service Worker
 */
import { t } from '@/i18n'
import type { AuditResult, ManualFindingDraft } from '@/types'
import {
  getManualFindingDraftTabKey,
  MANUAL_FINDING_DRAFTS_STORAGE_KEY,
  sanitizeManualFindingDraft,
} from '@/utils/manual-findings'
import { saveReportSnapshot } from '@/utils/report-snapshots'

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log(`[${t('shared.brand.name')}] ${t('background.installed')}`)
  } else if (details.reason === 'update') {
    console.log(`[${t('shared.brand.name')}] ${t('background.updated')}`)
  }
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log(`[${t('shared.brand.name')}] ${t('background.message')}`, request.action)

  switch (request.action) {
    case 'OPEN_REPORT':
      openDetailedReport(request.auditResult)
        .then((snapshotId) => sendResponse({ status: 'OK', snapshotId }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : t('background.reportOpenError')
          sendResponse({ error: message })
        })
      return true
    case 'STORE_MANUAL_FINDING_DRAFT':
      storeManualFindingDraft(request.draft, sender.tab?.id)
        .then(() => sendResponse({ status: 'OK' }))
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : t('background.manualFindingDraftError')
          sendResponse({ error: message })
        })
      return true
    case 'CLEAR_MANUAL_FINDING_DRAFT':
      clearManualFindingDraft(request.tabId ?? sender.tab?.id)
        .then(() => sendResponse({ status: 'OK' }))
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : t('background.manualFindingDraftError')
          sendResponse({ error: message })
        })
      return true
    default:
      sendResponse({ status: 'UNKNOWN_ACTION' })
  }

  return true
})

async function openDetailedReport(rawAuditResult: AuditResult | undefined): Promise<string> {
  if (!rawAuditResult) {
    throw new Error(t('background.reportOpenError'))
  }

  const snapshot = await saveReportSnapshot(rawAuditResult)
  chrome.tabs.create({
    url: chrome.runtime.getURL(`src/report.html?snapshotId=${encodeURIComponent(snapshot.id)}`),
  })
  return snapshot.id
}

async function storeManualFindingDraft(
  rawDraft: Partial<ManualFindingDraft> | undefined,
  tabId?: number,
): Promise<void> {
  if (typeof tabId !== 'number') {
    throw new Error(t('background.manualFindingDraftNoTab'))
  }

  const draft = sanitizeManualFindingDraft(rawDraft, tabId)
  if (!draft) {
    throw new Error(t('background.manualFindingDraftInvalid'))
  }

  const data = await chrome.storage.local.get(MANUAL_FINDING_DRAFTS_STORAGE_KEY)
  const draftsByTab = {
    ...((data[MANUAL_FINDING_DRAFTS_STORAGE_KEY] as
      | Record<string, ManualFindingDraft>
      | undefined) ?? {}),
    [getManualFindingDraftTabKey(tabId)]: draft,
  }

  await chrome.storage.local.set({
    [MANUAL_FINDING_DRAFTS_STORAGE_KEY]: draftsByTab,
  })
}

async function clearManualFindingDraft(tabId?: number): Promise<void> {
  if (typeof tabId !== 'number') return

  const data = await chrome.storage.local.get(MANUAL_FINDING_DRAFTS_STORAGE_KEY)
  const draftsByTab = {
    ...((data[MANUAL_FINDING_DRAFTS_STORAGE_KEY] as
      | Record<string, ManualFindingDraft>
      | undefined) ?? {}),
  }
  delete draftsByTab[getManualFindingDraftTabKey(tabId)]

  await chrome.storage.local.set({
    [MANUAL_FINDING_DRAFTS_STORAGE_KEY]: draftsByTab,
  })
}

console.log(`[${t('shared.brand.name')}] ${t('background.loaded')}`)
