import type { FindingStatus, HumanReviewStatus, IgnoreReason, Violation } from '@/types'

export interface FindingStatusUpdate {
  status: FindingStatus
  ignoreReason?: IgnoreReason
  ignoreNote?: string
}

function getFindingStatusFromHumanReview(status: HumanReviewStatus | undefined): FindingStatus {
  if (status === 'confirmed') return 'confirmed'
  if (status === 'dismissed') return 'ignored'
  return 'open'
}

export function getCompatibleHumanReviewStatus(violation: Violation): HumanReviewStatus {
  if (violation.findingStatus === 'confirmed') return 'confirmed'
  if (violation.findingStatus === 'ignored') return 'dismissed'
  return violation.requiresHumanReview ? 'pending' : 'not_applicable'
}

export function normalizeViolationFindingState<T extends Violation>(violation: T): T {
  const findingStatus =
    violation.findingStatus ?? getFindingStatusFromHumanReview(violation.humanReviewStatus)
  const migratedIgnoreReason =
    findingStatus === 'ignored' ? (violation.ignoreReason ?? 'false_positive') : undefined
  const ignoreNote =
    findingStatus === 'ignored' && violation.ignoreNote?.trim()
      ? violation.ignoreNote.trim()
      : undefined
  const normalizedViolation = {
    ...violation,
    findingOrigin: violation.findingOrigin ?? 'automatic',
    findingStatus,
    ignoreReason: migratedIgnoreReason,
    ignoreNote,
  }

  return {
    ...normalizedViolation,
    humanReviewStatus: getCompatibleHumanReviewStatus(normalizedViolation),
  }
}

export function applyFindingStatusUpdate<T extends Violation>(
  violation: T,
  update: FindingStatusUpdate,
  updatedAt = Date.now(),
): T {
  const normalizedUpdate = {
    ...violation,
    findingStatus: update.status,
    ignoreReason: update.status === 'ignored' ? update.ignoreReason : undefined,
    ignoreNote:
      update.status === 'ignored' && update.ignoreNote?.trim()
        ? update.ignoreNote.trim()
        : undefined,
    findingStatusUpdatedAt: updatedAt,
  }

  return normalizeViolationFindingState(normalizedUpdate)
}

export function isIgnoredFinding(violation: Violation): boolean {
  return violation.findingStatus === 'ignored'
}

export function isConfirmedFinding(violation: Violation): boolean {
  return violation.findingStatus === 'confirmed'
}

export function isOpenFinding(violation: Violation): boolean {
  return violation.findingStatus === 'open'
}

export function isPendingHumanReviewFinding(violation: Violation): boolean {
  return violation.requiresHumanReview && isOpenFinding(violation)
}

export function shouldCountFindingAsFailure(violation: Violation): boolean {
  if (isIgnoredFinding(violation)) return false
  return isOpenFinding(violation) || isConfirmedFinding(violation)
}
