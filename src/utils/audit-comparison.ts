import type { AuditResult, Violation } from '@/types'
import { getViolationIdentityKey } from '@/utils/audit-history'
import {
  isConfirmedFinding,
  isIgnoredFinding,
  isPendingHumanReviewFinding,
  normalizeViolationFindingState,
} from '@/utils/audit-triage'

export type ComparisonTechnicalTrend = 'improvement' | 'regression' | 'mixed' | 'unchanged'
export type ComparisonScopeExclusion = 'recommendations' | 'contextual'
export type AuditTriageChangeKind = 'ignored' | 'reopened' | 'triage_updated' | 'status_updated'
export type AuditReviewChangeField =
  | 'user_note'
  | 'alternative_text'
  | 'contrast'
  | 'violation_content'

export interface AuditComparisonScope {
  mode: 'equivalent' | 'partial'
  includeRecommendations: boolean
  includeHumanReview: boolean
  excluded: ComparisonScopeExclusion[]
}

export interface AuditStateChange {
  baseline: Violation
  target: Violation
  kind: AuditTriageChangeKind
}

export interface AuditReviewChange {
  baseline: Violation
  target: Violation
  changedFields: AuditReviewChangeField[]
}

export interface AuditComparisonSummary {
  comparisonSchemaVersion: 2
  baselineId: string
  targetId: string
  baselineTimestamp: number
  targetTimestamp: number
  comparisonScope: AuditComparisonScope
  technicalTrend: ComparisonTechnicalTrend
  newViolations: Violation[]
  noLongerDetectedViolations: Violation[]
  resolvedViolations: Violation[]
  persistentViolations: Violation[]
  stateChangedViolations: AuditStateChange[]
  ignoredSinceBaseline: AuditStateChange[]
  reopenedSinceBaseline: AuditStateChange[]
  triageUpdatedViolations: AuditStateChange[]
  reviewChangedViolations: AuditReviewChange[]
  baselineOpenCount: number
  targetOpenCount: number
  baselineNoteCount: number
  targetNoteCount: number
  baselineAlternativeTextReviewCount: number
  targetAlternativeTextReviewCount: number
  baselineConfirmedReviews: number
  targetConfirmedReviews: number
  baselineDismissedReviews: number
  targetDismissedReviews: number
  baselinePendingReviews: number
  targetPendingReviews: number
  openIssuesDeltaPercentage: number
  notesDeltaPercentage: number
  alternativeTextReviewsDeltaPercentage: number
  confirmedReviewsDeltaPercentage: number
}

export function getPercentageDelta(baselineValue: number, targetValue: number): number {
  if (baselineValue === 0) {
    return targetValue === 0 ? 0 : 100
  }

  return Number((((targetValue - baselineValue) / baselineValue) * 100).toFixed(1))
}

function getViolationsByKey(violations: Violation[]): Map<string, Violation> {
  return new Map(violations.map((violation) => [getViolationIdentityKey(violation), violation]))
}

function getComparisonScope(baseline: AuditResult, target: AuditResult): AuditComparisonScope {
  const includeRecommendations = baseline.includeRecommendations && target.includeRecommendations
  const includeHumanReview = baseline.includeHumanReview && target.includeHumanReview
  const excluded: ComparisonScopeExclusion[] = []

  if (baseline.includeRecommendations !== target.includeRecommendations) {
    excluded.push('recommendations')
  }
  if (baseline.includeHumanReview !== target.includeHumanReview) {
    excluded.push('contextual')
  }

  return {
    mode: excluded.length > 0 ? 'partial' : 'equivalent',
    includeRecommendations,
    includeHumanReview,
    excluded,
  }
}

function isWithinComparisonScope(violation: Violation, scope: AuditComparisonScope): boolean {
  if (violation.normativeType === 'Recomendação' && !scope.includeRecommendations) return false
  if (violation.requiresHumanReview && !scope.includeHumanReview) return false
  return true
}

function getAuditNoteCountFromViolations(violations: Violation[]): number {
  return violations.filter((violation) => Boolean(violation.userNote?.trim())).length
}

function getAlternativeTextReviewCountFromViolations(violations: Violation[]): number {
  return violations.filter((violation) =>
    Boolean(violation.alternativeTextReview?.proposedText?.trim()),
  ).length
}

function getTechnicalTrend(
  newViolations: Violation[],
  noLongerDetectedViolations: Violation[],
): ComparisonTechnicalTrend {
  if (newViolations.length > 0 && noLongerDetectedViolations.length > 0) return 'mixed'
  if (newViolations.length > 0) return 'regression'
  if (noLongerDetectedViolations.length > 0) return 'improvement'
  return 'unchanged'
}

