import type { AuditResult, Violation } from '@/types'
import { getViolationIdentityKey, getVisibleAuditViolations } from '@/utils/audit-history'
import {
  isConfirmedFinding,
  isIgnoredFinding,
  isPendingHumanReviewFinding,
  normalizeViolationFindingState,
} from '@/utils/audit-triage'

export interface AuditStateChange {
  baseline: Violation
  target: Violation
}

export interface AuditComparisonSummary {
  baselineId: string
  targetId: string
  baselineTimestamp: number
  targetTimestamp: number
  newViolations: Violation[]
  resolvedViolations: Violation[]
  persistentViolations: Violation[]
  stateChangedViolations: AuditStateChange[]
  baselineOpenCount: number
  targetOpenCount: number
  baselineNoteCount: number
  targetNoteCount: number
  baselineConfirmedReviews: number
  targetConfirmedReviews: number
  baselineDismissedReviews: number
  targetDismissedReviews: number
  baselinePendingReviews: number
  targetPendingReviews: number
  openIssuesDeltaPercentage: number
  notesDeltaPercentage: number
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

export function getAuditNoteCount(result: AuditResult): number {
  return result.violations.filter((violation) => Boolean(violation.userNote?.trim())).length
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
  const baselineViolations = baseline.violations.map(normalizeViolationFindingState)
  const targetViolations = target.violations.map(normalizeViolationFindingState)
  const baselineOpenViolations = getVisibleAuditViolations({
    ...baseline,
    violations: baselineViolations,
  })
  const targetOpenViolations = getVisibleAuditViolations({
    ...target,
    violations: targetViolations,
  })

  const baselineAllViolationsByKey = getViolationsByKey(baselineViolations)
  const targetAllViolationsByKey = getViolationsByKey(targetViolations)
  const baselineOpenKeys = new Set(baselineOpenViolations.map(getViolationIdentityKey))
  const baselineAllKeys = new Set(baselineViolations.map(getViolationIdentityKey))
  const targetAllKeys = new Set(targetViolations.map(getViolationIdentityKey))
  const stateChangedViolations: AuditStateChange[] = []

  baselineAllViolationsByKey.forEach((baselineViolation, key) => {
    const targetViolation = targetAllViolationsByKey.get(key)
    if (!targetViolation) return

    const statusChanged = baselineViolation.findingStatus !== targetViolation.findingStatus
    const reasonChanged = baselineViolation.ignoreReason !== targetViolation.ignoreReason
    const noteChanged = (baselineViolation.ignoreNote || '') !== (targetViolation.ignoreNote || '')

    if (statusChanged || reasonChanged || noteChanged) {
      stateChangedViolations.push({ baseline: baselineViolation, target: targetViolation })
    }
  })

  return {
    baselineId: baseline.id || '',
    targetId: target.id || '',
    baselineTimestamp: baseline.timestamp,
    targetTimestamp: target.timestamp,
    newViolations: targetOpenViolations.filter(
      (violation) => !baselineAllKeys.has(getViolationIdentityKey(violation)),
    ),
    resolvedViolations: baselineOpenViolations.filter(
      (violation) => !targetAllKeys.has(getViolationIdentityKey(violation)),
    ),
    persistentViolations: targetOpenViolations.filter((violation) =>
      baselineOpenKeys.has(getViolationIdentityKey(violation)),
    ),
    stateChangedViolations,
    baselineOpenCount: baselineOpenViolations.length,
    targetOpenCount: targetOpenViolations.length,
    baselineNoteCount: getAuditNoteCount(baseline),
    targetNoteCount: getAuditNoteCount(target),
    baselineConfirmedReviews: getConfirmedFindingCount(baseline),
    targetConfirmedReviews: getConfirmedFindingCount(target),
    baselineDismissedReviews: getIgnoredFindingCount(baseline),
    targetDismissedReviews: getIgnoredFindingCount(target),
    baselinePendingReviews: getPendingHumanReviewCount(baseline),
    targetPendingReviews: getPendingHumanReviewCount(target),
    openIssuesDeltaPercentage: getPercentageDelta(
      baselineOpenViolations.length,
      targetOpenViolations.length,
    ),
    notesDeltaPercentage: getPercentageDelta(
      getAuditNoteCount(baseline),
      getAuditNoteCount(target),
    ),
    confirmedReviewsDeltaPercentage: getPercentageDelta(
      getConfirmedFindingCount(baseline),
      getConfirmedFindingCount(target),
    ),
  }
}
