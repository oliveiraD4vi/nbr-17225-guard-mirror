import type { Violation } from '@/types'

function normalizeText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
}

function normalizeColor(value: string | undefined): string {
  return normalizeText(value)
}

export function getViolationSimilarityKey(violation: Violation): string {
  if (violation.contrastDetails) {
    return [
      'contrast',
      violation.ruleId,
      violation.contrastDetails.context,
      normalizeColor(violation.contrastDetails.foregroundHex),
      normalizeColor(violation.contrastDetails.backgroundHex),
      normalizeColor(violation.contrastDetails.comparisonHex),
    ].join('|')
  }

  return [
    'generic',
    violation.ruleId,
    normalizeText(violation.message),
    normalizeText(violation.suggestion),
    normalizeText(violation.remediationAdvice),
    normalizeText(violation.elementTagName),
  ].join('|')
}

export function areSimilarViolations(left: Violation, right: Violation): boolean {
  return getViolationSimilarityKey(left) === getViolationSimilarityKey(right)
}

export function countSimilarViolations(
  sourceViolation: Violation,
  violations: Violation[],
  predicate: (violation: Violation) => boolean = () => true,
): number {
  const sourceKey = getViolationSimilarityKey(sourceViolation)
  return violations.filter(
    (violation) => getViolationSimilarityKey(violation) === sourceKey && predicate(violation),
  ).length
}