function getTriageChange(baseline: Violation, target: Violation): AuditStateChange | null {
  const statusChanged = baseline.findingStatus !== target.findingStatus
  const reasonChanged = baseline.ignoreReason !== target.ignoreReason
  const noteChanged = (baseline.ignoreNote || '') !== (target.ignoreNote || '')

  if (!statusChanged && !reasonChanged && !noteChanged) return null

  let kind: AuditTriageChangeKind = statusChanged ? 'status_updated' : 'triage_updated'
  if (!isIgnoredFinding(baseline) && isIgnoredFinding(target)) kind = 'ignored'
  if (isIgnoredFinding(baseline) && !isIgnoredFinding(target)) kind = 'reopened'

  return { baseline, target, kind }
}

function serializedValue(value: unknown): string {
  return JSON.stringify(value ?? null)
}

function getReviewChangedFields(baseline: Violation, target: Violation): AuditReviewChangeField[] {
  const changedFields: AuditReviewChangeField[] = []

  if ((baseline.userNote || '') !== (target.userNote || '')) changedFields.push('user_note')
  const baselineAlternativeText = baseline.alternativeTextReview
    ? {
        currentText: baseline.alternativeTextReview.currentText,
        currentSource: baseline.alternativeTextReview.currentSource,
        proposedText: baseline.alternativeTextReview.proposedText,
        targetAttribute: baseline.alternativeTextReview.targetAttribute,
      }
    : null
  const targetAlternativeText = target.alternativeTextReview
    ? {
        currentText: target.alternativeTextReview.currentText,
        currentSource: target.alternativeTextReview.currentSource,
        proposedText: target.alternativeTextReview.proposedText,
        targetAttribute: target.alternativeTextReview.targetAttribute,
      }
    : null
  if (serializedValue(baselineAlternativeText) !== serializedValue(targetAlternativeText)) {
    changedFields.push('alternative_text')
  }
  const baselineContrast = baseline.userContrastOverride
    ? {
        foregroundHex: baseline.userContrastOverride.foregroundHex,
        backgroundHex: baseline.userContrastOverride.backgroundHex,
      }
    : null
  const targetContrast = target.userContrastOverride
    ? {
        foregroundHex: target.userContrastOverride.foregroundHex,
        backgroundHex: target.userContrastOverride.backgroundHex,
      }
    : null
  if (serializedValue(baselineContrast) !== serializedValue(targetContrast)) {
    changedFields.push('contrast')
  }
  if (
    baseline.severity !== target.severity ||
    baseline.message !== target.message ||
    baseline.suggestion !== target.suggestion ||
    baseline.remediationAdvice !== target.remediationAdvice
  ) {
    changedFields.push('violation_content')
  }

  return changedFields
}

export function getAuditNoteCount(result: AuditResult): number {
  return getAuditNoteCountFromViolations(result.violations)
}

export function getAlternativeTextReviewCount(result: AuditResult): number {
  return getAlternativeTextReviewCountFromViolations(result.violations)
}

export function getConfirmedFindingCount(result: AuditResult): number {
  return result.violations.map(normalizeViolationFindingState).filter(isConfirmedFinding).length
}

export function getIgnoredFindingCount(result: AuditResult): number {
  return result.violations.map(normalizeViolationFindingState).filter(isIgnoredFinding).length
}

export function getPendingHumanReviewCount(result: AuditResult): number {
  return result.violations.map(normalizeViolationFindingState).filter(isPendingHumanReviewFinding)
    .length
}

export function getConfirmedHumanReviewCount(result: AuditResult): number {
  return getConfirmedFindingCount(result)
}

export function getDismissedHumanReviewCount(result: AuditResult): number {
  return getIgnoredFindingCount(result)
}

