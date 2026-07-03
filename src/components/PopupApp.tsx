import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Form,
  Input,
  Layout,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  DownOutlined,
  DownloadOutlined,
  EyeOutlined,
  FallOutlined,
  FlagOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  StopOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { PopupPanelSkeleton } from './LoadingSkeletons'
import type { ViolationsListState } from './ViolationsList'
import { t } from '@/i18n'
import { isNormativeRequirement } from '@/normative'
import { allRules } from '@/rules'
import { APP_VERSION } from '@/version'
import type {
  AuditHistoryEntry,
  AuditResult,
  ContrastPreviewItem,
  ContrastPreviewResult,
  ManualFindingDraft,
  Violation,
  VisionSimulationFilter,
} from '@/types'
import { compareAuditResults } from '@/utils/audit-comparison'
import { buildAuditSummaryJson, buildExportableAuditResult } from '@/utils/audit-export'
import {
  clearAuditHistoryForUrl,
  compactAuditStorage,
  deleteOldestAuditHistoryEntry,
  deleteAuditHistoryEntry,
  ensureContentScriptReady,
  getDisplayResultForScope,
  getActiveTab,
  getAuditHistoryForSite,
  getAuditHistoryForUrl,
  getAuditResult,
  getAuditStorageDiagnostics,
  type AuditStorageDiagnostics,
  importAuditReportToHistory,
  isAuditStorageQuotaError,
  parseImportedAuditReport,
  runAccessibilityAudit,
  saveAuditResult,
  updateStoredAuditResult,
} from '@/utils/audit-engine'
import { createManualViolation } from '@/utils'
import { areSimilarViolations } from '@/utils/audit-bulk-actions'
import { getAuditUrlStorageKey, hydrateAuditResult } from '@/utils/audit-history'
import { applyFindingStatusUpdate, type FindingStatusUpdate } from '@/utils/audit-triage'
import {
  getManualFindingDraftTabKey,
  MANUAL_FINDING_DRAFTS_STORAGE_KEY,
  sanitizeManualFindingDraft,
} from '@/utils/manual-findings'
import '../styles/popup.css'

const { Header, Content, Footer } = Layout

const ViolationsSummary = React.lazy(async () => {
  const module = await import('./ViolationsSummary')
  return { default: module.ViolationsSummary }
})

const ViolationsList = React.lazy(async () => {
  const module = await import('./ViolationsList')
  return { default: module.ViolationsList }
})

const VisionSimulator = React.lazy(async () => {
  const module = await import('./VisionSimulator')
  return { default: module.VisionSimulator }
})

const AboutPanel = React.lazy(async () => {
  const module = await import('./AboutPanel')
  return { default: module.AboutPanel }
})

const HistoryTabPanel = React.lazy(async () => {
  const module = await import('./HistoryTabPanel')
  return { default: module.HistoryTabPanel }
})

const severityRank: Record<Violation['severity'], number> = {
  error: 0,
  warning: 1,
}

const maxHeaderTabTitleLength = 120
const popupStateStorageKey = 'popupStateByUrl'
const maxStoredPopupStates = 50
const defaultIncludeHumanReview = true
// Toggle temporariamente oculto: a auditoria continua incluindo itens não automatizáveis.
const showHumanReviewScopeToggle = false

type PopupTabKey = 'summary' | 'violations' | 'history'

interface PopupStoredState {
  activeTabKey?: PopupTabKey
  isAuditMetaCollapsed?: boolean
  scrollTop?: number
  selectedHistoryId?: string | null
  updatedAt?: number
  violationsListState?: ViolationsListState
}

type PopupStateByUrl = Record<string, PopupStoredState>

interface ManualFindingFormValues {
  ruleId?: string
  severity?: Violation['severity']
  message?: string
  suggestion?: string
  remediationAdvice?: string
  userNote?: string
}

function truncateHeaderTabTitle(value: string): string {
  if (value.length <= maxHeaderTabTitleLength) return value
  return `${value.slice(0, maxHeaderTabTitleLength - 3).trimEnd()}...`
}

function createContrastPreviewItem(
  violation: Violation,
  colors: Pick<NonNullable<Violation['userContrastOverride']>, 'foregroundHex' | 'backgroundHex'>,
): ContrastPreviewItem | null {
  if (!violation.contrastDetails || !violation.elementSelector) return null
  return {
    id: violation.id,
    selector: violation.elementSelector,
    context: violation.contrastDetails.context,
    foregroundHex: colors.foregroundHex,
    backgroundHex: colors.backgroundHex,
  }
}

function isPopupTabKey(value: unknown): value is PopupTabKey {
  return value === 'summary' || value === 'violations' || value === 'history'
}

function getStoredPopupState(rawStateByUrl: unknown, url?: string): PopupStoredState | null {
  if (!url || !rawStateByUrl || typeof rawStateByUrl !== 'object') return null
  const stateByUrl = rawStateByUrl as PopupStateByUrl
  const storedState = stateByUrl[getAuditUrlStorageKey(url)]
  if (!storedState || typeof storedState !== 'object') return null

  return {
    ...storedState,
    activeTabKey: isPopupTabKey(storedState.activeTabKey) ? storedState.activeTabKey : undefined,
    selectedHistoryId:
      typeof storedState.selectedHistoryId === 'string' || storedState.selectedHistoryId === null
        ? storedState.selectedHistoryId
        : undefined,
  }
}

function mergePopupStoredState(
  currentState: PopupStoredState | null,
  patch: Partial<PopupStoredState>,
): PopupStoredState {
  const mergedState: PopupStoredState = {
    ...(currentState ?? {}),
    ...patch,
    updatedAt: Date.now(),
  }

  if (!Object.prototype.hasOwnProperty.call(patch, 'violationsListState')) {
    mergedState.violationsListState = currentState?.violationsListState
  }

  return mergedState
}

function limitPopupStateByUrl(stateByUrl: PopupStateByUrl): PopupStateByUrl {
  return Object.fromEntries(
    Object.entries(stateByUrl)
      .sort((left, right) => (right[1].updatedAt ?? 0) - (left[1].updatedAt ?? 0))
      .slice(0, maxStoredPopupStates),
  )
}

function getPriorityViolations(violations: Violation[]): Violation[] {
  const seenRules = new Set<string>()

  return [...violations]
    .sort((left, right) => {
      const severityCompare = severityRank[left.severity] - severityRank[right.severity]
      if (severityCompare !== 0) return severityCompare
      return left.nbrReference.localeCompare(right.nbrReference, 'pt-BR')
    })
    .filter((violation) => {
      if (seenRules.has(violation.ruleId)) return false
      seenRules.add(violation.ruleId)
      return true
    })
    .slice(0, 3)
}

function getComparisonTrend(summary: ReturnType<typeof compareAuditResults> | null) {
  if (!summary) return null

  const delta = summary.targetOpenCount - summary.baselineOpenCount
  if (delta < 0) {
    return {
      icon: <RiseOutlined />,
      label: t('shared.states.improvement'),
      color: 'green' as const,
    }
  }
  if (delta > 0) {
    return {
      icon: <FallOutlined />,
      label: t('shared.states.regression'),
      color: 'red' as const,
    }
  }

  return {
    icon: <MinusOutlined />,
    label: t('shared.states.stable'),
    color: 'default' as const,
  }
}

function getComparisonQuickReadingLabel(label: string): string {
  if (label === t('shared.states.improvement')) return t('popup.history.quickReadingImprovement')
  if (label === t('shared.states.regression')) return t('popup.history.quickReadingRegression')
  return t('popup.history.quickReadingStable')
}

function getExportTimestampSegment(timestamp = Date.now()): string {
  return new Date(timestamp)
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[:.]/g, '-')
}

function downloadTextFile(content: string, type: string, filename: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function buildAuditCsv(result: AuditResult): string {
  const exportedAt = new Date().toISOString()
  const auditedAt = new Date(result.timestamp).toISOString()
  const headers = [
    t('shared.exports.csvHeaders.exportedAt'),
    t('shared.exports.csvHeaders.auditedAt'),
    t('shared.exports.csvHeaders.id'),
    t('shared.exports.csvHeaders.rule'),
    t('shared.exports.csvHeaders.nbrReference'),
    t('shared.exports.csvHeaders.severity'),
    t('shared.exports.csvHeaders.findingOrigin'),
    t('shared.exports.csvHeaders.findingStatus'),
    t('shared.exports.csvHeaders.ignoreReason'),
    t('shared.exports.csvHeaders.ignoreNote'),
    t('shared.exports.csvHeaders.message'),
    t('shared.exports.csvHeaders.suggestion'),
  ]
  const rows = result.violations.map((violation) => [
    exportedAt,
    auditedAt,
    violation.id,
    violation.ruleName,
    violation.nbrReference,
    violation.severity,
    violation.findingOrigin,
    violation.findingStatus,
    violation.ignoreReason || '',
    violation.ignoreNote || '',
    violation.message,
    violation.suggestion,
  ])

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

function getQuotaAlertDescriptionKey(
  scope: 'audit' | 'history' | 'review',
  hasUnsavedChanges: boolean,
): string {
  if (!hasUnsavedChanges) return 'popup.quota.alertDescription'

  if (scope === 'audit') return 'popup.quota.alertDescriptionUnsavedAudit'
  if (scope === 'history') return 'popup.quota.alertDescriptionUnsavedHistory'
  return 'popup.quota.alertDescriptionUnsavedReview'
}

function getQuotaModalAlertDescriptionKey(scope: 'audit' | 'history' | 'review'): string {
  if (scope === 'audit') return 'popup.quota.modalAlertDescriptionAudit'
  if (scope === 'history') return 'popup.quota.modalAlertDescriptionHistory'
  return 'popup.quota.modalAlertDescriptionReview'
}

function formatStorageSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024)
  return `${megabytes.toLocaleString('pt-BR', {
    minimumFractionDigits: megabytes >= 9.95 ? 0 : 1,
    maximumFractionDigits: 1,
  })} MB`
}

