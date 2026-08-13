import { isNormativeRecommendation, isNormativeRequirement } from '@/normative'
import { getRunnableRules } from '@/rules'
import type { AuditResult, AuditScope, Rule, SeverityLevel, Violation } from '@/types'
import { getRuleVerificationMode } from '@/utils/audit-contract'
import {
  isConfirmedFinding,
  isIgnoredFinding,
  isPendingHumanReviewFinding,
  normalizeViolationFindingState,
  shouldCountFindingAsConfirmedFailure,
  shouldCountFindingAsFailure,
} from '@/utils/audit-triage'

function getRequirementRules(includeHumanReview: boolean, auditScope: AuditScope): Rule[] {
  return getRunnableRules(false, includeHumanReview, auditScope).filter(
    (rule) => getRuleVerificationMode(rule) !== 'manual',
  )
}

function getRecommendationRules(includeHumanReview: boolean, auditScope: AuditScope): Rule[] {
  return getRunnableRules(true, includeHumanReview, auditScope).filter(
    (rule) =>
      isNormativeRecommendation(rule.nbrReference) && getRuleVerificationMode(rule) !== 'manual',
  )
}

function getRuleWeight(severity: SeverityLevel): number {
  return severity === 'error' ? 2 : 1
}

function shouldCountViolation(violation: Violation): boolean {
  return shouldCountFindingAsFailure(violation)
}

function shouldCountAsActiveOccurrence(violation: Violation): boolean {
  return !isIgnoredFinding(violation)
}

function getRuleMap(rules: Rule[]): Map<string, Rule> {
  return new Map(rules.map((rule) => [rule.id, rule]))
}

function getRuleFromViolation(violation: Violation): Rule {
  return {
    id: violation.ruleId,
    nbrReference: violation.nbrReference,
    name: violation.ruleName,
    description: violation.description,
    severity: violation.severity,
    wcagLevel: violation.wcagLevel,
    category: violation.automationCategory,
    verificationMode: violation.verificationMode,
    auditScope: violation.auditScope,
    check: async () => [],
  }
}

function includeManualFindingRules(
  rules: Rule[],
  violations: Violation[],
  predicate: (reference: string) => boolean,
): Rule[] {
  const ruleMap = getRuleMap(rules)

  violations.forEach((violation) => {
    if (violation.findingOrigin !== 'manual') return
    if (!predicate(violation.nbrReference)) return
    if (ruleMap.has(violation.ruleId)) return

    ruleMap.set(violation.ruleId, getRuleFromViolation(violation))
  })

  return Array.from(ruleMap.values())
}

function getTotalWeight(rules: Rule[]): number {
  return rules.reduce((total, rule) => total + getRuleWeight(rule.severity), 0)
}

function getFailedRuleIds(
  result: AuditResult,
  ruleIds: Set<string>,
  predicate: (reference: string) => boolean,
  failurePredicate: (violation: Violation) => boolean = shouldCountViolation,
): Set<string> {
  return new Set(
    result.violations
      .filter((violation) => predicate(violation.nbrReference) && failurePredicate(violation))
      .map((violation) => violation.ruleId)
      .filter((ruleId) => ruleIds.has(ruleId)),
  )
}

function getPendingHumanRuleCount(
  result: AuditResult,
  ruleIds: Set<string>,
  predicate: (reference: string) => boolean,
): number {
  return new Set(
    result.violations
      .filter(
        (violation) =>
          predicate(violation.nbrReference) &&
          violation.requiresHumanReview &&
          isPendingHumanReviewFinding(violation),
      )
      .map((violation) => violation.ruleId)
      .filter((ruleId) => ruleIds.has(ruleId)),
  ).size
}

function getFailedWeight(failedRuleIds: Set<string>, ruleMap: Map<string, Rule>): number {
  return [...failedRuleIds].reduce((total, ruleId) => {
    const rule = ruleMap.get(ruleId)
    return total + (rule ? getRuleWeight(rule.severity) : 0)
  }, 0)
}

function getWeightedRuleScore(totalWeight: number, failedWeight: number): number {
  if (totalWeight === 0) return 100
  return Math.max(0, Math.round(((totalWeight - failedWeight) / totalWeight) * 100))
}

export interface AuditScoreWeights {
  requirements: number
  recommendations: number
  humanReview: number
}

