import { t } from '@/i18n'
import type { AuditResult } from '@/types'
import {
  getConfirmedHumanReviewCount,
  getDismissedHumanReviewCount,
  getPendingHumanReviewCount,
} from '@/utils/audit-comparison'
import { getAuditScoreData, getRequirementScoreData } from '@/utils/audit-score'

export function buildExportableAuditResult(result: AuditResult) {
  const confirmedReviews = getConfirmedHumanReviewCount(result)
  const dismissedReviews = getDismissedHumanReviewCount(result)
  const pendingReviews = getPendingHumanReviewCount(result)
  const auditScore = getAuditScoreData(result)
  const requirementScore = getRequirementScoreData(result)
  const compactAudit = {
    ...result,
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
    schemaVersion: 2,
    exportedAt: Date.now(),
    audit: compactAudit,
    summary: {
      auditScore,
      requirementScore,
      humanReview: {
        confirmed: confirmedReviews,
        dismissed: dismissedReviews,
        pending: pendingReviews,
        completed: confirmedReviews + dismissedReviews,
      },
    },
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR')
}

export function buildAuditSummaryJson(result: AuditResult) {
  const auditScore = getAuditScoreData(result)
  const confirmedReviews = getConfirmedHumanReviewCount(result)
  const dismissedReviews = getDismissedHumanReviewCount(result)
  const pendingReviews = getPendingHumanReviewCount(result)
  const topViolations = [...result.violations]
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
      if (a.requiresHumanReview !== b.requiresHumanReview) return a.requiresHumanReview ? -1 : 1
      return a.nbrReference.localeCompare(b.nbrReference, 'pt-BR')
    })
    .slice(0, 12)

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
      total: result.totalViolations,
      requirements: result.errors,
      recommendations: result.warnings,
      humanReview: result.humanReviewItems,
      confirmed: confirmedReviews,
      dismissed: dismissedReviews,
      pending: pendingReviews,
    },
    mainFindings: topViolations.map((violation) => ({
      nbrReference: violation.nbrReference,
      ruleName: violation.ruleName,
      message: violation.message,
      normativeType: violation.normativeType,
      requiresHumanReview: violation.requiresHumanReview,
      humanReviewStatus: violation.humanReviewStatus,
    })),
  }
}
