import React from 'react'
import ReactDOM from 'react-dom/client'
import { Button, ConfigProvider, Empty, Layout, Segmented, Space, Tag } from 'antd'
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import ptBR from 'antd/locale/pt_BR'
import { ReportSkeleton } from './components/LoadingSkeletons'
import { t } from './i18n'
import { isNormativeRequirement } from './normative'
import type { AuditResult, Violation } from './types'
import { buildAuditSummaryJson, buildExportableAuditResult } from './utils/audit-export'
import { getAuditScoreData } from './utils/audit-score'
import { isIgnoredFinding, normalizeViolationFindingState } from './utils/audit-triage'
import { getReportSnapshot } from './utils/report-snapshots'
import { APP_VERSION_LABEL } from './version'
import { createGuardAntTheme } from './theme/antd'
import './styles/theme.css'
import './styles/report.css'

const { Header, Content } = Layout
const antTheme = createGuardAntTheme()

interface ReportSection {
  key: string
  title: string
  description: string
  violations: Violation[]
}

type ReportMode = 'detailed' | 'summary'

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR')
}

function getSnapshotId(): string | null {
  return new URLSearchParams(window.location.search).get('snapshotId')
}

function downloadJsonFile(data: unknown, filenamePrefix: string): void {
  const dataStr = JSON.stringify(data, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filenamePrefix}-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function downloadDetailedJson(result: AuditResult): void {
  downloadJsonFile(buildExportableAuditResult(result), t('shared.exports.reportFilePrefix'))
}

function downloadSummaryJson(result: AuditResult): void {
  downloadJsonFile(buildAuditSummaryJson(result), t('shared.exports.summaryFilePrefix'))
}

function groupByRule(violations: Violation[]): Array<{ key: string; violations: Violation[] }> {
  const groups = new Map<string, Violation[]>()

  violations.forEach((violation) => {
    const key = violation.ruleId || `${violation.nbrReference}-${violation.ruleName}`
    groups.set(key, [...(groups.get(key) ?? []), violation])
  })

  return Array.from(groups.entries()).map(([key, groupViolations]) => ({
    key,
    violations: groupViolations,
  }))
}

function getFindingLabel(violation: Violation): string {
  if (violation.findingStatus === 'ignored') return t('shared.findings.ignored')
  if (violation.findingStatus === 'confirmed') return t('shared.findings.confirmed')
  return violation.findingOrigin === 'manual'
    ? t('shared.findings.manualOpen')
    : t('shared.findings.automaticOpen')
}

function getAlternativeTextSourceLabel(
  source: NonNullable<Violation['alternativeTextReview']>['currentSource'],
): string {
  const sourceKeys: Record<typeof source, string> = {
    alt: 'violations.alternativeTextSources.alt',
    'aria-label': 'violations.alternativeTextSources.ariaLabel',
    'aria-labelledby': 'violations.alternativeTextSources.ariaLabelledBy',
    title: 'violations.alternativeTextSources.title',
    accessible_name: 'violations.alternativeTextSources.accessibleName',
    missing: 'violations.alternativeTextSources.missing',
  }

  return t(sourceKeys[source])
}

function getAlternativeTextCurrentValue(
  review: NonNullable<Violation['alternativeTextReview']>,
): string {
  if (review.currentSource === 'missing') return t('violations.alternativeTextCurrentMissing')
  if (review.currentText === '') return t('violations.alternativeTextCurrentEmpty')
  return review.currentText || t('violations.alternativeTextCurrentMissing')
}

function buildSections(result: AuditResult): ReportSection[] {
  const violations = result.violations.map(normalizeViolationFindingState)
  const activeViolations = violations.filter((violation) => !isIgnoredFinding(violation))
  const ignoredViolations = violations.filter(isIgnoredFinding)

  return [
    {
      key: 'requirements',
      title: t('report.sections.requirementsTitle'),
      description: t('report.sections.requirementsDescription'),
      violations: activeViolations.filter((violation) =>
        isNormativeRequirement(violation.nbrReference),
      ),
    },
    {
      key: 'recommendations',
      title: t('report.sections.recommendationsTitle'),
      description: t('report.sections.recommendationsDescription'),
      violations: activeViolations.filter(
        (violation) => !isNormativeRequirement(violation.nbrReference),
      ),
    },
    {
      key: 'ignored',
      title: t('report.sections.ignoredTitle'),
      description: t('report.sections.ignoredDescription'),
      violations: ignoredViolations,
    },
  ]
}

const ViolationReportItem: React.FC<{ violation: Violation }> = ({ violation }) => (
  <article className="report-finding">
    <div className="report-finding-header">
      <div>
        <h4>{violation.message}</h4>
        <p>
          NBR {violation.nbrReference} · WCAG {violation.wcagLevel}
        </p>
      </div>
      <Space wrap>
        <Tag color={violation.severity === 'error' ? 'red' : 'orange'}>
          {violation.severity === 'error'
            ? t('shared.severity.error')
            : t('shared.severity.warning')}
        </Tag>
        <Tag>{getFindingLabel(violation)}</Tag>
      </Space>
    </div>

    <div className="report-finding-grid">
      <section>
        <strong>{t('shared.labels.affectedElement')}</strong>
        <code>{violation.elementSelector || violation.snippet || '-'}</code>
      </section>
      <section>
        <strong>{t('shared.labels.suggestion')}</strong>
        <p>{violation.suggestion}</p>
      </section>
      <section>
        <strong>{t('shared.labels.howToFix')}</strong>
        <p>{violation.remediationAdvice}</p>
      </section>
    </div>

    {violation.alternativeTextReview?.proposedText && (
      <section className="report-callout">
        <strong>{t('violations.alternativeTextTitle')}</strong>
        <p>
          {t('report.alternativeTextCurrent')}:&nbsp;
          {getAlternativeTextCurrentValue(violation.alternativeTextReview)}
        </p>
        <p>
          {t('violations.alternativeTextSourceLabel')}:&nbsp;
          {getAlternativeTextSourceLabel(violation.alternativeTextReview.currentSource)}
        </p>
        <p>
          {t('report.alternativeTextProposal')}:&nbsp;
          <strong>{violation.alternativeTextReview.proposedText}</strong>
        </p>
      </section>
    )}

    {violation.userContrastOverride && (
      <section className="report-callout">
        <strong>{t('violations.contrastUserOverrideSaved')}</strong>
        <p>
          {violation.userContrastOverride.foregroundHex} /{' '}
          {violation.userContrastOverride.backgroundHex}
        </p>
      </section>
    )}

    {violation.ignoreReason && (
      <section className="report-callout">
        <strong>{t('violations.ignoreSummaryTitle')}</strong>
        <p>{violation.ignoreReason}</p>
        {violation.ignoreNote && <p>{violation.ignoreNote}</p>}
      </section>
    )}

    {violation.userNote && (
      <section className="report-callout">
        <strong>{t('shared.labels.annotations')}</strong>
        <p>{violation.userNote}</p>
      </section>
    )}
  </article>
)

function getRuleSummary(violations: Violation[]) {
  return {
    alternativeTextReviews: violations.filter((violation) =>
      Boolean(violation.alternativeTextReview?.proposedText?.trim()),
    ).length,
    contrastAdjustments: violations.filter((violation) => Boolean(violation.userContrastOverride))
      .length,
    ignored: violations.filter(isIgnoredFinding).length,
    notes: violations.filter((violation) => Boolean(violation.userNote?.trim())).length,
    errors: violations.filter((violation) => violation.severity === 'error').length,
    warnings: violations.filter((violation) => violation.severity === 'warning').length,
    total: violations.length,
  }
}

const SummaryViolationItem: React.FC<{ violation: Violation }> = ({ violation }) => (
  <article className="report-summary-finding">
    <div>
      <strong>{violation.message}</strong>
      <span>
        NBR {violation.nbrReference} ·{' '}
        {violation.elementSelector || violation.elementTagName || '-'}
      </span>
    </div>
    <Space wrap>
      <Tag color={violation.severity === 'error' ? 'red' : 'orange'}>
        {violation.severity === 'error' ? t('shared.severity.error') : t('shared.severity.warning')}
      </Tag>
      <Tag>{getFindingLabel(violation)}</Tag>
    </Space>
    {(violation.userContrastOverride ||
      violation.alternativeTextReview?.proposedText ||
      violation.userNote ||
      violation.ignoreReason) && (
      <ul>
        {violation.userContrastOverride && (
          <li>
            {t('report.summaryContrast')}: {violation.userContrastOverride.foregroundHex} /{' '}
            {violation.userContrastOverride.backgroundHex}
          </li>
        )}
        {violation.alternativeTextReview?.proposedText && (
          <li>
            {t('report.summaryAlternativeText')}: {violation.alternativeTextReview.proposedText}
          </li>
        )}
        {violation.userNote && (
          <li>
            {t('shared.labels.annotations')}: {violation.userNote}
          </li>
        )}
        {violation.ignoreReason && (
          <li>
            {t('violations.ignoreSummaryTitle')}: {violation.ignoreReason}
            {violation.ignoreNote ? ` — ${violation.ignoreNote}` : ''}
          </li>
        )}
      </ul>
    )}
  </article>
)

const SummaryReportSectionView: React.FC<{ section: ReportSection }> = ({ section }) => (
  <section className="report-section report-summary-section">
    <div className="report-section-header">
      <div>
        <h2>{section.title}</h2>
        <p>{section.description}</p>
      </div>
      <Tag>{t('shared.counts.items', { count: section.violations.length })}</Tag>
    </div>

    {section.violations.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('report.sections.empty')} />
    ) : (
      groupByRule(section.violations).map((group) => {
        const firstViolation = group.violations[0]
        const summary = getRuleSummary(group.violations)

        return (
          <article className="report-summary-rule" key={`${section.key}-${group.key}`}>
            <div className="report-rule-header">
              <div>
                <h3>{firstViolation.ruleName}</h3>
                <p>{firstViolation.description}</p>
              </div>
              <Tag color={isNormativeRequirement(firstViolation.nbrReference) ? 'red' : 'blue'}>
                NBR {firstViolation.nbrReference}
              </Tag>
            </div>
            <div className="report-summary-chips">
              <span>
                <strong>{summary.total}</strong> {t('report.summaryOccurrences')}
              </span>
              <span>
                <strong>{summary.errors}</strong> {t('shared.severity.error')}
              </span>
              <span>
                <strong>{summary.warnings}</strong> {t('shared.severity.warning')}
              </span>
              <span>
                <strong>{summary.ignored}</strong> {t('summary.scorePanelIgnoredFindingsShort')}
              </span>
              <span>
                <strong>{summary.contrastAdjustments}</strong> {t('report.summaryContrastCount')}
              </span>
              <span>
                <strong>{summary.alternativeTextReviews}</strong>{' '}
                {t('report.summaryAlternativeTextCount')}
              </span>
              <span>
                <strong>{summary.notes}</strong> {t('shared.labels.annotations')}
              </span>
            </div>
            <div className="report-summary-findings">
              {group.violations.map((violation) => (
                <SummaryViolationItem key={violation.id} violation={violation} />
              ))}
            </div>
          </article>
        )
      })
    )}
  </section>
)