export interface AuditScoreData {
  score: number
  conservativeScore: number
  confirmedScore: number
  baseScore: number
  volumeScoreCap: number
  scoredViolationCount: number
  requirementScore: number
  confirmedRequirementScore: number
  recommendationScore: number
  confirmedRecommendationScore: number
  humanReviewScore: number
  totalRequirementRules: number
  totalRecommendationRules: number
  violatedRequirementRules: number
  confirmedViolatedRequirementRules: number
  violatedRecommendationRules: number
  confirmedViolatedRecommendationRules: number
  pendingHumanRequirementRules: number
  pendingHumanRecommendationRules: number
  pendingHumanReviewItems: number
  completedHumanReviewItems: number
  totalHumanReviewItems: number
  includesRecommendations: boolean
  includesHumanReview: boolean
  weights: AuditScoreWeights
  isProvisional: boolean
  totalRequirementWeight: number
  failedRequirementWeight: number
  confirmedFailedRequirementWeight: number
  totalRecommendationWeight: number
  failedRecommendationWeight: number
  confirmedFailedRecommendationWeight: number
  activeOccurrenceCount: number
  totalOccurrenceCount: number
  problemTypeCount: number
  automaticFindingCount: number
  confirmedFindingCount: number
  ignoredFindingCount: number
  manualFindingCount: number
}

export type RequirementScoreData = Pick<
  AuditScoreData,
  'score' | 'totalRequirementRules' | 'violatedRequirementRules' | 'pendingHumanRequirementRules'
>

