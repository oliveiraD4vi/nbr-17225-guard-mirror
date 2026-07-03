import type { ManualFindingDraft } from '@/types'

export const MANUAL_FINDING_DRAFTS_STORAGE_KEY = 'manualFindingDraftsByTab'
export const MANUAL_FINDING_SELECTION_HOST_ID = 'nbr-manual-finding-selection-host'
export const MANUAL_FINDING_SELECTION_ID_PREFIX = 'nbr-manual-finding-selection-'

export function getManualFindingDraftTabKey(tabId: number): string {
  return String(tabId)
}

export function sanitizeManualFindingDraft(
  draft: Partial<ManualFindingDraft> | null | undefined,
  tabId: number,
): ManualFindingDraft | null {
  if (!draft || typeof draft !== 'object') return null
  if (!draft.selector || !draft.url || !draft.snippet || !draft.selectedAt) return null

  return {
    tabId,
    selector: draft.selector,
    tagName: draft.tagName || undefined,
    snippet: draft.snippet,
    accessibleName: draft.accessibleName || undefined,
    visibleText: draft.visibleText || undefined,
    url: draft.url,
    pageTitle: draft.pageTitle || undefined,
    selectedAt: draft.selectedAt,
  }
}
