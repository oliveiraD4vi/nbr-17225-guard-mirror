import type { AuditHistoryEntry, AuditResult, Violation } from '@/types'
import { isNormativeRequirement } from '@/normative'
import {
  isIgnoredFinding,
  isPendingHumanReviewFinding,
  normalizeViolationFindingState,
} from '@/utils/audit-triage'

function getAuditCollections(violations: Violation[]) {
  const violationsByRule = violations.reduce<Record<string, Violation[]>>((acc, violation) => {
    acc[violation.ruleId] ??= []
    acc[violation.ruleId].push(violation)
    return acc
  }, {})

  const violationsBySeverity = violations.reduce<Record<'error' | 'warning', Violation[]>>(
    (acc, violation) => {
      acc[violation.severity].push(violation)
      return acc
    },
    { error: [], warning: [] },
  )

  return { violationsByRule, violationsBySeverity }
}

export function hydrateAuditResult<T extends AuditResult>(result: T): T {
  const violations = (result.violations ?? []).map(normalizeViolationFindingState)
  const requirementViolations = violations.filter((violation) =>
    isNormativeRequirement(violation.nbrReference),
  )
  const recommendationViolations = violations.filter(
    (violation) => !isNormativeRequirement(violation.nbrReference),
  )
  const humanReviewItems = violations.filter((violation) => violation.requiresHumanReview).length
  const automatedFindings = violations.length - humanReviewItems
  const collections = getAuditCollections(violations)

  return {
    ...result,
    totalViolations: violations.length,
    errors: requirementViolations.length,
    warnings: recommendationViolations.length,
    humanReviewItems,
    automatedFindings,
    violations,
    ...collections,
  }
}

export function compactAuditResultForStorage<T extends AuditResult>(result: T): T {
  const compactResult = {
    ...(result as T & {
      summary?: unknown
      violationsByRule?: unknown
      violationsBySeverity?: unknown
    }),
  }
  Reflect.deleteProperty(compactResult, 'violationsByRule')
  Reflect.deleteProperty(compactResult, 'violationsBySeverity')
  Reflect.deleteProperty(compactResult, 'summary')

  const violations = result.violations.map((violation) => {
    const persistableViolation: Partial<Violation> = normalizeViolationFindingState(violation)
    Reflect.deleteProperty(persistableViolation, 'element')
    Reflect.deleteProperty(persistableViolation, 'inheritedFromHistory')
    return persistableViolation as Violation
  })

  return {
    ...compactResult,
    violations,
  } as T
}

export function getAuditUrlStorageKey(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ''
    parsed.hash = ''
    if (parsed.pathname !== '/') {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/'
    }
    return parsed.toString()
  } catch {
    return url
  }
}

export function getAuditSiteStorageKey(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.origin && parsed.origin !== 'null' ? parsed.origin : getAuditUrlStorageKey(url)
  } catch {
    return url
  }
}

export function getViolationIdentityKey(violation: Violation): string {
  return (
    violation.id ||
    [
      violation.ruleId,
      violation.elementSelector || '',
      violation.message,
      violation.suggestion,
    ].join('|')
  )
}

export function dedupeAndSortAuditHistory(
  entries: AuditHistoryEntry[],
  maxEntries = 10,
): AuditHistoryEntry[] {
  return [...entries]
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter(
      (entry, index, currentEntries) =>
        currentEntries.findIndex((candidate) => candidate.id === entry.id) === index,
    )
    .slice(0, maxEntries)
}

export function getVisibleAuditViolations(result: AuditResult): Violation[] {
  return result.violations.map(normalizeViolationFindingState).filter((violation) => {
    return !isIgnoredFinding(violation)
  })
}

export function getDisplayAuditResult(
  result: AuditResult,
  includeRecommendations: boolean,
  includeHumanReview = true,
): AuditResult {
  const visibleViolations = getVisibleAuditViolations(result).filter(
    (violation) =>
      (includeRecommendations || isNormativeRequirement(violation.nbrReference)) &&
      (includeHumanReview ||
        !violation.requiresHumanReview ||
        violation.findingOrigin === 'manual'),
  )
  const pendingHumanReviewItems = visibleViolations.filter(isPendingHumanReviewFinding).length

  const hydratedResult = hydrateAuditResult({
    ...result,
    includeHumanReview,
    violations: visibleViolations,
  })

  return {
    ...hydratedResult,
    humanReviewItems: pendingHumanReviewItems,
    automatedFindings: visibleViolations.length - pendingHumanReviewItems,
  }
}

export function inheritViolationStateFromHistory(
  result: AuditResult,
  historyEntries: AuditHistoryEntry[],
): AuditResult {
  const persistedViolations = new Map<string, Violation>()

  historyEntries.forEach((entry) => {
    entry.violations.map(normalizeViolationFindingState).forEach((violation) => {
      const hasPersistedState =
        violation.findingStatus !== 'open' ||
        Boolean(violation.findingStatusUpdatedAt) ||
        Boolean(violation.userNote?.trim()) ||
        Boolean(violation.userContrastOverride) ||
        Boolean(violation.alternativeTextReview?.proposedText?.trim())

      if (!hasPersistedState) return

      const key = getViolationIdentityKey(violation)
      if (!persistedViolations.has(key)) {
        persistedViolations.set(key, violation)
      }
    })
  })

  return {
    ...result,
    violations: result.violations.map((violation) => {
      const persistedViolation = persistedViolations.get(getViolationIdentityKey(violation))
      if (!persistedViolation) return violation
      const inheritedAlternativeTextReview = persistedViolation.alternativeTextReview
      const currentAlternativeTextReview = violation.alternativeTextReview

      return normalizeViolationFindingState({
        ...violation,
        findingOrigin: persistedViolation.findingOrigin ?? violation.findingOrigin,
        findingStatus: persistedViolation.findingStatus ?? violation.findingStatus,
        ignoreReason: persistedViolation.ignoreReason,
        ignoreNote: persistedViolation.ignoreNote,
        findingStatusUpdatedAt:
          persistedViolation.findingStatusUpdatedAt ?? violation.findingStatusUpdatedAt,
        userContrastOverride:
          persistedViolation.userContrastOverride ?? violation.userContrastOverride,
        alternativeTextReview: inheritedAlternativeTextReview
          ? {
              currentSource:
                currentAlternativeTextReview?.currentSource ??
                inheritedAlternativeTextReview.currentSource,
              currentText:
                currentAlternativeTextReview?.currentText ?? inheritedAlternativeTextReview.currentText,
              targetAttribute:
                inheritedAlternativeTextReview.targetAttribute ??
                currentAlternativeTextReview?.targetAttribute,
              proposedText: inheritedAlternativeTextReview.proposedText,
              updatedAt: inheritedAlternativeTextReview.updatedAt,
            }
          : currentAlternativeTextReview,
        userNote: persistedViolation.userNote ?? violation.userNote,
        noteUpdatedAt: persistedViolation.noteUpdatedAt ?? violation.noteUpdatedAt,
        inheritedFromHistory: true,
      })
    }),
  }
}
