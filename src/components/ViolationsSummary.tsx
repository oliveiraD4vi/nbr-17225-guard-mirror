import React from 'react'
import { Button, Card, Dropdown, Empty, Space, Tag } from 'antd'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DownOutlined,
  DownloadOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { PROJECT_SCORE_URL } from '@/config/links'
import { t } from '@/i18n'
import type { AuditResult } from '@/types'
import {
  getConfirmedHumanReviewCount,
  getDismissedHumanReviewCount,
  getPendingHumanReviewCount,
} from '@/utils/audit-comparison'
import { getAuditScoreData } from '@/utils/audit-score'
import { SummarySkeleton } from './LoadingSkeletons'
import '../styles/violations-summary.css'

interface ViolationsSummaryProps {
  result: AuditResult | null
  reviewSourceResult?: AuditResult | null
  loading?: boolean
  onDownloadFullReport?: () => void
  onDownloadSummary?: () => void
  onOpenViolations?: () => void
  onRerunAudit?: () => void
  showHumanReview?: boolean
}

export const ViolationsSummary: React.FC<ViolationsSummaryProps> = React.memo(
  ({
    result,
    reviewSourceResult,
    loading = false,
    onDownloadFullReport,
    onDownloadSummary,
    onOpenViolations,
    onRerunAudit,
    showHumanReview = true,
  }) => {
    if (loading) {
      return <SummarySkeleton />
    }

    if (!result) {
      return <Empty description={t('summary.empty')} style={{ marginTop: '50px' }} />
    }

    const hasViolations = result.totalViolations > 0
    const auditScore = getAuditScoreData(result)
    const reviewBase = reviewSourceResult ?? result
    const confirmedReviews = showHumanReview ? getConfirmedHumanReviewCount(reviewBase) : 0
    const dismissedReviews = showHumanReview ? getDismissedHumanReviewCount(reviewBase) : 0
    const pendingReviews = showHumanReview ? getPendingHumanReviewCount(reviewBase) : 0
    const scoreTone =
      auditScore.score >= 90 ? 'good' : auditScore.score >= 70 ? 'medium' : 'critical'
    const nextStep =
      result.errors > 0
        ? {
            tone: 'error',
            icon: <WarningOutlined />,
            title: t('summary.nextStepRequirementsTitle'),
            description: t('summary.nextStepRequirementsDescription'),
          }
        : showHumanReview && pendingReviews > 0
          ? {
              tone: 'review',
              icon: <WarningOutlined />,
              title: t('summary.nextStepHumanReviewTitle'),
              description: t('summary.nextStepHumanReviewDescription'),
            }
          : result.warnings > 0
            ? {
                tone: 'warning',
                icon: <WarningOutlined />,
                title: t('summary.nextStepRecommendationsTitle'),
                description: t('summary.nextStepRecommendationsDescription'),
              }
            : {
                tone: 'success',
                icon: <CheckCircleOutlined />,
                title: t('summary.nextStepClearTitle'),
                description: t('summary.nextStepClearDescription'),
              }

    const downloadItems = [
      {
        key: 'full',
        icon: <DownloadOutlined />,
        label: t('summary.downloadFullJson'),
        onClick: onDownloadFullReport,
      },
      {
        key: 'summary',
        icon: <FileTextOutlined />,
        label: t('summary.downloadSummaryJson'),
        onClick: onDownloadSummary,
      },
    ].filter((item) => Boolean(item.onClick))
    const scoreFactItems = [
      {
        key: 'requirement-rules',
        label: t('summary.scorePanelRequirementRules'),
        value: auditScore.totalRequirementRules,
      },
      {
        key: 'failed-requirements',
        label: t('summary.scorePanelFailedRequirements'),
        value: auditScore.violatedRequirementRules,
      },
      {
        key: 'recommendation-rules',
        label: t('summary.scorePanelRecommendationRules'),
        value: auditScore.totalRecommendationRules,
      },
      {
        key: 'failed-recommendations',
        label: t('summary.scorePanelFailedRecommendations'),
        value: auditScore.violatedRecommendationRules,
      },
      {
        key: 'problem-types',
        label: t('summary.scorePanelProblemTypes'),
        value: auditScore.problemTypeCount,
      },
      {
        key: 'occurrences',
        label: t('summary.scorePanelOccurrences'),
        value: auditScore.totalOccurrenceCount,
      },
      {
        key: 'automatic-findings',
        label: t('summary.scorePanelAutomaticFindings'),
        value: auditScore.automaticFindingCount,
      },
      {
        key: 'human-review',
        label: t('summary.scorePanelHumanReview'),
        value: `${auditScore.completedHumanReviewItems}/${auditScore.totalHumanReviewItems}`,
      },
    ]
    const scoreFormula = auditScore.includesRecommendations
      ? t('summary.scoreFormulaWithRecommendations', {
          requirements: Math.round(auditScore.weights.requirements * 100),
          recommendations: Math.round(auditScore.weights.recommendations * 100),
          requirementScore: auditScore.requirementScore,
          recommendationScore: auditScore.recommendationScore,
        })
      : t('summary.scoreFormulaRequirementsOnly', {
          requirementScore: auditScore.requirementScore,
        })

    return (
      <div className="violations-summary">
        <Card className="summary-card">
          <div className="summary-hero">
            <div className="summary-hero-copy">
              <span className="summary-eyebrow">{t('summary.eyebrow')}</span>
              <h2>
                {hasViolations ? t('summary.titleWithIssues') : t('summary.titleWithoutIssues')}
              </h2>
              <p>
                {hasViolations
                  ? t('summary.descriptionWithIssues')
                  : t('summary.descriptionWithoutIssues')}
              </p>
            </div>
            <div className={`summary-status-pill ${hasViolations ? 'is-warning' : 'is-success'}`}>
              {hasViolations ? <WarningOutlined /> : <CheckCircleOutlined />}
              <span>
                {hasViolations
                  ? t('shared.states.actionRequired')
                  : t('shared.states.verifiedCompliant')}
              </span>
            </div>
            <Space className="summary-actions" size={8}>
              {downloadItems.length > 0 && (
                <Dropdown menu={{ items: downloadItems }} trigger={['click']}>
                  <Button icon={<DownloadOutlined />}>
                    {t('shared.actions.download')} <DownOutlined />
                  </Button>
                </Dropdown>
              )}
              {onRerunAudit && (
                <Button icon={<ReloadOutlined />} onClick={onRerunAudit}>
                  {t('shared.actions.rerun')}
                </Button>
              )}
            </Space>
          </div>

          <div className="summary-meta">
            <div className="summary-meta-item">
              <LinkOutlined />
              <span>{result.url}</span>
            </div>
            <div className="summary-meta-item">
              <CalendarOutlined />
              <span>{new Date(result.timestamp).toLocaleString('pt-BR')}</span>
            </div>
          </div>

          <div className={`summary-score-card is-${scoreTone}`}>
            <div className="summary-score-copy">
              <span className="summary-score-label-row">
                <span className="summary-stat-label">{t('summary.scoreLabel')}</span>
                <Button
                  className="summary-score-link"
                  href={PROJECT_SCORE_URL}
                  icon={<InfoCircleOutlined />}
                  rel="noreferrer"
                  size="small"
                  target="_blank"
                  type="link"
                >
                  {t('summary.scoreExplanationLink')}
                </Button>
              </span>
              <strong>{t('summary.scoreOutOf', { score: auditScore.score })}</strong>
              <p>{t('summary.scoreDescription')}</p>
              <div className="summary-score-meter" aria-hidden="true">
                <span
                  className="summary-score-meter-fill"
                  style={{ width: `${auditScore.score}%` }}
                />
              </div>
            </div>
            <div className="summary-score-meta">
              <Tag
                color={auditScore.score >= 90 ? 'green' : auditScore.score >= 70 ? 'gold' : 'red'}
              >
                {t('summary.failingRequirements', {
                  count: auditScore.violatedRequirementRules,
                })}
              </Tag>
              {auditScore.includesRecommendations && (
                <Tag color={auditScore.violatedRecommendationRules > 0 ? 'blue' : 'green'}>
                  {t('summary.failingRecommendations', {
                    count: auditScore.violatedRecommendationRules,
                  })}
                </Tag>
              )}
              {showHumanReview && auditScore.pendingHumanReviewItems > 0 && (
                <Tag color="gold">
                  {t('summary.pendingHumanReviewScore', {
                    count: auditScore.pendingHumanReviewItems,
                  })}
                </Tag>
              )}
              {auditScore.isProvisional && <Tag color="gold">{t('summary.provisionalScore')}</Tag>}
            </div>
          </div>

          <div className="summary-score-panel">
            <div className="summary-score-panel-header">
              <h3>{t('summary.scorePanelTitle')}</h3>
              <p>{t('summary.scorePanelDescription')}</p>
            </div>
            <div className="summary-score-fact-grid">
              {scoreFactItems.map((item) => (
                <div className="summary-score-fact" key={item.key}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <p className="summary-score-formula">{scoreFormula}</p>
          </div>

          <div className="summary-total-wrapper">
            <div className="summary-stat-card is-total">
              <span className="summary-stat-label">{t('shared.labels.total')}</span>
              <strong>{result.totalViolations}</strong>
              <small>{t('summary.totalItemsFound')}</small>
            </div>

            <div className="summary-stat-grid">
              <div className="summary-stat-card is-error">
                <span className="summary-stat-label">{t('shared.labels.requirements')}</span>
                <strong>{result.errors}</strong>
                <small>{t('summary.requirementsMissed')}</small>
              </div>
              <div className="summary-stat-card is-warning">
                <span className="summary-stat-label">{t('shared.labels.recommendations')}</span>
                <strong>{result.warnings}</strong>
                <small>{t('summary.recommendationsReview')}</small>
              </div>
              {showHumanReview && (
                <div className="summary-stat-card is-review">
                  <span className="summary-stat-label">{t('shared.labels.humanReview')}</span>
                  <strong>{result.humanReviewItems}</strong>
                  <small>{t('summary.itemsToConfirm')}</small>
                </div>
              )}
            </div>
            <p className="summary-scope-note">{t('summary.normativeScopeNote')}</p>
          </div>

          {showHumanReview && (
            <div className="summary-review-progress">
              <div className="summary-review-progress-header">
                <h3>{t('summary.humanReviewProgress')}</h3>
                <Tag color={pendingReviews > 0 ? 'gold' : 'green'}>
                  {pendingReviews > 0
                    ? t('summary.pendingReviewBadge')
                    : t('summary.completedReviewBadge')}
                </Tag>
              </div>
              <div className="summary-review-progress-grid">
                <div className="summary-review-card is-confirmed">
                  <span className="summary-stat-label">{t('summary.confirmed')}</span>
                  <strong>{confirmedReviews}</strong>
                  <small>{t('summary.confirmedDescription')}</small>
                </div>
                <div className="summary-review-card is-dismissed">
                  <span className="summary-stat-label">{t('summary.dismissed')}</span>
                  <strong>{dismissedReviews}</strong>
                  <small>{t('summary.dismissedDescription')}</small>
                </div>
                <div className="summary-review-card is-pending">
                  <span className="summary-stat-label">{t('summary.pending')}</span>
                  <strong>{pendingReviews}</strong>
                  <small>{t('summary.pendingDescription')}</small>
                </div>
              </div>
            </div>
          )}

          <div className={`summary-next-step is-${nextStep.tone}`}>
            <button className="summary-next-step-button" type="button" onClick={onOpenViolations}>
              <span className="summary-next-step-icon">{nextStep.icon}</span>
              <span>
                <span className="summary-stat-label">{t('summary.nextStepLabel')}</span>
                <strong>{nextStep.title}</strong>
                <p>{nextStep.description}</p>
              </span>
              <ArrowRightOutlined className="summary-next-step-arrow" aria-hidden="true" />
            </button>
          </div>

          {!hasViolations && (
            <div className="success-message">
              <CheckCircleOutlined
                style={{ fontSize: '40px', color: 'var(--guard-color-success-text)' }}
              />
              <p>{t('summary.success')}</p>
            </div>
          )}
        </Card>
      </div>
    )
  },
)
