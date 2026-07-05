import React, { useCallback } from 'react'
import { Button, Card, Dropdown, Empty, message, Space, Tag } from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  DownOutlined,
  DownloadOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  UpOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { PROJECT_SCORE_URL } from '@/config/links'
import { t } from '@/i18n'
import type { AuditResult } from '@/types'
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
  }) => {
    const resultKey = result ? (result.id ?? `${result.url}:${result.timestamp}`) : 'empty'
    const [scorePanelState, setScorePanelState] = React.useState({ key: resultKey, open: false })
    const isScorePanelOpen = scorePanelState.key === resultKey && scorePanelState.open

    const handleOpenReport = useCallback(async () => {
      const reportResult = reviewSourceResult ?? result
      if (!reportResult) {
        message.warning(t('popup.messages.noAuditToExport'))
        return
      }

      try {
        const response = await chrome.runtime.sendMessage({
          action: 'OPEN_REPORT',
          auditResult: reportResult,
        })
        if (response?.error) {
          throw new Error(response.error)
        }
      } catch (error) {
        console.error('Erro ao abrir relatório em nova aba:', error)
        message.error(t('popup.messages.reportOpenError'))
      }
    }, [result, reviewSourceResult])

    if (loading) {
      return <SummarySkeleton />
    }

    if (!result) {
      return <Empty description={t('summary.empty')} style={{ marginTop: '50px' }} />
    }

    const hasViolations = result.totalViolations > 0
    const auditScore = getAuditScoreData(result)
    const reviewBase = reviewSourceResult ?? result
    const auditScopeNumbers = getAuditScoreData(reviewBase)
    const ignoredFindings = auditScopeNumbers.ignoredFindingCount
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
    const scorePrimaryItems = [
      {
        key: 'active-occurrences',
        label: t('summary.scorePanelActionableFindings'),
        value: auditScopeNumbers.activeOccurrenceCount,
        tone: 'critical',
      },
      {
        key: 'problem-types',
        label: t('summary.scorePanelProblemTypes'),
        value: auditScopeNumbers.problemTypeCount,
        tone: 'info',
      },
      {
        key: 'failed-requirements',
        label: t('summary.scorePanelFailedRequirements'),
        value: auditScopeNumbers.violatedRequirementRules,
        tone: 'warning',
      },
      {
        key: 'ignored-findings',
        label: t('summary.scorePanelIgnoredFindingsShort'),
        value: ignoredFindings,
        tone: 'muted',
      },
    ]
    const scoreSecondaryItems = [
      {
        key: 'requirement-rules',
        label: t('summary.scorePanelRequirementRules'),
        value: auditScopeNumbers.totalRequirementRules,
      },
      {
        key: 'recommendation-rules',
        label: t('summary.scorePanelRecommendationRules'),
        value: auditScopeNumbers.totalRecommendationRules,
      },
      {
        key: 'occurrences',
        label: t('summary.scorePanelOccurrences'),
        value: auditScopeNumbers.totalOccurrenceCount,
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
            </div>
          </div>

          <div className={`summary-score-panel${isScorePanelOpen ? ' is-open' : ''}`}>
            <button
              type="button"
              className="summary-score-panel-toggle"
              aria-expanded={isScorePanelOpen}
              onClick={() =>
                setScorePanelState((current) => ({
                  key: resultKey,
                  open: current.key === resultKey ? !current.open : true,
                }))
              }
            >
              <span className="summary-score-panel-header">
                <strong>{t('summary.scorePanelTitle')}</strong>
                <small>{t('summary.scorePanelCollapsedDescription')}</small>
              </span>
              {isScorePanelOpen ? <UpOutlined /> : <DownOutlined />}
            </button>
            {isScorePanelOpen && (
              <div className="summary-score-panel-content">
                <p>{t('summary.scorePanelDescription')}</p>
                <div className="summary-score-metrics">
                  {scorePrimaryItems.map((item) => (
                    <div className={`summary-score-metric is-${item.tone}`} key={item.key}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                <div className="summary-score-details">
                  {scoreSecondaryItems.map((item) => (
                    <span key={item.key}>
                      <strong>{item.value}</strong> {item.label}
                    </span>
                  ))}
                </div>
                <p className="summary-score-formula">{scoreFormula}</p>
              </div>
            )}
          </div>

          <div className={`summary-next-step is-${nextStep.tone}`}>
            <button
              className="summary-next-step-button"
              type="button"
              onClick={hasViolations ? onOpenViolations : handleOpenReport}
            >
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