export const PopupApp: React.FC = () => {
  const quotaRetryRef = useRef<(() => Promise<unknown>) | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const popupContentRef = useRef<HTMLDivElement | null>(null)
  const scrollPersistTimeoutRef = useRef<number | null>(null)
  const contrastPreviewPortRef = useRef<chrome.runtime.Port | null>(null)
  const contrastPreviewItemsRef = useRef<Map<string, ContrastPreviewItem>>(new Map())
  const contrastPreviewWarningRef = useRef<string | null>(null)
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null)
  const [auditHistory, setAuditHistory] = useState<AuditHistoryEntry[]>([])
  const [siteAuditHistory, setSiteAuditHistory] = useState<AuditHistoryEntry[]>([])
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null)
  const [includeRecommendations, setIncludeRecommendations] = useState(false)
  const [includeHumanReview, setIncludeHumanReview] = useState(defaultIncludeHumanReview)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<(chrome.tabs.Tab & { id: number }) | null>(null)
  const [activeTabKey, setActiveTabKey] = useState<PopupTabKey>('summary')
  const [isAuditMetaCollapsed, setIsAuditMetaCollapsed] = useState(false)
  const [popupStoredState, setPopupStoredState] = useState<PopupStoredState | null>(null)
  const [isVisionSimulatorOpen, setIsVisionSimulatorOpen] = useState(false)
  const [hasVisionSimulatorMounted, setHasVisionSimulatorMounted] = useState(false)
  const [priorityIndex, setPriorityIndex] = useState(0)
  const [showAboutView, setShowAboutView] = useState(false)
  const [historyEntryPendingDeletion, setHistoryEntryPendingDeletion] =
    useState<AuditHistoryEntry | null>(null)
  const [comparisonBaselineId, setComparisonBaselineId] = useState<string | undefined>(undefined)
  const [comparisonTargetId, setComparisonTargetId] = useState<string | undefined>(undefined)
  const [quotaIssue, setQuotaIssue] = useState<{
    url: string
    scope: 'audit' | 'history' | 'review'
    hasUnsavedChanges: boolean
  } | null>(null)
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false)
  const [quotaRecoveryLoading, setQuotaRecoveryLoading] = useState(false)
  const [storageDiagnostics, setStorageDiagnostics] = useState<AuditStorageDiagnostics | null>(null)
  const [storageMaintenanceLoading, setStorageMaintenanceLoading] = useState(false)
  const [manualFindingDraft, setManualFindingDraft] = useState<ManualFindingDraft | null>(null)
  const [isManualFindingModalOpen, setIsManualFindingModalOpen] = useState(false)
  const [manualFindingSaving, setManualFindingSaving] = useState(false)
  const [manualFindingForm] = Form.useForm<ManualFindingFormValues>()
  const appIconUrl = useMemo(() => chrome.runtime.getURL('icons/icon-white.png'), [])

  const syncAuditResultUpdate = useCallback((updatedResult: AuditResult) => {
    setAuditHistory((currentHistory) =>
      currentHistory.map((entry) =>
        entry.id === updatedResult.id ? (updatedResult as AuditHistoryEntry) : entry,
      ),
    )
    setSiteAuditHistory((currentHistory) =>
      currentHistory.map((entry) =>
        entry.id === updatedResult.id ? (updatedResult as AuditHistoryEntry) : entry,
      ),
    )
    setAuditResult((currentResult) =>
      currentResult?.id === updatedResult.id ? updatedResult : currentResult,
    )
  }, [])

  const refreshStorageDiagnostics = useCallback(async (url?: string) => {
    try {
      const diagnostics = await getAuditStorageDiagnostics(url)
      setStorageDiagnostics(diagnostics)
    } catch (error) {
      console.error('Erro ao calcular uso do armazenamento local:', error)
      setStorageDiagnostics(null)
    }
  }, [])

  const loadAuditForCurrentTab = useCallback(async () => {
    try {
      const tab = await getActiveTab()
      setActiveTab(tab)
      const [result, preferences, history, siteHistory, diagnostics] = await Promise.all([
        getAuditResult(tab.id, tab.url),
        chrome.storage.local.get([
          'includeRecommendationsPreference',
          'includeHumanReviewPreference',
          popupStateStorageKey,
        ]),
        getAuditHistoryForUrl(tab.url),
        getAuditHistoryForSite(tab.url),
        getAuditStorageDiagnostics(tab.url),
      ])
      const resolvedPreference =
        result?.includeRecommendations ?? Boolean(preferences.includeRecommendationsPreference)
      const resolvedHumanReviewPreference = defaultIncludeHumanReview
      const savedState = getStoredPopupState(preferences[popupStateStorageKey], tab.url)
      const availableAuditIds = new Set(
        [result?.id, ...history.map((entry) => entry.id), ...siteHistory.map((entry) => entry.id)]
          .filter(Boolean)
          .map(String),
      )
      const savedHistoryId =
        savedState?.selectedHistoryId && availableAuditIds.has(savedState.selectedHistoryId)
          ? savedState.selectedHistoryId
          : null
      const restoredHistoryId =
        savedHistoryId ?? (!result && history.length > 0 ? history[0].id : null)
      setAuditResult(result)
      setAuditHistory(history)
      setSiteAuditHistory(siteHistory)
      setIncludeRecommendations(resolvedPreference)
      setIncludeHumanReview(resolvedHumanReviewPreference)
      setStorageDiagnostics(diagnostics)
      setPopupStoredState(savedState)
      setSelectedHistoryId(restoredHistoryId)
      setActiveTabKey(savedState?.activeTabKey ?? 'summary')
      setIsAuditMetaCollapsed(Boolean(savedState?.isAuditMetaCollapsed))
      setShowAboutView(false)
      setPriorityIndex(0)
      setComparisonTargetId(history[0]?.id)
      setComparisonBaselineId(history[1]?.id || history[0]?.id)
    } catch (error) {
      console.error('Erro ao carregar resultado da aba ativa:', error)
      setAuditResult(null)
      setAuditHistory([])
      setSiteAuditHistory([])
      setSelectedHistoryId(null)
      setIncludeHumanReview(defaultIncludeHumanReview)
      setPopupStoredState(null)
      setActiveTabKey('summary')
      setIsAuditMetaCollapsed(false)
      setShowAboutView(false)
      setPriorityIndex(0)
      setComparisonBaselineId(undefined)
      setComparisonTargetId(undefined)
      setStorageDiagnostics(null)
    } finally {
      setInitialLoading(false)
    }
  }, [])

  const persistWithQuotaHandling = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      issue: {
        url: string
        scope: 'audit' | 'history' | 'review'
        hasUnsavedChanges: boolean
      },
    ): Promise<T | null> => {
      try {
        const result = await operation()
        await refreshStorageDiagnostics(issue.url)
        setQuotaIssue(null)
        setIsQuotaModalOpen(false)
        quotaRetryRef.current = null
        return result
      } catch (error) {
        if (isAuditStorageQuotaError(error)) {
          await refreshStorageDiagnostics(issue.url)
          quotaRetryRef.current = operation
          setQuotaIssue(issue)
          setIsQuotaModalOpen(true)
          return null
        }

        throw error
      }
    },
    [refreshStorageDiagnostics],
  )

  useEffect(() => {
    void loadAuditForCurrentTab()

    const handleTabActivated = () => {
      void loadAuditForCurrentTab()
    }

    const handleTabUpdated = (tabId: number, changeInfo: { status?: string; url?: string }) => {
      if (!activeTab?.id || tabId !== activeTab.id) return
      if (changeInfo.status === 'complete' || 'url' in changeInfo) {
        void loadAuditForCurrentTab()
      }
    }

    chrome.tabs.onActivated.addListener(handleTabActivated)
    chrome.tabs.onUpdated.addListener(handleTabUpdated)

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated)
      chrome.tabs.onUpdated.removeListener(handleTabUpdated)
    }
  }, [activeTab?.id, loadAuditForCurrentTab])

  const sendMessageToActiveTab = useCallback(
    async (payload: Record<string, unknown>) => {
      const tab = activeTab ?? (await getActiveTab())
      await ensureContentScriptReady(tab.id)
      const response = await chrome.tabs.sendMessage(tab.id, payload)
      if (response?.error) {
        throw new Error(response.error)
      }
      return response
    },
    [activeTab],
  )

  const manualFindingRuleOptions = useMemo(
    () =>
      allRules.map((rule) => ({
        value: rule.id,
        label: `NBR ${rule.nbrReference} — ${rule.name}`,
        searchLabel: `${rule.nbrReference} ${rule.name}`,
      })),
    [],
  )

  const manualFindingSeverityOptions = useMemo(
    () => [
      { value: 'error' as const, label: t('shared.severity.error') },
      { value: 'warning' as const, label: t('shared.severity.warning') },
    ],
    [],
  )

  const clearManualFindingDraftForTab = useCallback(
    async (tabId = activeTab?.id) => {
      if (!tabId) return

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
    },
    [activeTab?.id],
  )

  const openManualFindingDraft = useCallback(
    (draft: ManualFindingDraft) => {
      setManualFindingDraft(draft)
      setIsManualFindingModalOpen(true)
      manualFindingForm.resetFields()
    },
    [manualFindingForm],
  )

  const loadManualFindingDraftForTab = useCallback(
    async (tab: chrome.tabs.Tab & { id: number }) => {
      const data = await chrome.storage.local.get(MANUAL_FINDING_DRAFTS_STORAGE_KEY)
      const rawDraft = (
        data[MANUAL_FINDING_DRAFTS_STORAGE_KEY] as Record<string, ManualFindingDraft> | undefined
      )?.[getManualFindingDraftTabKey(tab.id)]
      const draft = sanitizeManualFindingDraft(rawDraft, tab.id)

      if (!draft) {
        setManualFindingDraft(null)
        setIsManualFindingModalOpen(false)
        return
      }

      if (tab.url && getAuditUrlStorageKey(draft.url) !== getAuditUrlStorageKey(tab.url)) {
        await clearManualFindingDraftForTab(tab.id)
        setManualFindingDraft(null)
        setIsManualFindingModalOpen(false)
        return
      }

      openManualFindingDraft(draft)
    },
    [clearManualFindingDraftForTab, openManualFindingDraft],
  )

  useEffect(() => {
    if (!activeTab?.id) return
    void loadManualFindingDraftForTab(activeTab)
  }, [activeTab, loadManualFindingDraftForTab])

  useEffect(() => {
    const handleManualFindingDraftChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName !== 'local' || !activeTab?.id) return

      const change = changes[MANUAL_FINDING_DRAFTS_STORAGE_KEY]
      if (!change) return

      const rawDraft = (change.newValue as Record<string, ManualFindingDraft> | undefined)?.[
        getManualFindingDraftTabKey(activeTab.id)
      ]
      const draft = sanitizeManualFindingDraft(rawDraft, activeTab.id)

      if (!draft) {
        setManualFindingDraft(null)
        setIsManualFindingModalOpen(false)
        return
      }

      if (
        activeTab.url &&
        getAuditUrlStorageKey(draft.url) !== getAuditUrlStorageKey(activeTab.url)
      ) {
        void clearManualFindingDraftForTab(activeTab.id)
        setManualFindingDraft(null)
        setIsManualFindingModalOpen(false)
        return
      }

      openManualFindingDraft(draft)
    }

    chrome.storage.onChanged.addListener(handleManualFindingDraftChange)
    return () => chrome.storage.onChanged.removeListener(handleManualFindingDraftChange)
  }, [activeTab?.id, activeTab?.url, clearManualFindingDraftForTab, openManualFindingDraft])

  const viewedAuditResult = useMemo(() => {
    if (!selectedHistoryId) return auditResult
    return (
      auditHistory.find((entry) => entry.id === selectedHistoryId) ||
      siteAuditHistory.find((entry) => entry.id === selectedHistoryId) ||
      auditResult
    )
  }, [auditHistory, auditResult, selectedHistoryId, siteAuditHistory])

  const isHistoricalView = Boolean(selectedHistoryId)
  const displayedAuditResult = useMemo(
    () => getDisplayResultForScope(viewedAuditResult, includeRecommendations, includeHumanReview),
    [includeHumanReview, includeRecommendations, viewedAuditResult],
  )
  const scopedRawViolations = useMemo(
    () =>
      viewedAuditResult?.violations.filter(
        (violation) =>
          (includeRecommendations || isNormativeRequirement(violation.nbrReference)) &&
          (includeHumanReview ||
            !violation.requiresHumanReview ||
            violation.findingOrigin === 'manual'),
      ) ?? [],
    [includeHumanReview, includeRecommendations, viewedAuditResult],
  )
  const reviewSourceResult = useMemo(
    () =>
      viewedAuditResult
        ? {
            ...viewedAuditResult,
            includeHumanReview,
            violations: scopedRawViolations,
          }
        : null,
    [includeHumanReview, scopedRawViolations, viewedAuditResult],
  )
  const canRerunViewedAudit = useMemo(() => {
    if (!activeTab?.url || !viewedAuditResult?.url) return false
    return getAuditUrlStorageKey(activeTab.url) === getAuditUrlStorageKey(viewedAuditResult.url)
  }, [activeTab?.url, viewedAuditResult?.url])

  const ensureContrastPreviewSession = useCallback(async () => {
    if (contrastPreviewPortRef.current || !activeTab?.id) return
    await ensureContentScriptReady(activeTab.id)
    const port = chrome.tabs.connect(activeTab.id, { name: 'contrast-preview-session' })
    port.onDisconnect.addListener(() => {
      if (contrastPreviewPortRef.current === port) {
        contrastPreviewPortRef.current = null
        contrastPreviewItemsRef.current.clear()
      }
    })
    contrastPreviewPortRef.current = port
  }, [activeTab?.id])

  const clearContrastPreviewsOnPage = useCallback(async () => {
    contrastPreviewItemsRef.current.clear()
    contrastPreviewWarningRef.current = null
    const port = contrastPreviewPortRef.current
    contrastPreviewPortRef.current = null

    try {
      await sendMessageToActiveTab({ action: 'CLEAR_CONTRAST_PREVIEWS' })
    } catch {
      // O encerramento da porta também restaura a página quando a aba ainda está disponível.
    } finally {
      port?.disconnect()
    }
  }, [sendMessageToActiveTab])

  const syncContrastPreviewsOnPage = useCallback(
    async (items: ContrastPreviewItem[], showMissingFeedback = false) => {
      if (isHistoricalView || !canRerunViewedAudit) return null
      await ensureContrastPreviewSession()
      items.forEach((item) => contrastPreviewItemsRef.current.set(item.id, item))

      const response = await sendMessageToActiveTab({
        action: 'SYNC_CONTRAST_PREVIEWS',
        previews: Array.from(contrastPreviewItemsRef.current.values()),
      })
      const result = response?.result as ContrastPreviewResult | undefined
      const unavailableCount = (result?.missing ?? 0) + (result?.unsupported ?? 0)
      if (unavailableCount > 0 && showMissingFeedback) {
        message.warning(t('popup.messages.contrastPreviewPartial', { count: unavailableCount }))
      }
      return result ?? null
    },
    [canRerunViewedAudit, ensureContrastPreviewSession, isHistoricalView, sendMessageToActiveTab],
  )

  const handleViolationContrastPreviewChange = useCallback(
    async (
      violation: Violation,
      colors: Pick<
        NonNullable<Violation['userContrastOverride']>,
        'foregroundHex' | 'backgroundHex'
      >,
    ) => {
      const item = createContrastPreviewItem(violation, colors)
      if (!item || isHistoricalView || !canRerunViewedAudit) return

      try {
        const result = await syncContrastPreviewsOnPage([item])
        const unavailableCount = (result?.missing ?? 0) + (result?.unsupported ?? 0)
        if (unavailableCount > 0 && contrastPreviewWarningRef.current !== item.id) {
          contrastPreviewWarningRef.current = item.id
          message.warning(t('popup.messages.contrastPreviewUnavailable'))
        }
      } catch (error) {
        console.error('Erro ao aplicar prévia de contraste:', error)
      }
    },
    [canRerunViewedAudit, isHistoricalView, syncContrastPreviewsOnPage],
  )

  useEffect(
    () => () => {
      contrastPreviewPortRef.current?.disconnect()
      contrastPreviewPortRef.current = null
      contrastPreviewItemsRef.current.clear()
    },
    [activeTab?.id],
  )

  const persistPopupState = useCallback(
    async (patch: Partial<PopupStoredState>) => {
      const stateUrl = viewedAuditResult?.url || activeTab?.url
      if (!stateUrl) return

      const stateKey = getAuditUrlStorageKey(stateUrl)
      setPopupStoredState((currentState) => mergePopupStoredState(currentState, patch))

      try {
        const stored = await chrome.storage.local.get(popupStateStorageKey)
        const currentStateByUrl =
          stored[popupStateStorageKey] && typeof stored[popupStateStorageKey] === 'object'
            ? ({ ...(stored[popupStateStorageKey] as PopupStateByUrl) } as PopupStateByUrl)
            : {}

        currentStateByUrl[stateKey] = mergePopupStoredState(
          currentStateByUrl[stateKey] ?? null,
          patch,
        )

        await chrome.storage.local.set({
          [popupStateStorageKey]: limitPopupStateByUrl(currentStateByUrl),
        })
      } catch (error) {
        console.error('Erro ao salvar estado do popup:', error)
      }
    },
    [activeTab?.url, viewedAuditResult?.url],
  )

  const handleTabChange = useCallback(
    (key: string) => {
      const nextTabKey = isPopupTabKey(key) ? key : 'summary'
      setActiveTabKey(nextTabKey)
      void persistPopupState({ activeTabKey: nextTabKey })
    },
    [persistPopupState],
  )

  const handleAuditMetaToggle = useCallback(() => {
    setIsAuditMetaCollapsed((currentValue) => {
      const nextValue = !currentValue
      void persistPopupState({ isAuditMetaCollapsed: nextValue })
      return nextValue
    })
  }, [persistPopupState])

  const handleCopyAuditUrl = useCallback(async () => {
    if (!displayedAuditResult?.url) return
    try {
      await navigator.clipboard.writeText(displayedAuditResult.url)
      message.success(t('popup.messages.auditUrlCopied'))
    } catch (error) {
      console.error('Erro ao copiar URL da auditoria:', error)
      message.error(t('popup.messages.auditUrlCopyError'))
    }
  }, [displayedAuditResult?.url])

  const handleSelectHistory = useCallback(
    (historyId: string | null) => {
      setSelectedHistoryId(historyId)
      setPriorityIndex(0)
      void persistPopupState({ selectedHistoryId: historyId })
    },
    [persistPopupState],
  )

  const handleViolationsListStateChange = useCallback(
    (violationsListState: ViolationsListState) => {
      void persistPopupState({ violationsListState })
    },
    [persistPopupState],
  )

  const handlePopupScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = event.currentTarget.scrollTop
      if (scrollPersistTimeoutRef.current !== null) {
        window.clearTimeout(scrollPersistTimeoutRef.current)
      }
      scrollPersistTimeoutRef.current = window.setTimeout(() => {
        void persistPopupState({ scrollTop })
      }, 220)
    },
    [persistPopupState],
  )

  useEffect(
    () => () => {
      if (scrollPersistTimeoutRef.current !== null) {
        window.clearTimeout(scrollPersistTimeoutRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    if (initialLoading || loading || showAboutView) return
    if (typeof popupStoredState?.scrollTop !== 'number') return

    const restoreTimeout = window.setTimeout(() => {
      popupContentRef.current?.scrollTo({ top: popupStoredState.scrollTop })
    }, 80)

    return () => window.clearTimeout(restoreTimeout)
  }, [
    activeTabKey,
    displayedAuditResult?.id,
    initialLoading,
    loading,
    popupStoredState?.scrollTop,
    showAboutView,
  ])

  const clearHighlightsOnPage = useCallback(
    async (showFeedback = false) => {
      try {
        await sendMessageToActiveTab({ action: 'CLEAR_HIGHLIGHTS' })
        if (showFeedback) message.success(t('popup.messages.highlightsCleared'))
      } catch (error) {
        console.error('Erro ao limpar destaques:', error)
        if (showFeedback) message.error(t('popup.messages.highlightsClearError'))
      }
    },
    [sendMessageToActiveTab],
  )

  const handleRunAudit = useCallback(async () => {
    setLoading(true)
    try {
      await clearContrastPreviewsOnPage()
      await clearHighlightsOnPage(false)
      const result = await runAccessibilityAudit({ includeRecommendations, includeHumanReview })
      const tab = await getActiveTab()
      setActiveTab(tab)
      const persistAudit = async () => {
        const persistedResult = await saveAuditResult(result, tab.id)
        const [history, siteHistory] = await Promise.all([
          getAuditHistoryForUrl(tab.url),
          getAuditHistoryForSite(tab.url),
        ])
        setAuditResult(persistedResult)
        setAuditHistory(history)
        setSiteAuditHistory(siteHistory)
        setSelectedHistoryId(null)
        setActiveTabKey('summary')
        setShowAboutView(false)
        setPriorityIndex(0)
        void persistPopupState({
          activeTabKey: 'summary',
          scrollTop: 0,
          selectedHistoryId: null,
          violationsListState: undefined,
        })
        setComparisonTargetId(history[0]?.id)
        setComparisonBaselineId(history[1]?.id || history[0]?.id)
        message.success(
          t('popup.messages.auditCompleted', {
            count:
              getDisplayResultForScope(persistedResult, includeRecommendations, includeHumanReview)
                ?.totalViolations ?? result.totalViolations,
          }),
        )
        return persistedResult
      }

      const persistedResult = await persistWithQuotaHandling(persistAudit, {
        url: tab.url || result.url,
        scope: 'audit',
        hasUnsavedChanges: true,
      })
      if (!persistedResult) {
        setAuditResult(result)
        setSelectedHistoryId(null)
        setActiveTabKey('summary')
        setShowAboutView(false)
        setPriorityIndex(0)
        void persistPopupState({
          activeTabKey: 'summary',
          scrollTop: 0,
          selectedHistoryId: null,
          violationsListState: undefined,
        })
        message.warning(t('popup.messages.quotaUnsavedAudit'))
      }
    } catch (error) {
      console.error('Erro ao executar auditoria:', error)
      message.error(error instanceof Error ? error.message : t('popup.messages.auditRunError'))
    } finally {
      setLoading(false)
    }
  }, [
    clearContrastPreviewsOnPage,
    clearHighlightsOnPage,
    includeHumanReview,
    includeRecommendations,
    persistPopupState,
    persistWithQuotaHandling,
  ])

  const handleRecommendationsToggle = useCallback(
    async (checked: boolean) => {
      setIncludeRecommendations(checked)
      await chrome.storage.local.set({ includeRecommendationsPreference: checked })

      if (!checked || isHistoricalView || !auditResult || auditResult.includeRecommendations) {
        return
      }

      setLoading(true)
      try {
        await clearHighlightsOnPage(false)
        const upgradedResult = await runAccessibilityAudit({
          includeRecommendations: true,
          includeHumanReview,
        })
        const preservedResult: AuditResult = {
          ...upgradedResult,
          id: auditResult.id,
          timestamp: auditResult.timestamp,
          includeRecommendations: true,
          includeHumanReview,
        }

        syncAuditResultUpdate(preservedResult)
        const persisted = await persistWithQuotaHandling(
          async () => {
            await updateStoredAuditResult(preservedResult, activeTab?.id)
            return true
          },
          { url: preservedResult.url, scope: 'audit', hasUnsavedChanges: true },
        )
        if (persisted === null) {
          message.warning(t('popup.messages.quotaUnsavedAudit'))
          return
        }

        const refreshedHistory = await getAuditHistoryForUrl(activeTab?.url || preservedResult.url)
        setAuditHistory(refreshedHistory)
        message.success(t('popup.messages.recommendationsIncluded'))
      } catch (error) {
        console.error('Erro ao incluir recomendações:', error)
        setIncludeRecommendations(false)
        await chrome.storage.local.set({ includeRecommendationsPreference: false })
        message.error(t('popup.messages.recommendationsLoadError'))
      } finally {
        setLoading(false)
      }
    },
    [
      activeTab?.id,
      activeTab?.url,
      auditResult,
      clearHighlightsOnPage,
      includeHumanReview,
      isHistoricalView,
      persistWithQuotaHandling,
      syncAuditResultUpdate,
    ],
  )

  const handleHumanReviewToggle = useCallback(
    async (checked: boolean) => {
      setIncludeHumanReview(checked)
      await chrome.storage.local.set({ includeHumanReviewPreference: checked })

      if (
        !checked ||
        isHistoricalView ||
        !auditResult ||
        auditResult.includeHumanReview !== false
      ) {
        return
      }

      setLoading(true)
      try {
        await clearHighlightsOnPage(false)
        const upgradedResult = await runAccessibilityAudit({
          includeRecommendations,
          includeHumanReview: true,
        })
        const preservedResult: AuditResult = {
          ...upgradedResult,
          id: auditResult.id,
          timestamp: auditResult.timestamp,
          includeRecommendations,
          includeHumanReview: true,
        }

        syncAuditResultUpdate(preservedResult)
        const persisted = await persistWithQuotaHandling(
          async () => {
            await updateStoredAuditResult(preservedResult, activeTab?.id)
            return true
          },
          { url: preservedResult.url, scope: 'audit', hasUnsavedChanges: true },
        )
        if (persisted === null) {
          message.warning(t('popup.messages.quotaUnsavedAudit'))
        }
      } catch (error) {
        console.error('Erro ao incluir itens não automatizáveis:', error)
        setIncludeHumanReview(false)
        await chrome.storage.local.set({ includeHumanReviewPreference: false })
        message.error(t('popup.messages.humanReviewLoadError'))
      } finally {
        setLoading(false)
      }
    },
    [
      activeTab?.id,
      auditResult,
      clearHighlightsOnPage,
      includeRecommendations,
      isHistoricalView,
      persistWithQuotaHandling,
      syncAuditResultUpdate,
    ],
  )

  const handleExportJSON = useCallback(() => {
    if (!reviewSourceResult) {
      message.warning(t('popup.messages.noAuditToExport'))
      return
    }

    downloadTextFile(
      JSON.stringify(buildExportableAuditResult(reviewSourceResult), null, 2),
      'application/json;charset=utf-8',
      `${t('shared.exports.auditFilePrefix')}-${getExportTimestampSegment(reviewSourceResult.timestamp)}.json`,
    )
    message.success(t('popup.messages.exportJsonSuccess'))
  }, [reviewSourceResult])

  const handleExportCSV = useCallback(() => {
    if (!reviewSourceResult || reviewSourceResult.violations.length === 0) {
      message.warning(t('popup.messages.noViolationsToExport'))
      return
    }

    downloadTextFile(
      buildAuditCsv(reviewSourceResult),
      'text/csv;charset=utf-8',
      `${t('shared.exports.auditFilePrefix')}-${getExportTimestampSegment(reviewSourceResult.timestamp)}.csv`,
    )
    message.success(t('popup.messages.exportCsvSuccess'))
  }, [reviewSourceResult])

  const handleExportSummary = useCallback(() => {
    if (!reviewSourceResult) {
      message.warning(t('popup.messages.noAuditToExport'))
      return
    }

    downloadTextFile(
      JSON.stringify(buildAuditSummaryJson(reviewSourceResult), null, 2),
      'application/json;charset=utf-8',
      `${t('shared.exports.summaryFilePrefix')}-${getExportTimestampSegment(reviewSourceResult.timestamp)}.json`,
    )
    message.success(t('popup.messages.exportSummarySuccess'))
  }, [reviewSourceResult])

  const handleExportHistoryJSON = useCallback((entry: AuditHistoryEntry) => {
    downloadTextFile(
      JSON.stringify(buildExportableAuditResult(entry), null, 2),
      'application/json;charset=utf-8',
      `${t('shared.exports.auditFilePrefix')}-${getExportTimestampSegment(entry.timestamp)}.json`,
    )
    message.success(t('popup.messages.exportJsonSuccess'))
  }, [])

  const handleExportHistoryCSV = useCallback((entry: AuditHistoryEntry) => {
    if (entry.violations.length === 0) {
      message.warning(t('popup.messages.noViolationsToExport'))
      return
    }

    downloadTextFile(
      buildAuditCsv(entry),
      'text/csv;charset=utf-8',
      `${t('shared.exports.auditFilePrefix')}-${getExportTimestampSegment(entry.timestamp)}.csv`,
    )
    message.success(t('popup.messages.exportCsvSuccess'))
  }, [])

  const handleExportHistorySummary = useCallback((entry: AuditHistoryEntry) => {
    downloadTextFile(
      JSON.stringify(buildAuditSummaryJson(entry), null, 2),
      'application/json;charset=utf-8',
      `${t('shared.exports.summaryFilePrefix')}-${getExportTimestampSegment(entry.timestamp)}.json`,
    )
    message.success(t('popup.messages.exportSummarySuccess'))
  }, [])

  const handleOpenImportPicker = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportAuditFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      setLoading(true)
      try {
        const rawContent = await file.text()
        const parsedPayload = JSON.parse(rawContent) as unknown
        const importedEntry = parseImportedAuditReport(parsedPayload)
        const persistImportedAudit = async () => {
          const persisted = await importAuditReportToHistory(importedEntry)
          const tab = activeTab ?? (await getActiveTab())
          setActiveTab(tab)

          const refreshedHistory = await getAuditHistoryForUrl(tab.url)
          const importedInCurrentUrl = refreshedHistory.some(
            (entry) => entry.id === persisted.entry.id,
          )

          if (importedInCurrentUrl) {
            setAuditHistory(refreshedHistory)
            handleSelectHistory(persisted.entry.id)
            setComparisonTargetId(refreshedHistory[0]?.id)
            setComparisonBaselineId(refreshedHistory[1]?.id || refreshedHistory[0]?.id)
            handleTabChange('history')
            setShowAboutView(false)
            message.success(t('popup.messages.importReadyForComparison'))
            return persisted
          }

          message.success(t('popup.messages.importStoredForUrl', { url: persisted.entry.url }))
          return persisted
        }

        const persisted = await persistWithQuotaHandling(persistImportedAudit, {
          url: importedEntry.url,
          scope: 'history',
          hasUnsavedChanges: true,
        })

        if (!persisted) {
          message.warning(t('popup.messages.quotaUnsavedImport'))
          return
        }
      } catch (error) {
        console.error('Erro ao importar relatório:', error)
        message.error(error instanceof Error ? error.message : t('popup.messages.importAuditError'))
      } finally {
        setLoading(false)
      }
    },
    [activeTab, handleSelectHistory, handleTabChange, persistWithQuotaHandling],
  )

  const handleFilterChange = useCallback(
    async (filter: VisionSimulationFilter) => {
      await chrome.storage.local.set({ visionFilter: filter })
      if (!activeTab?.id) return
      try {
        await ensureContentScriptReady(activeTab.id)
        await chrome.tabs.sendMessage(activeTab.id, { action: 'APPLY_VISION_FILTER', filter })
      } catch (error) {
        console.error('Erro ao aplicar simulador de percepção visual:', error)
      }
    },
    [activeTab?.id],
  )

  const handleHighlightAll = useCallback(async () => {
    if (!displayedAuditResult || isHistoricalView) return

    try {
      await sendMessageToActiveTab({
        action: 'HIGHLIGHT_ALL_VIOLATIONS',
        violations: displayedAuditResult.violations,
      })
      message.success(t('popup.messages.highlightsApplied'))
    } catch (error) {
      console.error('Erro ao destacar violações:', error)
      message.error(t('popup.messages.highlightError'))
    }
  }, [displayedAuditResult, isHistoricalView, sendMessageToActiveTab])

  const handleStartManualFindingSelection = useCallback(async () => {
    if (isHistoricalView) return

    try {
      await sendMessageToActiveTab({ action: 'START_MANUAL_FINDING_SELECTION' })
      message.info(t('popup.messages.manualFindingSelectionStarted'))
    } catch (error) {
      console.error('Erro ao iniciar seleção de achado manual:', error)
      message.error(t('popup.messages.manualFindingSelectionError'))
    }
  }, [isHistoricalView, sendMessageToActiveTab])

  const handleManualFindingRuleChange = useCallback(
    (ruleId: string) => {
      const selectedRule = allRules.find((rule) => rule.id === ruleId)
      if (!selectedRule) return

      manualFindingForm.setFieldsValue({ severity: selectedRule.severity })
    },
    [manualFindingForm],
  )

  const handleCloseManualFindingModal = useCallback(() => {
    setIsManualFindingModalOpen(false)
  }, [])

  const handleCancelManualFindingDraft = useCallback(async () => {
    if (manualFindingDraft?.tabId) {
      await clearManualFindingDraftForTab(manualFindingDraft.tabId)
    }

    setManualFindingDraft(null)
    setIsManualFindingModalOpen(false)
    manualFindingForm.resetFields()
  }, [clearManualFindingDraftForTab, manualFindingDraft?.tabId, manualFindingForm])

  const handleReselectManualFindingElement = useCallback(async () => {
    if (manualFindingDraft?.tabId) {
      await clearManualFindingDraftForTab(manualFindingDraft.tabId)
    }

    setManualFindingDraft(null)
    setIsManualFindingModalOpen(false)
    manualFindingForm.resetFields()
    await handleStartManualFindingSelection()
  }, [
    clearManualFindingDraftForTab,
    handleStartManualFindingSelection,
    manualFindingDraft?.tabId,
    manualFindingForm,
  ])

  const handleSaveManualFinding = useCallback(async () => {
    if (!auditResult || isHistoricalView || !activeTab?.id || !manualFindingDraft) {
      message.error(t('popup.messages.manualFindingSaveUnavailable'))
      return
    }

    setManualFindingSaving(true)
    try {
      const values = await manualFindingForm.validateFields()
      const selectedRule = allRules.find((rule) => rule.id === values.ruleId)
      if (!selectedRule) {
        message.error(t('popup.messages.manualFindingRuleMissing'))
        return
      }

      const manualViolation = createManualViolation(selectedRule, {
        draft: manualFindingDraft,
        message: values.message ?? '',
        suggestion: values.suggestion ?? '',
        remediationAdvice: values.remediationAdvice ?? '',
        severity: values.severity,
        userNote: values.userNote,
        createdAt: Date.now(),
      })
      const updatedResult = hydrateAuditResult({
        ...auditResult,
        violations: [...auditResult.violations, manualViolation],
      })

      syncAuditResultUpdate(updatedResult)
      const persisted = await persistWithQuotaHandling(
        async () => {
          await updateStoredAuditResult(updatedResult, activeTab.id)
          return true
        },
        { url: updatedResult.url, scope: 'review', hasUnsavedChanges: true },
      )
      if (persisted === null) {
        message.warning(t('popup.messages.quotaUnsavedReview'))
        return
      }

      await clearManualFindingDraftForTab(manualFindingDraft.tabId)
      setManualFindingDraft(null)
      setIsManualFindingModalOpen(false)
      manualFindingForm.resetFields()
      setActiveTabKey('violations')
      void persistPopupState({ activeTabKey: 'violations' })
      message.success(t('popup.messages.manualFindingSaved'))
    } catch (error) {
      if (typeof error === 'object' && error && 'errorFields' in error) {
        return
      }

      console.error('Erro ao salvar achado manual:', error)
      message.error(t('popup.messages.manualFindingSaveError'))
    } finally {
      setManualFindingSaving(false)
    }
  }, [
    activeTab?.id,
    auditResult,
    clearManualFindingDraftForTab,
    isHistoricalView,
    manualFindingDraft,
    manualFindingForm,
    persistPopupState,
    persistWithQuotaHandling,
    syncAuditResultUpdate,
  ])

  const handleHighlightViolation = useCallback(
    async (violation: Violation) => {
      try {
        await sendMessageToActiveTab({
          action: 'HIGHLIGHT_VIOLATION',
          violation,
        })
      } catch (error) {
        console.error('Erro ao destacar violação:', error)
      }
    },
    [sendMessageToActiveTab],
  )

  const comparisonEntries = useMemo(() => {
    const byId = new Map<string, AuditHistoryEntry>()
    auditHistory.forEach((entry) => byId.set(entry.id, entry))
    if (auditResult?.id) byId.set(auditResult.id, auditResult as AuditHistoryEntry)
    return Array.from(byId.values()).sort((left, right) => right.timestamp - left.timestamp)
  }, [auditHistory, auditResult])

  const comparisonSummary = useMemo(() => {
    if (
      !comparisonBaselineId ||
      !comparisonTargetId ||
      comparisonBaselineId === comparisonTargetId
    ) {
      return null
    }

    const baseline = comparisonEntries.find((entry) => entry.id === comparisonBaselineId)
    const target = comparisonEntries.find((entry) => entry.id === comparisonTargetId)
    if (!baseline || !target) return null
    return compareAuditResults(baseline, target)
  }, [comparisonBaselineId, comparisonEntries, comparisonTargetId])

  const comparisonTrend = useMemo(() => getComparisonTrend(comparisonSummary), [comparisonSummary])
  const storageWarning = useMemo(() => {
    if (!storageDiagnostics || storageDiagnostics.level === 'ok') return null

    const descriptionKey =
      storageDiagnostics.level === 'critical'
        ? 'popup.storage.criticalDescription'
        : 'popup.storage.warningDescription'
    const titleKey =
      storageDiagnostics.level === 'critical'
        ? 'popup.storage.criticalTitle'
        : 'popup.storage.warningTitle'

    return {
      descriptionKey,
      titleKey,
      type: storageDiagnostics.level === 'critical' ? ('error' as const) : ('warning' as const),
    }
  }, [storageDiagnostics])

  const handleCompactStorageNow = useCallback(async () => {
    setStorageMaintenanceLoading(true)
    try {
      await compactAuditStorage(activeTab?.id)
      const historyUrl = activeTab?.url || viewedAuditResult?.url
      const refreshedHistory = historyUrl ? await getAuditHistoryForUrl(historyUrl) : []

      if (historyUrl) {
        setAuditHistory(refreshedHistory)
        if (
          selectedHistoryId &&
          !refreshedHistory.some((entry) => entry.id === selectedHistoryId)
        ) {
          setSelectedHistoryId(null)
        }
        setComparisonTargetId(refreshedHistory[0]?.id)
        setComparisonBaselineId(refreshedHistory[1]?.id || refreshedHistory[0]?.id)
      }

      await refreshStorageDiagnostics(historyUrl)
      message.success(t('popup.messages.storageCompacted'))
    } catch (error) {
      console.error('Erro ao compactar armazenamento local:', error)
      message.error(t('popup.messages.storageCompactError'))
    } finally {
      setStorageMaintenanceLoading(false)
    }
  }, [
    activeTab?.id,
    activeTab?.url,
    refreshStorageDiagnostics,
    selectedHistoryId,
    viewedAuditResult?.url,
  ])

  const handleExportComparisonReport = useCallback(() => {
    if (!comparisonSummary || !comparisonTrend) {
      message.warning(t('popup.messages.comparisonSelectWarning'))
      return
    }

    const lines = [
      `# ${t('popup.history.exportTitle')}`,
      '',
      `- ${t('popup.history.exportedAt')}: ${new Date().toISOString()}`,
      `- ${t('popup.history.exportUrl')}: ${activeTab?.url || viewedAuditResult?.url || ''}`,
      `- ${t('popup.history.exportBaseline')}: ${new Date(comparisonSummary.baselineTimestamp).toLocaleString('pt-BR')}`,
      `- ${t('popup.history.exportTarget')}: ${new Date(comparisonSummary.targetTimestamp).toLocaleString('pt-BR')}`,
      `- ${t('popup.history.exportResult')}: ${comparisonTrend.label}`,
      '',
      `## ${t('popup.history.exportIndicatorsTitle')}`,
      '',
      `- ${t('popup.history.exportVisibleItems')}: ${comparisonSummary.baselineOpenCount} -> ${comparisonSummary.targetOpenCount} (${comparisonSummary.openIssuesDeltaPercentage}%)`,
      `- ${t('popup.history.exportNewProblems')}: ${comparisonSummary.newViolations.length}`,
      `- ${t('popup.history.exportResolvedProblems')}: ${comparisonSummary.resolvedViolations.length}`,
      `- ${t('popup.history.exportPersistentProblems')}: ${comparisonSummary.persistentViolations.length}`,
      `- ${t('popup.history.exportStateChangedFindings')}: ${comparisonSummary.stateChangedViolations.length}`,
      `- ${t('popup.history.exportNotes')}: ${comparisonSummary.baselineNoteCount} -> ${comparisonSummary.targetNoteCount} (${comparisonSummary.notesDeltaPercentage}%)`,
      `- ${t('popup.history.exportAlternativeTextReviews')}: ${comparisonSummary.baselineAlternativeTextReviewCount} -> ${comparisonSummary.targetAlternativeTextReviewCount} (${comparisonSummary.alternativeTextReviewsDeltaPercentage}%)`,
      `- ${t('popup.history.exportConfirmedFindings')}: ${comparisonSummary.baselineConfirmedReviews} -> ${comparisonSummary.targetConfirmedReviews} (${comparisonSummary.confirmedReviewsDeltaPercentage}%)`,
      `- ${t('popup.history.exportCompletedReview')}: ${comparisonSummary.baselineConfirmedReviews + comparisonSummary.baselineDismissedReviews} -> ${comparisonSummary.targetConfirmedReviews + comparisonSummary.targetDismissedReviews}`,
      `- ${t('popup.history.exportPendingReview')}: ${comparisonSummary.baselinePendingReviews} -> ${comparisonSummary.targetPendingReviews}`,
      '',
      `## ${t('popup.history.exportHumanReviewTitle')}`,
      '',
      `- ${t('popup.history.exportConfirmedReview')}: ${comparisonSummary.baselineConfirmedReviews} -> ${comparisonSummary.targetConfirmedReviews}`,
      `- ${t('popup.history.exportIgnoredFindings')}: ${comparisonSummary.baselineDismissedReviews} -> ${comparisonSummary.targetDismissedReviews}`,
      `- ${t('popup.history.exportPendingReviewItems')}: ${comparisonSummary.baselinePendingReviews} -> ${comparisonSummary.targetPendingReviews}`,
      '',
      `## ${t('popup.history.exportQuickReadingTitle')}`,
      '',
      getComparisonQuickReadingLabel(comparisonTrend.label),
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${t('shared.exports.comparisonFilePrefix')}-${getExportTimestampSegment(comparisonSummary.targetTimestamp)}.md`
    link.click()
    URL.revokeObjectURL(url)
    message.success(t('popup.messages.comparisonExported'))
  }, [activeTab?.url, comparisonSummary, comparisonTrend, viewedAuditResult?.url])

  const handleExportComparisonJson = useCallback(() => {
    if (!comparisonSummary) {
      message.warning(t('popup.messages.comparisonSelectWarning'))
      return
    }

    const dataStr = JSON.stringify({ exportedAt: Date.now(), ...comparisonSummary }, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${t('shared.exports.comparisonFilePrefix')}-${getExportTimestampSegment(comparisonSummary.targetTimestamp)}.json`
    link.click()
    URL.revokeObjectURL(url)
    message.success(t('popup.messages.comparisonExportedJson'))
  }, [comparisonSummary])

  const handleExportComparisonCsv = useCallback(() => {
    if (!comparisonSummary) {
      message.warning(t('popup.messages.comparisonSelectWarning'))
      return
    }

    const rows = [
      [t('popup.history.exportedAt'), new Date().toISOString(), '', ''],
      [
        t('popup.history.comparisonCsv.indicator'),
        t('popup.history.comparisonCsv.baseline'),
        t('popup.history.comparisonCsv.target'),
        t('popup.history.comparisonCsv.deltaPercentage'),
      ],
      [
        t('popup.history.comparisonCsv.visibleItems'),
        comparisonSummary.baselineOpenCount,
        comparisonSummary.targetOpenCount,
        comparisonSummary.openIssuesDeltaPercentage,
      ],
      [
        t('popup.history.comparisonCsv.completedHumanReview'),
        comparisonSummary.baselineConfirmedReviews + comparisonSummary.baselineDismissedReviews,
        comparisonSummary.targetConfirmedReviews + comparisonSummary.targetDismissedReviews,
        '',
      ],
      [
        t('popup.history.comparisonCsv.pendingHumanReview'),
        comparisonSummary.baselinePendingReviews,
        comparisonSummary.targetPendingReviews,
        '',
      ],
      [
        t('popup.history.comparisonCsv.confirmedHumanReview'),
        comparisonSummary.baselineConfirmedReviews,
        comparisonSummary.targetConfirmedReviews,
        comparisonSummary.confirmedReviewsDeltaPercentage,
      ],
      [
        t('popup.history.comparisonCsv.ignoredFindings'),
        comparisonSummary.baselineDismissedReviews,
        comparisonSummary.targetDismissedReviews,
        '',
      ],
      [
        t('popup.history.comparisonCsv.pendingHumanItems'),
        comparisonSummary.baselinePendingReviews,
        comparisonSummary.targetPendingReviews,
        '',
      ],
      [
        t('popup.history.comparisonCsv.notes'),
        comparisonSummary.baselineNoteCount,
        comparisonSummary.targetNoteCount,
        comparisonSummary.notesDeltaPercentage,
      ],
      [
        t('popup.history.comparisonCsv.newProblems'),
        '',
        comparisonSummary.newViolations.length,
        '',
      ],
      [
        t('popup.history.comparisonCsv.resolvedProblems'),
        comparisonSummary.resolvedViolations.length,
        '',
        '',
      ],
      [
        t('popup.history.comparisonCsv.persistentProblems'),
        '',
        comparisonSummary.persistentViolations.length,
        '',
      ],
      [
        t('popup.history.comparisonCsv.stateChangedFindings'),
        '',
        comparisonSummary.stateChangedViolations.length,
        '',
      ],
    ]

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${t('shared.exports.comparisonFilePrefix')}-${getExportTimestampSegment(comparisonSummary.targetTimestamp)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    message.success(t('popup.messages.comparisonExportedCsv'))
  }, [comparisonSummary])

  const priorityViolations = useMemo(
    () =>
      displayedAuditResult && !isHistoricalView
        ? getPriorityViolations(displayedAuditResult.violations)
        : [],
    [displayedAuditResult, isHistoricalView],
  )

  const handleFindingStatusChange = useCallback(
    async (violation: Violation, update: FindingStatusUpdate) => {
      if (!viewedAuditResult) return

      const updatedResult: AuditResult = {
        ...viewedAuditResult,
        violations: viewedAuditResult.violations.map((currentViolation) =>
          currentViolation.id === violation.id
            ? applyFindingStatusUpdate(currentViolation, update)
            : currentViolation,
        ),
      }

      syncAuditResultUpdate(updatedResult)
      const persisted = await persistWithQuotaHandling(
        async () => {
          await updateStoredAuditResult(updatedResult, activeTab?.id)
          return true
        },
        { url: updatedResult.url, scope: 'review', hasUnsavedChanges: true },
      )
      if (persisted === null) {
        message.warning(t('popup.messages.quotaUnsavedReview'))
      }
    },
    [activeTab?.id, persistWithQuotaHandling, syncAuditResultUpdate, viewedAuditResult],
  )

  const handleBulkFindingStatusChange = useCallback(
    async (violation: Violation, update: FindingStatusUpdate) => {
      if (!viewedAuditResult) return

      let affectedCount = 0
      const updatedResult = hydrateAuditResult({
        ...viewedAuditResult,
        violations: viewedAuditResult.violations.map((currentViolation) => {
          if (!areSimilarViolations(currentViolation, violation)) return currentViolation
          if (currentViolation.findingStatus === 'ignored') return currentViolation

          affectedCount += 1
          return applyFindingStatusUpdate(currentViolation, update)
        }),
      })

      if (affectedCount === 0) return

      syncAuditResultUpdate(updatedResult)
      const persisted = await persistWithQuotaHandling(
        async () => {
          await updateStoredAuditResult(updatedResult, activeTab?.id)
          return true
        },
        { url: updatedResult.url, scope: 'review', hasUnsavedChanges: true },
      )
      if (persisted === null) {
        message.warning(t('popup.messages.quotaUnsavedReview'))
        return
      }

      message.success(t('popup.messages.bulkFindingsIgnored', { count: affectedCount }))
    },
    [activeTab?.id, persistWithQuotaHandling, syncAuditResultUpdate, viewedAuditResult],
  )

  const handleViolationNoteChange = useCallback(
    async (violation: Violation, note: string) => {
      if (!viewedAuditResult) return

      const updatedResult: AuditResult = {
        ...viewedAuditResult,
        violations: viewedAuditResult.violations.map((currentViolation) =>
          currentViolation.id === violation.id
            ? {
                ...currentViolation,
                userNote: note || undefined,
                noteUpdatedAt: note ? Date.now() : undefined,
              }
            : currentViolation,
        ),
      }

      syncAuditResultUpdate(updatedResult)
      const persisted = await persistWithQuotaHandling(
        async () => {
          await updateStoredAuditResult(updatedResult, activeTab?.id)
          return true
        },
        { url: updatedResult.url, scope: 'review', hasUnsavedChanges: true },
      )
      if (persisted === null) {
        message.warning(t('popup.messages.quotaUnsavedReview'))
        return
      }
      message.success(note ? t('popup.messages.noteSaved') : t('popup.messages.noteRemoved'))
    },
    [activeTab?.id, persistWithQuotaHandling, syncAuditResultUpdate, viewedAuditResult],
  )

  const handleViolationAlternativeTextReviewChange = useCallback(
    async (violation: Violation, review: Violation['alternativeTextReview']) => {
      if (!viewedAuditResult) return

      const updatedResult: AuditResult = {
        ...viewedAuditResult,
        violations: viewedAuditResult.violations.map((currentViolation) =>
          currentViolation.id === violation.id
            ? {
                ...currentViolation,
                alternativeTextReview: review,
              }
            : currentViolation,
        ),
      }

      syncAuditResultUpdate(updatedResult)
      const persisted = await persistWithQuotaHandling(
        async () => {
          await updateStoredAuditResult(updatedResult, activeTab?.id)
          return true
        },
        { url: updatedResult.url, scope: 'review', hasUnsavedChanges: true },
      )
      if (persisted === null) {
        message.warning(t('popup.messages.quotaUnsavedReview'))
        return
      }
      message.success(
        review?.proposedText
          ? t('popup.messages.alternativeTextSaved')
          : t('popup.messages.alternativeTextRemoved'),
      )
    },
    [activeTab?.id, persistWithQuotaHandling, syncAuditResultUpdate, viewedAuditResult],
  )

  const handleViolationContrastOverrideChange = useCallback(
    async (violation: Violation, override: Violation['userContrastOverride'] | undefined) => {
      if (!viewedAuditResult) return

      const updatedResult: AuditResult = {
        ...viewedAuditResult,
        violations: viewedAuditResult.violations.map((currentViolation) =>
          currentViolation.id === violation.id
            ? {
                ...currentViolation,
                userContrastOverride: override,
              }
            : currentViolation,
        ),
      }

      syncAuditResultUpdate(updatedResult)
      const persisted = await persistWithQuotaHandling(
        async () => {
          await updateStoredAuditResult(updatedResult, activeTab?.id)
          return true
        },
        { url: updatedResult.url, scope: 'review', hasUnsavedChanges: true },
      )
      if (persisted === null) {
        message.warning(t('popup.messages.quotaUnsavedReview'))
        return
      }
      message.success(
        override ? t('popup.messages.contrastSaved') : t('popup.messages.contrastRemoved'),
      )
    },
    [activeTab?.id, persistWithQuotaHandling, syncAuditResultUpdate, viewedAuditResult],
  )

  const handleBulkViolationContrastOverrideChange = useCallback(
    async (violation: Violation, override: NonNullable<Violation['userContrastOverride']>) => {
      if (!viewedAuditResult) return

      let affectedCount = 0
      const updatedResult = hydrateAuditResult({
        ...viewedAuditResult,
        violations: viewedAuditResult.violations.map((currentViolation) => {
          if (!currentViolation.contrastDetails) return currentViolation
          if (!areSimilarViolations(currentViolation, violation)) return currentViolation

          affectedCount += 1
          return {
            ...currentViolation,
            userContrastOverride: override,
          }
        }),
      })

      if (affectedCount === 0) return

      syncAuditResultUpdate(updatedResult)
      const persisted = await persistWithQuotaHandling(
        async () => {
          await updateStoredAuditResult(updatedResult, activeTab?.id)
          return true
        },
        { url: updatedResult.url, scope: 'review', hasUnsavedChanges: true },
      )
      if (persisted === null) {
        message.warning(t('popup.messages.quotaUnsavedReview'))
        return
      }

      message.success(t('popup.messages.bulkContrastApplied', { count: affectedCount }))
      const previewItems = updatedResult.violations
        .filter(
          (currentViolation) =>
            Boolean(currentViolation.contrastDetails) &&
            areSimilarViolations(currentViolation, violation),
        )
        .map((currentViolation) => createContrastPreviewItem(currentViolation, override))
        .filter((item): item is ContrastPreviewItem => Boolean(item))
      await syncContrastPreviewsOnPage(previewItems, true)
    },
    [
      activeTab?.id,
      persistWithQuotaHandling,
      syncAuditResultUpdate,
      syncContrastPreviewsOnPage,
      viewedAuditResult,
    ],
  )

  const handleResolveQuotaIssue = useCallback(
    async (strategy: 'current-url' | 'oldest-audit' | 'global') => {
      if (!quotaIssue || !quotaRetryRef.current) return

      setQuotaRecoveryLoading(true)
      try {
        if (strategy === 'current-url') {
          await clearAuditHistoryForUrl(quotaIssue.url)
        } else if (strategy === 'oldest-audit') {
          await deleteOldestAuditHistoryEntry()
        } else {
          await compactAuditStorage(activeTab?.id)
        }

        await quotaRetryRef.current()
        const refreshedHistory = await getAuditHistoryForUrl(quotaIssue.url)
        setAuditHistory(refreshedHistory)
        setComparisonTargetId(refreshedHistory[0]?.id)
        setComparisonBaselineId(refreshedHistory[1]?.id || refreshedHistory[0]?.id)
        await refreshStorageDiagnostics(quotaIssue.url)
        setQuotaIssue(null)
        setIsQuotaModalOpen(false)
        quotaRetryRef.current = null
        message.success(t('popup.messages.quotaRecovered'))
      } catch (error) {
        console.error('Erro ao recuperar quota do storage:', error)
        if (isAuditStorageQuotaError(error)) {
          message.error(t('popup.messages.quotaRecoveryFailed'))
          return
        }
        message.error(
          error instanceof Error ? error.message : t('popup.messages.quotaRecoveryFailed'),
        )
      } finally {
        setQuotaRecoveryLoading(false)
      }
    },
    [activeTab?.id, quotaIssue, refreshStorageDiagnostics],
  )

  const handleNextPriorityIssue = useCallback(async () => {
    if (isHistoricalView) {
      message.info(t('popup.messages.historyHighlightUnavailable'))
      return
    }
    if (priorityViolations.length === 0) {
      message.info(t('popup.messages.noPriorityAvailable'))
      return
    }

    const nextViolation = priorityViolations[priorityIndex % priorityViolations.length]
    await handleHighlightViolation(nextViolation)
    setPriorityIndex((current) => (current + 1) % priorityViolations.length)
    message.success(t('popup.messages.priorityFocus', { name: nextViolation.ruleName }))
  }, [handleHighlightViolation, isHistoricalView, priorityIndex, priorityViolations])

  const footerActions = useMemo(() => {
    if (!displayedAuditResult) return []

    return [
      {
        key: 'rerun',
        label: t('shared.actions.rerun'),
        icon: <ReloadOutlined />,
        onClick: handleRunAudit,
        loading,
        disabled: !canRerunViewedAudit,
      },
      {
        key: 'manual-finding',
        label: t('shared.actions.createManualFinding'),
        icon: <PlusOutlined />,
        onClick: handleStartManualFindingSelection,
        disabled: isHistoricalView,
      },
      {
        key: 'highlight',
        label: t('shared.actions.highlightAll'),
        icon: <EyeOutlined />,
        onClick: handleHighlightAll,
        disabled: isHistoricalView,
      },
      {
        key: 'priority',
        label: t('shared.actions.nextPriority'),
        icon: <FlagOutlined />,
        onClick: handleNextPriorityIssue,
        disabled: isHistoricalView,
      },
      {
        key: 'clear-highlight',
        label: t('shared.actions.clearHighlights'),
        icon: <StopOutlined />,
        onClick: () => {
          void clearHighlightsOnPage(true)
        },
        disabled: isHistoricalView,
      },
      {
        key: 'csv',
        label: t('shared.actions.exportCsv'),
        icon: <DownloadOutlined />,
        onClick: handleExportCSV,
      },
      {
        key: 'json',
        label: t('shared.actions.exportJson'),
        icon: <DownloadOutlined />,
        onClick: handleExportJSON,
        type: 'primary' as const,
      },
    ]
  }, [
    displayedAuditResult,
    handleRunAudit,
    canRerunViewedAudit,
    loading,
    handleStartManualFindingSelection,
    handleHighlightAll,
    isHistoricalView,
    handleNextPriorityIssue,
    clearHighlightsOnPage,
    handleExportJSON,
    handleExportCSV,
  ])

  const tabItems = useMemo(() => {
    if (!displayedAuditResult) return []

    return [
      {
        key: 'summary',
        label: t('popup.tabs.summary'),
        children: (
          <ViolationsSummary
            result={displayedAuditResult}
            reviewSourceResult={reviewSourceResult}
            onDownloadFullReport={handleExportJSON}
            onDownloadSummary={handleExportSummary}
            onOpenViolations={() => handleTabChange('violations')}
            onRerunAudit={canRerunViewedAudit ? handleRunAudit : undefined}
          />
        ),
      },
      {
        key: 'violations',
        label: t('popup.tabs.violations', { count: displayedAuditResult.totalViolations }),
        children: (
          <ViolationsList
            violations={scopedRawViolations}
            state={popupStoredState?.violationsListState}
            showHumanReview={includeHumanReview}
            onSelectViolation={isHistoricalView ? undefined : handleHighlightViolation}
            onFindingStatusChange={handleFindingStatusChange}
            onBulkFindingStatusChange={handleBulkFindingStatusChange}
            onStateChange={handleViolationsListStateChange}
            onViolationNoteChange={handleViolationNoteChange}
            onViolationAlternativeTextReviewChange={handleViolationAlternativeTextReviewChange}
            onViolationContrastOverrideChange={handleViolationContrastOverrideChange}
            onBulkViolationContrastOverrideChange={handleBulkViolationContrastOverrideChange}
            onViolationContrastPreviewChange={handleViolationContrastPreviewChange}
            onContrastPreviewEnd={() => {
              void clearContrastPreviewsOnPage()
            }}
          />
        ),
      },
      {
        key: 'history',
        label: t('popup.tabs.history', { count: auditHistory.length }),
        children: (
          <HistoryTabPanel
            activeTabTitle={activeTab?.title}
            auditHistory={auditHistory}
            siteAuditHistory={siteAuditHistory}
            auditResultId={auditResult?.id}
            selectedHistoryId={selectedHistoryId}
            comparisonEntries={comparisonEntries}
            comparisonBaselineId={comparisonBaselineId}
            comparisonTargetId={comparisonTargetId}
            comparisonSummary={comparisonSummary}
            comparisonTrend={comparisonTrend}
            onSelectHistory={handleSelectHistory}
            onDeleteHistoryEntry={setHistoryEntryPendingDeletion}
            onComparisonBaselineChange={setComparisonBaselineId}
            onComparisonTargetChange={setComparisonTargetId}
            onExportMarkdown={handleExportComparisonReport}
            onExportJson={handleExportComparisonJson}
            onExportCsv={handleExportComparisonCsv}
            onExportHistoryJson={handleExportHistoryJSON}
            onExportHistoryCsv={handleExportHistoryCSV}
            onExportHistorySummary={handleExportHistorySummary}
            onImportJson={handleOpenImportPicker}
          />
        ),
      },
    ]
  }, [
    displayedAuditResult,
    reviewSourceResult,
    handleExportJSON,
    handleExportSummary,
    handleTabChange,
    handleRunAudit,
    canRerunViewedAudit,
    includeHumanReview,
    scopedRawViolations,
    popupStoredState?.violationsListState,
    isHistoricalView,
    handleHighlightViolation,
    handleFindingStatusChange,
    handleBulkFindingStatusChange,
    handleViolationsListStateChange,
    handleViolationNoteChange,
    handleViolationAlternativeTextReviewChange,
    handleViolationContrastOverrideChange,
    handleBulkViolationContrastOverrideChange,
    handleViolationContrastPreviewChange,
    clearContrastPreviewsOnPage,
    activeTab?.title,
    auditHistory,
    siteAuditHistory,
    auditResult?.id,
    selectedHistoryId,
    handleSelectHistory,
    comparisonEntries,
    comparisonBaselineId,
    comparisonTargetId,
    comparisonSummary,
    comparisonTrend,
    handleExportComparisonReport,
    handleExportComparisonJson,
    handleExportComparisonCsv,
    handleExportHistoryJSON,
    handleExportHistoryCSV,
    handleExportHistorySummary,
    handleOpenImportPicker,
  ])

  const canReturnFromAbout = showAboutView && Boolean(displayedAuditResult)
  const canOpenAbout = !showAboutView && Boolean(displayedAuditResult)
  const displayedPageTitle =
    displayedAuditResult?.pageTitle || activeTab?.title || activeTab?.url || ''

  return (
    <Layout className="popup-app">
      <Header className="popup-header">
        <div className="header-row">
          <div className="header-content">
            <h1 className="header-title">
              <img src={appIconUrl} alt="" className="header-title-icon" aria-hidden="true" />
              <span>{t('shared.brand.name')}</span>
              <Tag className="header-stage-tag" color="gold">
                {t('shared.states.beta')}
              </Tag>
              <span className="header-version-tag">v{APP_VERSION}</span>
            </h1>
            <p
              title={
                displayedPageTitle ? t('popup.header.activeTab', { title: displayedPageTitle }) : ''
              }
            >
              {displayedPageTitle
                ? t('popup.header.activeTab', {
                    title: truncateHeaderTabTitle(displayedPageTitle),
                  })
                : t('popup.header.fallback')}
            </p>
          </div>
          <Space>
            {canReturnFromAbout ? (
              <Button icon={<ArrowLeftOutlined />} onClick={() => setShowAboutView(false)}>
                {t('shared.actions.back')}
              </Button>
            ) : canOpenAbout ? (
              <Button icon={<InfoCircleOutlined />} onClick={() => setShowAboutView(true)}>
                {t('shared.actions.about')}
              </Button>
            ) : null}
          </Space>
        </div>
      </Header>

      <Content ref={popupContentRef} className="popup-content" onScroll={handlePopupScroll}>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            void handleImportAuditFile(event)
          }}
          hidden
        />
        {initialLoading || loading ? (
          <PopupPanelSkeleton />
        ) : showAboutView || !displayedAuditResult ? (
          <Suspense fallback={<PopupPanelSkeleton />}>
            <AboutPanel
              hasAudit={Boolean(viewedAuditResult)}
              loading={loading}
              onBack={() => setShowAboutView(false)}
              onImport={handleOpenImportPicker}
              onStart={() => {
                void handleRunAudit()
              }}
            />
          </Suspense>
        ) : (
          <>
            <section className="audit-meta-panel">
              <div className="audit-meta-header">
                <div className="audit-meta-primary">
                  <span className="audit-meta-date">
                    <span className="tab-status-label">
                      {isHistoricalView
                        ? t('shared.labels.historyOf')
                        : t('shared.labels.auditedAt')}
                    </span>
                    <strong>
                      <ClockCircleOutlined />{' '}
                      {new Date(displayedAuditResult.timestamp).toLocaleString('pt-BR')}
                    </strong>
                  </span>
                  <span className="audit-meta-url" title={displayedAuditResult.url}>
                    <LinkOutlined aria-hidden="true" />
                    <span>{displayedAuditResult.url}</span>
                  </span>
                </div>
                <div className="audit-meta-actions">
                  <Tooltip title={t('shared.actions.copyUrl')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      aria-label={t('shared.actions.copyUrl')}
                      onClick={() => {
                        void handleCopyAuditUrl()
                      }}
                    />
                  </Tooltip>
                  <button
                    className="audit-meta-toggle"
                    type="button"
                    aria-expanded={!isAuditMetaCollapsed}
                    aria-label={t('popup.scope.toggleDetails')}
                    onClick={handleAuditMetaToggle}
                  >
                    <span className="audit-meta-toggle-icon" aria-hidden="true">
                      {isAuditMetaCollapsed ? <DownOutlined /> : <UpOutlined />}
                    </span>
                  </button>
                </div>
              </div>

              {!isAuditMetaCollapsed && (
                <div className="tab-status-strip">
                  <div className="tab-status-item tab-status-item-toggle">
                    <span className="tab-status-label">
                      {t('popup.scope.toggleLabel')}:{' '}
                      {includeRecommendations
                        ? t('popup.scope.currentScopeWithRecommendations')
                        : t('popup.scope.currentScopeRequirementsOnly')}
                    </span>
                    <div className="recommendations-toggle-row">
                      <Switch
                        checked={includeRecommendations}
                        loading={loading}
                        onChange={(checked) => {
                          void handleRecommendationsToggle(checked)
                        }}
                      />
                      <div className="recommendations-toggle-copy">
                        <strong>{t('popup.scope.enableAction')}</strong>
                        <small>{t('popup.scope.normativeNote')}</small>
                      </div>
                    </div>
                  </div>
                  {showHumanReviewScopeToggle && (
                    <div className="tab-status-item tab-status-item-toggle">
                      <span className="tab-status-label">
                        {t('popup.scope.humanReviewLabel')}:{' '}
                        {includeHumanReview
                          ? t('popup.scope.humanReviewIncluded')
                          : t('popup.scope.humanReviewExcluded')}
                      </span>
                      <div className="recommendations-toggle-row">
                        <Switch
                          checked={includeHumanReview}
                          loading={loading}
                          onChange={(checked) => {
                            void handleHumanReviewToggle(checked)
                          }}
                        />
                        <div className="recommendations-toggle-copy">
                          <strong>{t('popup.scope.humanReviewAction')}</strong>
                          <small>{t('popup.scope.humanReviewNote')}</small>
                        </div>
                      </div>
                    </div>
                  )}
                  {quotaIssue && !isQuotaModalOpen && (
                    <div className="tab-status-item tab-status-item-toggle">
                      <span className="tab-status-label">{t('popup.quota.resumeLabel')}</span>
                      <Button
                        danger
                        className="quota-resume-button"
                        onClick={() => setIsQuotaModalOpen(true)}
                      >
                        {t('popup.quota.actions.reopen')}
                      </Button>
                    </div>
                  )}
                  <Tag color={isHistoricalView ? 'gold' : 'blue'}>
                    {isHistoricalView
                      ? t('shared.labels.historyByUrl')
                      : t('shared.labels.currentAudit')}
                  </Tag>
                </div>
              )}
            </section>

            {isHistoricalView && (
              <Alert
                className="history-alert"
                type="warning"
                showIcon
                message={t('popup.history.warningTitle')}
                description={t('popup.history.warningDescription')}
              />
            )}

            {quotaIssue && (
              <Alert
                className="history-alert"
                type="error"
                showIcon
                message={t('popup.quota.alertTitle')}
                description={t(
                  getQuotaAlertDescriptionKey(quotaIssue.scope, quotaIssue.hasUnsavedChanges),
                )}
              />
            )}

            {storageWarning && storageDiagnostics && (
              <Alert
                className="storage-warning-alert"
                type={storageWarning.type}
                showIcon
                message={t(storageWarning.titleKey)}
                description={
                  <div className="storage-warning-copy">
                    <p>
                      {t(storageWarning.descriptionKey, {
                        audits: storageDiagnostics.historyEntryCount,
                        total: formatStorageSize(storageDiagnostics.quotaBytes),
                        urls: storageDiagnostics.urlCount,
                        used: formatStorageSize(storageDiagnostics.usedBytes),
                      })}
                    </p>
                    {storageDiagnostics.currentUrlEntryCount > 0 && (
                      <p>
                        {t('popup.storage.currentUrlDescription', {
                          count: storageDiagnostics.currentUrlEntryCount,
                        })}
                      </p>
                    )}
                    <p>{t('popup.storage.retentionNote')}</p>
                  </div>
                }
                action={
                  <Button
                    size="small"
                    loading={storageMaintenanceLoading}
                    onClick={() => {
                      void handleCompactStorageNow()
                    }}
                  >
                    {t('popup.storage.actions.compactNow')}
                  </Button>
                }
              />
            )}

            <Suspense fallback={<PopupPanelSkeleton />}>
              <Tabs activeKey={activeTabKey} onChange={handleTabChange} items={tabItems} />
            </Suspense>

            <div className="vision-floating-shell">
              {hasVisionSimulatorMounted && (
                <section
                  className="vision-floating-panel"
                  aria-label={t('vision.title')}
                  hidden={!isVisionSimulatorOpen}
                >
                  <div className="vision-floating-panel-header">
                    <div>
                      <span className="vision-floating-eyebrow">{t('vision.floatingHint')}</span>
                      <strong>{t('vision.title')}</strong>
                    </div>
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      aria-label={t('shared.actions.close')}
                      onClick={() => setIsVisionSimulatorOpen(false)}
                    />
                  </div>
                  <Suspense fallback={<PopupPanelSkeleton />}>
                    <VisionSimulator onFilterChange={handleFilterChange} />
                  </Suspense>
                </section>
              )}
              <Tooltip placement="topLeft" title={t('vision.openFloatingPanel')}>
                <Button
                  className="vision-floating-button"
                  type={isVisionSimulatorOpen ? 'default' : 'primary'}
                  shape="circle"
                  icon={<EyeOutlined />}
                  aria-label={t('vision.openFloatingPanel')}
                  aria-expanded={isVisionSimulatorOpen}
                  onClick={() => {
                    if (!isVisionSimulatorOpen) {
                      setHasVisionSimulatorMounted(true)
                    }
                    setIsVisionSimulatorOpen((current) => !current)
                  }}
                />
              </Tooltip>
            </div>
          </>
        )}
      </Content>

      <Modal
        open={isManualFindingModalOpen}
        title={t('popup.manualFinding.title')}
        onCancel={handleCloseManualFindingModal}
        footer={[
          <Button key="cancel-draft" onClick={() => void handleCancelManualFindingDraft()}>
            {t('popup.manualFinding.actions.cancelDraft')}
          </Button>,
          <Button key="reselect" onClick={() => void handleReselectManualFindingElement()}>
            {t('popup.manualFinding.actions.reselect')}
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={manualFindingSaving}
            onClick={() => void handleSaveManualFinding()}
          >
            {t('popup.manualFinding.actions.save')}
          </Button>,
        ]}
        getContainer={false}
        centered
        width={560}
      >
        {manualFindingDraft ? (
          <Space direction="vertical" size={16} className="manual-finding-modal-content">
            <Alert
              type="info"
              showIcon
              message={t('popup.manualFinding.selectedElementTitle')}
              description={t('popup.manualFinding.selectedElementDescription')}
            />

            <div className="manual-finding-element-preview">
              <div className="manual-finding-element-preview-header">
                {manualFindingDraft.tagName && <Tag>{manualFindingDraft.tagName}</Tag>}
                <code>{manualFindingDraft.selector}</code>
              </div>
              {manualFindingDraft.accessibleName && (
                <p>
                  <strong>{t('shared.labels.accessibleName')}:</strong>{' '}
                  {manualFindingDraft.accessibleName}
                </p>
              )}
              {manualFindingDraft.visibleText && (
                <p>
                  <strong>{t('shared.labels.visibleText')}:</strong>{' '}
                  {manualFindingDraft.visibleText}
                </p>
              )}
              <pre>{manualFindingDraft.snippet}</pre>
            </div>

            <Form
              form={manualFindingForm}
              layout="vertical"
              className="manual-finding-form"
              requiredMark
            >
              <Form.Item
                name="ruleId"
                label={t('popup.manualFinding.fields.rule')}
                rules={[{ required: true, message: t('popup.manualFinding.validation.rule') }]}
              >
                <Select
                  showSearch
                  options={manualFindingRuleOptions}
                  optionFilterProp="searchLabel"
                  placeholder={t('popup.manualFinding.placeholders.rule')}
                  onChange={handleManualFindingRuleChange}
                />
              </Form.Item>

              <Form.Item
                name="severity"
                label={t('popup.manualFinding.fields.severity')}
                rules={[{ required: true, message: t('popup.manualFinding.validation.severity') }]}
              >
                <Select options={manualFindingSeverityOptions} />
              </Form.Item>

              <Form.Item
                name="message"
                label={t('popup.manualFinding.fields.message')}
                rules={[{ required: true, message: t('popup.manualFinding.validation.message') }]}
              >
                <Input.TextArea
                  rows={2}
                  maxLength={300}
                  showCount
                  placeholder={t('popup.manualFinding.placeholders.message')}
                />
              </Form.Item>

              <Form.Item
                name="suggestion"
                label={t('popup.manualFinding.fields.suggestion')}
                rules={[
                  { required: true, message: t('popup.manualFinding.validation.suggestion') },
                ]}
              >
                <Input.TextArea
                  rows={2}
                  maxLength={400}
                  showCount
                  placeholder={t('popup.manualFinding.placeholders.suggestion')}
                />
              </Form.Item>

              <Form.Item
                name="remediationAdvice"
                label={t('popup.manualFinding.fields.remediationAdvice')}
                rules={[
                  {
                    required: true,
                    message: t('popup.manualFinding.validation.remediationAdvice'),
                  },
                ]}
              >
                <Input.TextArea
                  rows={3}
                  maxLength={600}
                  showCount
                  placeholder={t('popup.manualFinding.placeholders.remediationAdvice')}
                />
              </Form.Item>

              <Form.Item
                name="userNote"
                label={t('popup.manualFinding.fields.userNote')}
                extra={t('popup.manualFinding.fields.userNoteHelp')}
              >
                <Input.TextArea
                  rows={2}
                  maxLength={400}
                  showCount
                  placeholder={t('popup.manualFinding.placeholders.userNote')}
                />
              </Form.Item>
            </Form>
          </Space>
        ) : (
          <Alert
            type="warning"
            showIcon
            message={t('popup.manualFinding.emptyDraftTitle')}
            description={t('popup.manualFinding.emptyDraftDescription')}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(historyEntryPendingDeletion)}
        title={t('popup.history.deleteModalTitle')}
        okText={t('popup.history.deleteConfirm')}
        cancelText={t('popup.history.deleteCancel')}
        okButtonProps={{ danger: true }}
        onCancel={() => setHistoryEntryPendingDeletion(null)}
        onOk={async () => {
          if (!historyEntryPendingDeletion) return
          await deleteAuditHistoryEntry(
            historyEntryPendingDeletion.url,
            historyEntryPendingDeletion.id,
          )
          const currentUrl = activeTab?.url || auditResult?.url || historyEntryPendingDeletion.url
          const [updatedHistory, updatedSiteHistory] = await Promise.all([
            getAuditHistoryForUrl(currentUrl),
            getAuditHistoryForSite(currentUrl),
          ])
          await refreshStorageDiagnostics(currentUrl)
          setAuditHistory(updatedHistory)
          setSiteAuditHistory(updatedSiteHistory)
          if (selectedHistoryId === historyEntryPendingDeletion.id) {
            handleSelectHistory(null)
          }
          setComparisonTargetId(updatedHistory[0]?.id)
          setComparisonBaselineId(updatedHistory[1]?.id || updatedHistory[0]?.id)
          setHistoryEntryPendingDeletion(null)
          message.success(t('popup.messages.historyDeleted'))
        }}
        getContainer={false}
        centered
      >
        <p>{t('popup.history.deleteModalDescription')}</p>
        {historyEntryPendingDeletion && (
          <p className="history-delete-target">
            <strong>
              {historyEntryPendingDeletion.pageTitle || historyEntryPendingDeletion.url}
            </strong>
          </p>
        )}
      </Modal>

      <Modal
        open={Boolean(quotaIssue) && isQuotaModalOpen}
        title={t('popup.quota.modalTitle')}
        onCancel={() => setIsQuotaModalOpen(false)}
        footer={null}
        getContainer={false}
        centered
        width={480}
      >
        <Space direction="vertical" size={12} className="quota-modal-content">
          <Alert
            type="warning"
            showIcon
            message={t('popup.quota.modalAlertTitle')}
            description={t(getQuotaModalAlertDescriptionKey(quotaIssue?.scope ?? 'audit'))}
          />
          <p>{t('popup.quota.modalDescription')}</p>
          <ul className="quota-modal-options">
            <li>{t('popup.quota.options.currentUrl')}</li>
            <li>{t('popup.quota.options.deleteOldestAudit')}</li>
            <li>{t('popup.quota.options.globalCompact')}</li>
            <li>{t('popup.quota.options.dismiss')}</li>
          </ul>
          <div className="quota-modal-actions-grid">
            <Button
              type="primary"
              loading={quotaRecoveryLoading}
              onClick={() => {
                void handleResolveQuotaIssue('current-url')
              }}
            >
              {t('popup.quota.actions.clearCurrentUrl')}
            </Button>
            <Button
              loading={quotaRecoveryLoading}
              onClick={() => {
                void handleResolveQuotaIssue('oldest-audit')
              }}
            >
              {t('popup.quota.actions.deleteOldestAudit')}
            </Button>
            <Button
              loading={quotaRecoveryLoading}
              onClick={() => {
                void handleResolveQuotaIssue('global')
              }}
            >
              {t('popup.quota.actions.compactGlobal')}
            </Button>
            <Button onClick={() => setIsQuotaModalOpen(false)}>
              {t('popup.quota.actions.dismiss')}
            </Button>
          </div>
        </Space>
      </Modal>

      {!showAboutView && (
        <Footer className="popup-footer">
          {footerActions.length > 0 && (
            <div className="footer-actions-grid">
              {footerActions.map((action, index) => {
                const lastIndex = footerActions.length - 1
                const remainder = footerActions.length % 3
                const shouldSpanTwo = remainder === 2 && index === lastIndex
                const shouldSpanThree = remainder === 1 && index === lastIndex

                return (
                  <Button
                    key={action.key}
                    className={[
                      'footer-action',
                      shouldSpanTwo ? 'footer-action-span-2' : '',
                      shouldSpanThree ? 'footer-action-span-3' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    type={action.type}
                    icon={action.icon}
                    onClick={action.onClick}
                    loading={action.loading}
                    disabled={action.disabled}
                  >
                    {action.label}
                  </Button>
                )
              })}
            </div>
          )}
        </Footer>
      )}
    </Layout>
  )
}