export function compareAuditResults(
  baseline: AuditResult,
  target: AuditResult,
): AuditComparisonSummary {
  const comparisonScope = getComparisonScope(baseline, target)
  const baselineViolations = baseline.violations
    .map(normalizeViolationFindingState)
    .filter((violation) => isWithinComparisonScope(violation, comparisonScope))
  const targetViolations = target.violations
    .map(normalizeViolationFindingState)
    .filter((violation) => isWithinComparisonScope(violation, comparisonScope))
  const baselineOpenViolations = baselineViolations.filter(
    (violation) => !isIgnoredFinding(violation),
  )
  const targetOpenViolations = targetViolations.filter((violation) => !isIgnoredFinding(violation))
  const baselineAllViolationsByKey = getViolationsByKey(baselineViolations)
  const targetAllViolationsByKey = getViolationsByKey(targetViolations)
  const baselineOpenKeys = new Set(baselineOpenViolations.map(getViolationIdentityKey))
  const baselineAllKeys = new Set(baselineViolations.map(getViolationIdentityKey))
  const targetAllKeys = new Set(targetViolations.map(getViolationIdentityKey))
  const stateChangedViolations: AuditStateChange[] = []
  const reviewChangedViolations: AuditReviewChange[] = []

  baselineAllViolationsByKey.forEach((baselineViolation, key) => {
    const targetViolation = targetAllViolationsByKey.get(key)
    if (!targetViolation) return

    const triageChange = getTriageChange(baselineViolation, targetViolation)
    if (triageChange) stateChangedViolations.push(triageChange)

    const changedFields = getReviewChangedFields(baselineViolation, targetViolation)
    if (changedFields.length > 0) {
      reviewChangedViolations.push({
        baseline: baselineViolation,
        target: targetViolation,
        changedFields,
      })
    }
  })

  const newViolations = targetOpenViolations.filter(
    (violation) => !baselineAllKeys.has(getViolationIdentityKey(violation)),
  )
  const noLongerDetectedViolations = baselineOpenViolations.filter(
    (violation) => !targetAllKeys.has(getViolationIdentityKey(violation)),
  )
  const persistentViolations = targetOpenViolations.filter((violation) =>
    baselineOpenKeys.has(getViolationIdentityKey(violation)),
  )
  const baselineNoteCount = getAuditNoteCountFromViolations(baselineViolations)
  const targetNoteCount = getAuditNoteCountFromViolations(targetViolations)
  const baselineAlternativeTextReviewCount =
    getAlternativeTextReviewCountFromViolations(baselineViolations)
  const targetAlternativeTextReviewCount =
    getAlternativeTextReviewCountFromViolations(targetViolations)
  const baselineConfirmedReviews = baselineViolations.filter(isConfirmedFinding).length
  const targetConfirmedReviews = targetViolations.filter(isConfirmedFinding).length
  const baselineDismissedReviews = baselineViolations.filter(isIgnoredFinding).length
  const targetDismissedReviews = targetViolations.filter(isIgnoredFinding).length
  const baselinePendingReviews = baselineViolations.filter(isPendingHumanReviewFinding).length
  const targetPendingReviews = targetViolations.filter(isPendingHumanReviewFinding).length

  return {
    comparisonSchemaVersion: 2,
    baselineId: baseline.id || '',
    targetId: target.id || '',
    baselineTimestamp: baseline.timestamp,
    targetTimestamp: target.timestamp,
    comparisonScope,
    technicalTrend: getTechnicalTrend(newViolations, noLongerDetectedViolations),
    newViolations,
    noLongerDetectedViolations,
    resolvedViolations: noLongerDetectedViolations,
    persistentViolations,
    stateChangedViolations,
    ignoredSinceBaseline: stateChangedViolations.filter((change) => change.kind === 'ignored'),
    reopenedSinceBaseline: stateChangedViolations.filter((change) => change.kind === 'reopened'),
    triageUpdatedViolations: stateChangedViolations.filter(
      (change) => change.kind === 'triage_updated' || change.kind === 'status_updated',
    ),
    reviewChangedViolations,
    baselineOpenCount: baselineOpenViolations.length,
    targetOpenCount: targetOpenViolations.length,
    baselineNoteCount,
    targetNoteCount,
    baselineAlternativeTextReviewCount,
    targetAlternativeTextReviewCount,
    baselineConfirmedReviews,
    targetConfirmedReviews,
    baselineDismissedReviews,
    targetDismissedReviews,
    baselinePendingReviews,
    targetPendingReviews,
    openIssuesDeltaPercentage: getPercentageDelta(
      baselineOpenViolations.length,
      targetOpenViolations.length,
    ),
    notesDeltaPercentage: getPercentageDelta(baselineNoteCount, targetNoteCount),
    alternativeTextReviewsDeltaPercentage: getPercentageDelta(
      baselineAlternativeTextReviewCount,
      targetAlternativeTextReviewCount,
    ),
    confirmedReviewsDeltaPercentage: getPercentageDelta(
      baselineConfirmedReviews,
      targetConfirmedReviews,
    ),
  }
}