const ReportSectionView: React.FC<{ section: ReportSection }> = ({ section }) => (
  <section className="report-section">
    <div className="report-section-header">
      <div>
        <h2>{section.title}</h2>
        <p>{section.description}</p>
      </div>
      <Tag>{t('shared.counts.items', { count: section.violations.length })}</Tag>
    </div>

    {section.violations.length === 0 ? (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('report.sections.empty')} />
    ) : (
      groupByRule(section.violations).map((group) => {
        const firstViolation = group.violations[0]
        return (
          <article className="report-rule-group" key={`${section.key}-${group.key}`}>
            <div className="report-rule-header">
              <div>
                <h3>{firstViolation.ruleName}</h3>
                <p>{firstViolation.description}</p>
              </div>
              <Tag color={isNormativeRequirement(firstViolation.nbrReference) ? 'red' : 'blue'}>
                NBR {firstViolation.nbrReference}
              </Tag>
            </div>
            {group.violations.map((violation) => (
              <ViolationReportItem key={violation.id} violation={violation} />
            ))}
          </article>
        )
      })
    )}
  </section>
)

export const ReportApp: React.FC = () => {
  const [auditResult, setAuditResult] = React.useState<AuditResult | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [reportMode, setReportMode] = React.useState<ReportMode>('detailed')

  React.useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const snapshotId = getSnapshotId()
        const result = snapshotId ? await getReportSnapshot(snapshotId) : null
        setAuditResult(result)
      } catch (error) {
        console.error('Erro ao carregar relatório:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadSnapshot()
  }, [])

  const scoreData = auditResult ? getAuditScoreData(auditResult) : null
  const sections = React.useMemo(
    () => (auditResult ? buildSections(auditResult) : []),
    [auditResult],
  )

  return (
    <Layout className="report-app">
      <Header className="report-topbar">
        <div>
          <span>{APP_VERSION_LABEL}</span>
          <h1>{t('report.title')}</h1>
        </div>
        {auditResult && (
          <Space className="report-actions">
            <Segmented
              options={[
                { label: t('report.modeDetailed'), value: 'detailed' },
                { label: t('report.modeSummary'), value: 'summary' },
              ]}
              value={reportMode}
              onChange={(value) => setReportMode(value as ReportMode)}
            />

            <Button
              icon={<DownloadOutlined />}
              onClick={
                reportMode === 'summary'
                  ? () => downloadSummaryJson(auditResult)
                  : () => downloadDetailedJson(auditResult)
              }
            >
              {t('shared.actions.exportJson')}
            </Button>

            <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
              {reportMode === 'summary' ? t('report.printSummary') : t('report.printDetailed')}
            </Button>
          </Space>
        )}
      </Header>

      <Content className="report-content">
        {loading ? (
          <ReportSkeleton />
        ) : !auditResult || !scoreData ? (
          <Empty description={t('report.empty')} />
        ) : (
          <>
            <section className="report-hero">
              <div>
                <span>{t('report.eyebrow')}</span>
                <h2>{auditResult.pageTitle || t('shared.labels.untitled')}</h2>
                <p>{auditResult.url}</p>
                <small>
                  {t('shared.labels.auditedAt')}: {formatDate(auditResult.timestamp)}
                </small>
              </div>
              <div className="report-score">
                <span>{t('summary.scoreLabel')}</span>
                <strong>{scoreData.score}/100</strong>
              </div>
            </section>

            <section className="report-metrics">
              <div>
                <span>{t('summary.scorePanelActionableFindings')}</span>
                <strong>{scoreData.activeOccurrenceCount}</strong>
              </div>
              <div>
                <span>{t('summary.scorePanelProblemTypes')}</span>
                <strong>{scoreData.problemTypeCount}</strong>
              </div>
              <div>
                <span>{t('summary.scorePanelFailedRequirements')}</span>
                <strong>{scoreData.violatedRequirementRules}</strong>
              </div>
              <div>
                <span>{t('summary.scorePanelIgnoredFindingsShort')}</span>
                <strong>{scoreData.ignoredFindingCount}</strong>
              </div>
            </section>

            {reportMode === 'summary' ? (
              <section className="report-summary-intro">
                <h2>{t('report.summaryTitle')}</h2>
                <p>{t('report.summaryDescription')}</p>
              </section>
            ) : null}

            {sections.map((section) =>
              reportMode === 'summary' ? (
                <SummaryReportSectionView key={section.key} section={section} />
              ) : (
                <ReportSectionView key={section.key} section={section} />
              ),
            )}
          </>
        )}
      </Content>
    </Layout>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <ConfigProvider locale={ptBR} theme={antTheme}>
      <ReportApp />
    </ConfigProvider>
  </React.StrictMode>,
)
