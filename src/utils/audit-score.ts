import { isNormativeRecommendation, isNormativeRequirement } from '@/normative'
import { getRunnableRules } from '@/rules'
import type { AuditResult, Rule, SeverityLevel, Violation } from '@/types'

function getRequirementRules(includeHumanReview: boolean): Rule[] {
  return getRunnableRules(false, includeHumanReview)
}

function getRecommendationRules(includeHumanReview: boolean): Rule[] {
  return getRunnableRules(true, includeHumanReview).filter((rule) =>
    isNormativeRecommendation(rule.nbrReference),
  )
}

function getRuleWeight(severity: SeverityLevel): number {
  return severity === 'error' ? 2 : 1
}

function shouldCountViolation(violation: Violation): boolean {
  if (!violation.requiresHumanReview) return true
  return violation.humanReviewStatus === 'confirmed'
}

function shouldCountAsActiveOccurrence(violation: Violation): boolean {
  return !(violation.requiresHumanReview && violation.humanReviewStatus === 'dismissed')
}

function getRuleMap(rules: Rule[]): Map<string, Rule> {
  return new Map(rules.map((rule) => [rule.id, rule]))
}

function getTotalWeight(rules: Rule[]): number {
  return rules.reduce((total, rule) => total + getRuleWeight(rule.severity), 0)
}

function getFailedRuleIds(
  result: AuditResult,
  ruleIds: Set<string>,
  predicate: (reference: string) => boolean,
): Set<string> {
  return new Set(
    result.violations
      .filter((violation) => predicate(violation.nbrReference) && shouldCountViolation(violation))
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
          violation.humanReviewStatus === 'pending',
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
  baseScore: number
  volumeScoreCap: number
  scoredViolationCount: number
  requirementScore: number
  recommendationScore: number
  humanReviewScore: number
  totalRequirementRules: number
  totalRecommendationRules: number
  violatedRequirementRules: number
  violatedRecommendationRules: number
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
  totalRecommendationWeight: number
  failedRecommendationWeight: number
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
  const includesRecommendations =
    result.includeRecommendations ??
    result.violations.some((violation) => isNormativeRecommendation(violation.nbrReference))
  const includesHumanReview = result.includeHumanReview ?? true
  const requirementRules = getRequirementRules(includesHumanReview)
  const recommendationRules = includesRecommendations
    ? getRecommendationRules(includesHumanReview)
    : []
  const requirementRuleMap = getRuleMap(requirementRules)
  const recommendationRuleMap = getRuleMap(recommendationRules)
  const requirementRuleIds = new Set(requirementRuleMap.keys())
  const recommendationRuleIds = new Set(recommendationRuleMap.keys())
  const totalRequirementRules = requirementRules.length
  const totalRecommendationRules = recommendationRules.length
  const failedRequirementRuleIds = getFailedRuleIds(
    result,
    requirementRuleIds,
    isNormativeRequirement,
  )
  const failedRecommendationRuleIds = includesRecommendations
    ? getFailedRuleIds(result, recommendationRuleIds, isNormativeRecommendation)
    : new Set<string>()
  const violatedRequirementRules = failedRequirementRuleIds.size
  const violatedRecommendationRules = failedRecommendationRuleIds.size
  const pendingHumanRequirementRules = getPendingHumanRuleCount(
    result,
    requirementRuleIds,
    isNormativeRequirement,
  )
  const pendingHumanRecommendationRules = includesRecommendations
    ? getPendingHumanRuleCount(result, recommendationRuleIds, isNormativeRecommendation)
    : 0
  const humanReviewViolations = result.violations.filter(
    (violation) => violation.requiresHumanReview,
  )
  const pendingHumanReviewItems = humanReviewViolations.filter(
    (violation) => violation.humanReviewStatus === 'pending',
  ).length
  const completedHumanReviewItems = humanReviewViolations.filter(
    (violation) =>
      violation.humanReviewStatus === 'confirmed' || violation.humanReviewStatus === 'dismissed',
  ).length
  const totalHumanReviewItems = humanReviewViolations.length
  const totalRequirementWeight = getTotalWeight(requirementRules)
  const totalRecommendationWeight = getTotalWeight(recommendationRules)
  const failedRequirementWeight = getFailedWeight(failedRequirementRuleIds, requirementRuleMap)
  const failedRecommendationWeight = getFailedWeight(
    failedRecommendationRuleIds,
    recommendationRuleMap,
  )
  const requirementScore = getWeightedRuleScore(totalRequirementWeight, failedRequirementWeight)
  const recommendationScore = includesRecommendations
    ? getWeightedRuleScore(totalRecommendationWeight, failedRecommendationWeight)
    : 100
  const humanReviewScore =
    totalHumanReviewItems === 0
      ? 100
      : Math.round((completedHumanReviewItems / totalHumanReviewItems) * 100)
  const weights: AuditScoreWeights = includesRecommendations
    ? { requirements: 0.9, recommendations: 0.1, humanReview: 0 }
    : { requirements: 1, recommendations: 0, humanReview: 0 }
  const score = Math.max(
    0,
    Math.round(
      requirementScore * weights.requirements + recommendationScore * weights.recommendations,
    ),
  )
  const activeViolations = result.violations.filter(shouldCountAsActiveOccurrence)
  const failedRuleIds = new Set([...failedRequirementRuleIds, ...failedRecommendationRuleIds])
  const totalOccurrenceCount = result.totalViolations || result.violations.length

  return {
    score,
    baseScore: score,
    volumeScoreCap: 100,
    scoredViolationCount: failedRuleIds.size,
    requirementScore,
    recommendationScore,
    humanReviewScore,
    totalRequirementRules,
    totalRecommendationRules,
    violatedRequirementRules,
    violatedRecommendationRules,
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
    totalRecommendationWeight,
    failedRecommendationWeight,
    activeOccurrenceCount: activeViolations.length,
    totalOccurrenceCount,
    problemTypeCount: new Set(activeViolations.map((violation) => violation.ruleId)).size,
    automaticFindingCount: result.violations.filter((violation) => !violation.requiresHumanReview)
      .length,
    confirmedFindingCount: humanReviewViolations.filter(
      (violation) => violation.humanReviewStatus === 'confirmed',
    ).length,
    ignoredFindingCount: humanReviewViolations.filter(
      (violation) => violation.humanReviewStatus === 'dismissed',
    ).length,
    manualFindingCount: 0,
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
