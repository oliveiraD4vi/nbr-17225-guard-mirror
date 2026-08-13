import type { FindingStatus, HumanReviewStatus, IgnoreReason, Violation } from '@/types'

function inferVerificationMode(violation: Violation) {
  if (violation.verificationMode) return violation.verificationMode
  if (violation.automationCategory === 'Totalmente Automatizável') return 'automatic' as const
  if (violation.automationCategory === 'Semi-Automatizável') return 'assisted' as const
  return 'manual' as const
}

function inferAuditScope(reference: string) {
  if (['5.7.13', '5.7.15', '5.7.16', '5.8.5'].includes(reference)) return 'site' as const
  if (['5.9.12', '5.9.15'].includes(reference)) return 'journey' as const
  return 'page' as const
}

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
  const verificationMode = inferVerificationMode(violation)
  const requiresHumanReview = violation.requiresHumanReview ?? verificationMode !== 'automatic'
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
    verificationMode,
    auditScope: violation.auditScope ?? inferAuditScope(violation.nbrReference),
    confidence:
      violation.confidence ??
      (verificationMode === 'automatic'
        ? 'high'
        : verificationMode === 'assisted'
          ? 'medium'
          : 'contextual'),
    evidence:
      violation.evidence?.length > 0
        ? violation.evidence
        : [
            {
              kind: verificationMode === 'automatic' ? 'dom' : 'author_review',
              summary: violation.message,
              selector: violation.elementSelector,
            },
          ],
    reviewQuestion:
      violation.reviewQuestion ??
      (verificationMode === 'assisted'
        ? 'A evidência observada confirma o problema neste contexto?'
        : verificationMode === 'manual'
          ? 'A verificação manual confirma que o requisito não foi atendido?'
          : undefined),
    requiresHumanReview,
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

export function shouldCountFindingAsConfirmedFailure(violation: Violation): boolean {
  if (isIgnoredFinding(violation)) return false
  if (!violation.requiresHumanReview) {
    return isOpenFinding(violation) || isConfirmedFinding(violation)
  }
  return isConfirmedFinding(violation)
}
