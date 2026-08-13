/**
 * Tipos e interfaces para a extensão Guardião NBR 17225
 */

import type { NormativeRuleType } from '@/normative'

export type SeverityLevel = 'error' | 'warning'
export type WCAGLevel = 'A' | 'AA' | 'AAA'
export type RuleReadiness = 'ready' | 'not_ready'
export type VerificationMode = 'automatic' | 'assisted' | 'manual'
export type AuditScope = 'page' | 'site' | 'journey'
export type FindingConfidence = 'high' | 'medium' | 'contextual'
export type FindingEvidenceKind =
  | 'dom'
  | 'computed_style'
  | 'interaction'
  | 'author_review'
  | 'session'
export const CURRENT_AUDIT_SCHEMA_VERSION = 4
export const AUTOMATION_CATEGORIES = {
  fully: 'Totalmente Automatizável',
  semi: 'Semi-Automatizável',
  none: 'Não Automatizável',
} as const

export type AutomationCategory = (typeof AUTOMATION_CATEGORIES)[keyof typeof AUTOMATION_CATEGORIES]
export type HumanReviewStatus = 'not_applicable' | 'pending' | 'confirmed' | 'dismissed'
export type FindingOrigin = 'automatic' | 'manual'
export type FindingStatus = 'open' | 'confirmed' | 'ignored'
export type AlternativeTextSource =
  | 'alt'
  | 'aria-label'
  | 'aria-labelledby'
  | 'title'
  | 'accessible_name'
  | 'missing'
export type AlternativeTextTargetAttribute = 'alt' | 'aria-label' | 'aria-labelledby' | 'title'
export type IgnoreReason =
  | 'false_positive'
  | 'out_of_scope'
  | 'accepted_risk'
  | 'duplicate'
  | 'other'
export type ContrastContext = 'text' | 'component' | 'graphic' | 'focus'

export interface ContrastPreviewItem {
  id: string
  selector: string
  context: ContrastContext
  foregroundHex: string
  backgroundHex: string
}

export interface ContrastPreviewResult {
  applied: number
  missing: number
  unsupported: number
}

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
  verificationMode?: VerificationMode
  auditScope?: AuditScope
  readiness?: RuleReadiness
  readinessReason?: string
  check: () => Promise<Violation[]>
}

export interface FindingEvidence {
  kind: FindingEvidenceKind
  summary: string
  selector?: string
  observedValue?: string
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
  verificationMode: VerificationMode
  auditScope: AuditScope
  confidence: FindingConfidence
  evidence: FindingEvidence[]
  reviewQuestion?: string
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
  alternativeTextReview?: {
    currentText?: string
    currentSource: AlternativeTextSource
    proposedText?: string
    targetAttribute: AlternativeTextTargetAttribute
    updatedAt?: number
  }
  userNote?: string
  noteUpdatedAt?: number
  inheritedFromHistory?: boolean
  customId: string
}

export interface SiteAuditPage {
  url: string
  pageTitle?: string
  auditedAt: number
  context: PageAuditContext
}

export interface PageAuditControlAction {
  action: string
  name: string
}

export interface PageAuditContext {
  navigationSignatures: string[]
  helpSignatures: string[]
  locationMechanisms: string[]
  controlActions: PageAuditControlAction[]
  criticalActions: string[]
  formFieldKeys: string[]
  hasReviewCue: boolean
}

export interface SessionReviewCandidate {
  ruleId: string
  nbrReference: string
  summary: string
  reviewQuestion: string
}

export interface SiteAuditSession {
  id: string
  origin: string
  startedAt: number
  updatedAt: number
  pages: SiteAuditPage[]
  reviewCandidates: SessionReviewCandidate[]
}

export interface JourneyAuditStep {
  id: string
  url: string
  pageTitle?: string
  label: string
  recordedAt: number
  evidenceSelectors: string[]
  context: PageAuditContext
}

export interface JourneyAuditSession {
  id: string
  name: string
  startedAt: number
  updatedAt: number
  steps: JourneyAuditStep[]
  reviewCandidates: SessionReviewCandidate[]
}

export interface AuditScoreRange {
  /** Limite se todos os candidatos pendentes forem confirmados. */
  conservative: number
  /** Limite sustentado apenas por falhas automáticas ou já confirmadas. */
  confirmed: number
}

export interface RuleExecutionSummary {
  executed: number
  withCandidates: number
  awaitingManualReview: number
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
  schemaVersion: number
  id?: string
  timestamp: number
  url: string
  pageTitle?: string
  includeRecommendations?: boolean
  includeHumanReview?: boolean
  auditScope: AuditScope
  siteSession?: SiteAuditSession
  journeySession?: JourneyAuditSession
  scoreRange: AuditScoreRange
  ruleExecution: RuleExecutionSummary
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

export interface AuditReportSnapshot {
  id: string
  createdAt: number
  auditResult: AuditResult
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
  reportSnapshotsById?: Record<string, AuditReportSnapshot>
  manualFindingDraftsByTab?: Record<string, ManualFindingDraft>
  highlightState?: HighlightState
  visionFilter?: VisionSimulationFilter
  includeRecommendationsPreference?: boolean
  includeHumanReviewPreference?: boolean
  auditScopePreference?: AuditScope
  siteAuditSessionsByOrigin?: Record<string, SiteAuditSession>
  journeyAuditSession?: JourneyAuditSession
}
