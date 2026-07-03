/**
 * Tipos e interfaces para a extensão Guardião NBR 17225
 */

import type { NormativeRuleType } from '@/normative'

export type SeverityLevel = 'error' | 'warning'
export type WCAGLevel = 'A' | 'AA' | 'AAA'
export type RuleReadiness = 'ready' | 'not_ready'
export const AUTOMATION_CATEGORIES = {
  fully: 'Totalmente Automatizável',
  semi: 'Semi-Automatizável',
  none: 'Não Automatizável',
} as const

export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[keyof typeof AUTOMATION_CATEGORIES]
export type HumanReviewStatus = 'not_applicable' | 'pending' | 'confirmed' | 'dismissed'
export type FindingOrigin = 'automatic' | 'manual'
export type FindingStatus = 'open' | 'confirmed' | 'ignored'
export type IgnoreReason =
  | 'false_positive'
  | 'out_of_scope'
  | 'accepted_risk'
  | 'duplicate'
  | 'other'
export type ContrastContext = 'text' | 'component' | 'graphic' | 'focus'

export function isFullyAutomatedCategory(category: AutomationCategory): boolean {
  return category === AUTOMATION_CATEGORIES.fully
}

export interface Rule {
  id: string
  nbrReference: string
  name: string
  description: string
  severity: SeverityLevel
  wcagLevel: WCAGLevel
  category: AutomationCategory
  readiness?: RuleReadiness
  readinessReason?: string
  check: () => Promise<Violation[]>
}

export interface Violation {
  id: string
  ruleId: string
  ruleName: string
  nbrReference: string
  description: string
  severity: SeverityLevel
  wcagLevel: WCAGLevel
  automationCategory: AutomationCategory
  normativeType: NormativeRuleType
  requiresHumanReview: boolean
  humanReviewStatus: HumanReviewStatus
  findingOrigin: FindingOrigin
  findingStatus: FindingStatus
  ignoreReason?: IgnoreReason
  ignoreNote?: string
  findingStatusUpdatedAt?: number
  message: string
  snippet: string
  suggestion: string
  remediationAdvice: string
  element?: HTMLElement
  elementSelector?: string
  elementTagName?: string
  elementAccessibleName?: string
  elementVisibleText?: string
  contrastDetails?: {
    context: ContrastContext
    foregroundHex: string
    backgroundHex: string
    measuredRatio: number
    minimumRatio: number
    comparisonHex?: string
    comparisonLabel?: string
    foregroundLabel?: string
    backgroundLabel?: string
  }
  userContrastOverride?: {
    foregroundHex: string
    backgroundHex: string
    updatedAt: number
  }
  userNote?: string
  noteUpdatedAt?: number
  inheritedFromHistory?: boolean
  customId: string
}

export interface ManualFindingElementDraft {
  selector: string
  tagName?: string
  snippet: string
  accessibleName?: string
  visibleText?: string
  url: string
  pageTitle?: string
  selectedAt: number
}

export interface ManualFindingDraft extends ManualFindingElementDraft {
  tabId: number
}

export interface AuditResult {
  id?: string
  timestamp: number
  url: string
  pageTitle?: string
  includeRecommendations?: boolean
  includeHumanReview?: boolean
  totalViolations: number
  errors: number
  warnings: number
  humanReviewItems: number
  automatedFindings: number
  violations: Violation[]
  violationsByRule: Record<string, Violation[]>
  violationsBySeverity: Record<SeverityLevel, Violation[]>
}

export interface AuditHistoryEntry extends AuditResult {
  id: string
  importedAt?: number
}

export interface HighlightState {
  isActive: boolean
  violationId?: string
}

export interface VisionSimulationFilter {
  type: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'blur'
  intensity: number
}

export interface ExtensionMessage {
  action: string
  payload?: unknown
}

export interface StorageData {
  auditResultsByTab?: Record<string, AuditResult>
  auditHistoryByUrl?: Record<string, AuditHistoryEntry[]>
  manualFindingDraftsByTab?: Record<string, ManualFindingDraft>
  highlightState?: HighlightState
  visionFilter?: VisionSimulationFilter
  includeRecommendationsPreference?: boolean
  includeHumanReviewPreference?: boolean
}
