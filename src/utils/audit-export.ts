import { t } from '@/i18n'
import type { AuditResult } from '@/types'
import {
  getConfirmedFindingCount,
  getIgnoredFindingCount,
  getPendingHumanReviewCount,
} from '@/utils/audit-comparison'
import { getAuditScoreData, getRequirementScoreData } from '@/utils/audit-score'
import { isIgnoredFinding, normalizeViolationFindingState } from '@/utils/audit-triage'

export function buildExportableAuditResult(result: AuditResult) {
  const confirmedFindings = getConfirmedFindingCount(result)
  const ignoredFindings = getIgnoredFindingCount(result)
  const pendingReviews = getPendingHumanReviewCount(result)
  const alternativeTextReviewCount = result.violations.filter((violation) =>
    Boolean(violation.alternativeTextReview?.proposedText?.trim()),
  ).length
  const auditScore = getAuditScoreData(result)
  const requirementScore = getRequirementScoreData(result)
  const compactAudit = {
    ...result,
    schemaVersion: 4,
    scoreRange: {
      conservative: auditScore.conservativeScore,
      confirmed: auditScore.confirmedScore,
    },
    violations: result.violations.map((violation) => {
      const compactViolation = { ...violation }
      Reflect.deleteProperty(compactViolation, 'element')
      Reflect.deleteProperty(compactViolation, 'inheritedFromHistory')
      return compactViolation
    }),
  }

  Reflect.deleteProperty(compactAudit, 'violationsByRule')
  Reflect.deleteProperty(compactAudit, 'violationsBySeverity')
  Reflect.deleteProperty(compactAudit, 'summary')

  return {
    schemaVersion: 4,
    exportedAt: Date.now(),
    audit: compactAudit,
    summary: {
      auditScore,
      requirementScore,
      findings: {
        actionable: auditScore.activeOccurrenceCount,
        confirmed: confirmedFindings,
        ignored: ignoredFindings,
        alternativeTextReviews: alternativeTextReviewCount,
        total: auditScore.totalOccurrenceCount,
      },
      humanReview: {
        confirmed: confirmedFindings,
        ignored: ignoredFindings,
        pending: pendingReviews,
        completed: confirmedFindings + ignoredFindings,
      },
    },
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR')
}

export function buildAuditSummaryJson(result: AuditResult) {
  const auditScore = getAuditScoreData(result)
  const confirmedFindings = getConfirmedFindingCount(result)
  const ignoredFindings = getIgnoredFindingCount(result)
  const pendingReviews = getPendingHumanReviewCount(result)
  const normalizedViolations = result.violations.map(normalizeViolationFindingState)
  const alternativeTextReviewCount = normalizedViolations.filter((violation) =>
    Boolean(violation.alternativeTextReview?.proposedText?.trim()),
  ).length
  const actionableViolations = normalizedViolations.filter(
    (violation) => !isIgnoredFinding(violation),
  )
  const actionableRequirementCount = actionableViolations.filter(
    (violation) => violation.normativeType === 'Requisito',
  ).length
  const actionableRecommendationCount = actionableViolations.length - actionableRequirementCount
  const summarizedViolations = normalizedViolations.sort((a, b) => {
    if (isIgnoredFinding(a) !== isIgnoredFinding(b)) return isIgnoredFinding(a) ? 1 : -1
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    if (a.requiresHumanReview !== b.requiresHumanReview) return a.requiresHumanReview ? -1 : 1
    return a.nbrReference.localeCompare(b.nbrReference, 'pt-BR')
  })

  return {
    title: t('summaryExport.title'),
    generatedAt: Date.now(),
    audit: {
      url: result.url,
      auditedAt: formatDate(result.timestamp),
      timestamp: result.timestamp,
      scope: result.includeRecommendations
        ? t('summaryExport.scopeWithRecommendations')
        : t('summaryExport.scopeRequirementsOnly'),
    },
    score: {
      general: auditScore.score,
      range: {
        conservative: auditScore.conservativeScore,
        confirmed: auditScore.confirmedScore,
      },
      provisional: auditScore.isProvisional,
      requirements: auditScore.requirementScore,
      recommendations: auditScore.includesRecommendations ? auditScore.recommendationScore : null,
      weights: auditScore.weights,
      requirementWeight: {
        total: auditScore.totalRequirementWeight,
        failed: auditScore.failedRequirementWeight,
      },
      recommendationWeight: auditScore.includesRecommendations
        ? {
            total: auditScore.totalRecommendationWeight,
            failed: auditScore.failedRecommendationWeight,
          }
        : null,
    },
    counts: {
      total: auditScore.totalOccurrenceCount,
      actionable: auditScore.activeOccurrenceCount,
      requirements: actionableRequirementCount,
      recommendations: actionableRecommendationCount,
      humanReview: result.humanReviewItems,
      confirmed: confirmedFindings,
      ignored: ignoredFindings,
      pending: pendingReviews,
      alternativeTextReviews: alternativeTextReviewCount,
    },
    mainFindings: summarizedViolations.map((violation) => ({
      nbrReference: violation.nbrReference,
      ruleName: violation.ruleName,
      severity: violation.severity,
      message: violation.message,
      normativeType: violation.normativeType,
      requiresHumanReview: violation.requiresHumanReview,
      humanReviewStatus: violation.humanReviewStatus,
      findingOrigin: violation.findingOrigin,
      findingStatus: violation.findingStatus,
      verificationMode: violation.verificationMode,
      auditScope: violation.auditScope,
      confidence: violation.confidence,
      evidence: violation.evidence,
      reviewQuestion: violation.reviewQuestion,
      ignoreReason: violation.ignoreReason,
      ignoreNote: violation.ignoreNote,
      alternativeTextReview: violation.alternativeTextReview,
      userContrastOverride: violation.userContrastOverride,
      userNote: violation.userNote,
      elementSelector: violation.elementSelector,
    })),
  }
}