export function getAuditScoreData(result: AuditResult): AuditScoreData {
  const violations = result.violations.map(normalizeViolationFindingState)
  const normalizedResult = {
    ...result,
    violations,
  }
  const includesRecommendations =
    result.includeRecommendations ??
    violations.some((violation) => isNormativeRecommendation(violation.nbrReference))
  const includesHumanReview = result.includeHumanReview ?? true
  const auditScope = result.auditScope ?? 'page'
  const requirementRules = includeManualFindingRules(
    getRequirementRules(includesHumanReview, auditScope),
    violations,
    isNormativeRequirement,
  )
  const recommendationRules = includesRecommendations
    ? includeManualFindingRules(
        getRecommendationRules(includesHumanReview, auditScope),
        violations,
        isNormativeRecommendation,
      )
    : []
  const requirementRuleMap = getRuleMap(requirementRules)
  const recommendationRuleMap = getRuleMap(recommendationRules)
  const requirementRuleIds = new Set(requirementRuleMap.keys())
  const recommendationRuleIds = new Set(recommendationRuleMap.keys())
  const totalRequirementRules = requirementRules.length
  const totalRecommendationRules = recommendationRules.length
  const failedRequirementRuleIds = getFailedRuleIds(
    normalizedResult,
    requirementRuleIds,
    isNormativeRequirement,
  )
  const failedRecommendationRuleIds = includesRecommendations
    ? getFailedRuleIds(normalizedResult, recommendationRuleIds, isNormativeRecommendation)
    : new Set<string>()
  const confirmedFailedRequirementRuleIds = getFailedRuleIds(
    normalizedResult,
    requirementRuleIds,
    isNormativeRequirement,
    shouldCountFindingAsConfirmedFailure,
  )
  const confirmedFailedRecommendationRuleIds = includesRecommendations
    ? getFailedRuleIds(
        normalizedResult,
        recommendationRuleIds,
        isNormativeRecommendation,
        shouldCountFindingAsConfirmedFailure,
      )
    : new Set<string>()
  const violatedRequirementRules = failedRequirementRuleIds.size
  const violatedRecommendationRules = failedRecommendationRuleIds.size
  const confirmedViolatedRequirementRules = confirmedFailedRequirementRuleIds.size
  const confirmedViolatedRecommendationRules = confirmedFailedRecommendationRuleIds.size
  const pendingHumanRequirementRules = getPendingHumanRuleCount(
    normalizedResult,
    requirementRuleIds,
    isNormativeRequirement,
  )
  const pendingHumanRecommendationRules = includesRecommendations
    ? getPendingHumanRuleCount(normalizedResult, recommendationRuleIds, isNormativeRecommendation)
    : 0
  const humanReviewViolations = violations.filter((violation) => violation.requiresHumanReview)
  const pendingHumanReviewItems = humanReviewViolations.filter(isPendingHumanReviewFinding).length
  const completedHumanReviewItems = humanReviewViolations.filter(
    (violation) => isConfirmedFinding(violation) || isIgnoredFinding(violation),
  ).length
  const totalHumanReviewItems = humanReviewViolations.length
  const totalRequirementWeight = getTotalWeight(requirementRules)
  const totalRecommendationWeight = getTotalWeight(recommendationRules)
  const failedRequirementWeight = getFailedWeight(failedRequirementRuleIds, requirementRuleMap)
  const failedRecommendationWeight = getFailedWeight(
    failedRecommendationRuleIds,
    recommendationRuleMap,
  )
  const confirmedFailedRequirementWeight = getFailedWeight(
    confirmedFailedRequirementRuleIds,
    requirementRuleMap,
  )
  const confirmedFailedRecommendationWeight = getFailedWeight(
    confirmedFailedRecommendationRuleIds,
    recommendationRuleMap,
  )
  const requirementScore = getWeightedRuleScore(totalRequirementWeight, failedRequirementWeight)
  const confirmedRequirementScore = getWeightedRuleScore(
    totalRequirementWeight,
    confirmedFailedRequirementWeight,
  )
  const recommendationScore = includesRecommendations
    ? getWeightedRuleScore(totalRecommendationWeight, failedRecommendationWeight)
    : 100
  const confirmedRecommendationScore = includesRecommendations
    ? getWeightedRuleScore(totalRecommendationWeight, confirmedFailedRecommendationWeight)
    : 100
  const humanReviewScore =
    totalHumanReviewItems === 0
      ? 100
      : Math.round((completedHumanReviewItems / totalHumanReviewItems) * 100)
  const weights: AuditScoreWeights = includesRecommendations
    ? { requirements: 0.9, recommendations: 0.1, humanReview: 0 }
    : { requirements: 1, recommendations: 0, humanReview: 0 }
  const conservativeScore = Math.max(
    0,
    Math.round(
      requirementScore * weights.requirements + recommendationScore * weights.recommendations,
    ),
  )
  const confirmedScore = Math.max(
    0,
    Math.round(
      confirmedRequirementScore * weights.requirements +
        confirmedRecommendationScore * weights.recommendations,
    ),
  )
  const score = conservativeScore
  const activeViolations = violations.filter(shouldCountAsActiveOccurrence)
  const failedRuleIds = new Set([...failedRequirementRuleIds, ...failedRecommendationRuleIds])
  const totalOccurrenceCount = violations.length

  return {
    score,
    conservativeScore,
    confirmedScore,
    baseScore: score,
    volumeScoreCap: 100,
    scoredViolationCount: failedRuleIds.size,
    requirementScore,
    confirmedRequirementScore,
    recommendationScore,
    confirmedRecommendationScore,
    humanReviewScore,
    totalRequirementRules,
    totalRecommendationRules,
    violatedRequirementRules,
    confirmedViolatedRequirementRules,
    violatedRecommendationRules,
    confirmedViolatedRecommendationRules,
    pendingHumanRequirementRules,
    pendingHumanRecommendationRules,
    pendingHumanReviewItems,
    completedHumanReviewItems,
    totalHumanReviewItems,
    includesRecommendations,
    includesHumanReview,
    weights,
    isProvisional: pendingHumanReviewItems > 0,
    totalRequirementWeight,
    failedRequirementWeight,
    confirmedFailedRequirementWeight,
    totalRecommendationWeight,
    failedRecommendationWeight,
    confirmedFailedRecommendationWeight,
    activeOccurrenceCount: activeViolations.length,
    totalOccurrenceCount,
    problemTypeCount: new Set(activeViolations.map((violation) => violation.ruleId)).size,
    automaticFindingCount: violations.filter((violation) => violation.findingOrigin === 'automatic')
      .length,
    confirmedFindingCount: violations.filter(isConfirmedFinding).length,
    ignoredFindingCount: violations.filter(isIgnoredFinding).length,
    manualFindingCount: violations.filter((violation) => violation.findingOrigin === 'manual')
      .length,
  }
}

export function getRequirementScoreData(result: AuditResult): RequirementScoreData {
  const auditScore = getAuditScoreData(result)

  return {
    score: auditScore.requirementScore,
    totalRequirementRules: auditScore.totalRequirementRules,
    violatedRequirementRules: auditScore.violatedRequirementRules,
    pendingHumanRequirementRules: auditScore.pendingHumanRequirementRules,
  }
}
