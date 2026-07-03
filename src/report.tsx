import React from 'react'
import ReactDOM from 'react-dom/client'
import { Button, ConfigProvider, Empty, Layout, Space, Tag } from 'antd'
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import ptBR from 'antd/locale/pt_BR'
import { ReportSkeleton } from './components/LoadingSkeletons'
import { t } from './i18n'
import { isNormativeRequirement } from './normative'
import type { AuditResult, Violation } from './types'
import { buildExportableAuditResult } from './utils/audit-export'
import { getAuditScoreData } from './utils/audit-score'
import { isIgnoredFinding, normalizeViolationFindingState } from './utils/audit-triage'
import { getReportSnapshot } from './utils/report-snapshots'
import { APP_VERSION_LABEL } from './version'
import './styles/theme.css'
import './styles/report.css'

const { Header, Content } = Layout
const cssRoot = document.documentElement

function resolveGuardToken(variableName: string, fallback: string) {
  const resolved = getComputedStyle(cssRoot).getPropertyValue(variableName).trim()
  return resolved || fallback
}

const antThemeTokens = {
  colorPrimary: resolveGuardToken('--guard-color-primary', '#0f766e'),
  colorBgBase: resolveGuardToken('--guard-color-page-bg', '#f3f6fb'),
  colorBgLayout: resolveGuardToken('--guard-color-page-bg', '#f3f6fb'),
  colorBgContainer: resolveGuardToken('--guard-color-surface', '#ffffff'),
  colorBgElevated: resolveGuardToken('--guard-color-surface', '#ffffff'),
  colorBgSpotlight: resolveGuardToken('--guard-color-tooltip-bg', '#0f172a'),
  colorFillAlter: resolveGuardToken('--guard-color-surface-muted', '#f8fafc'),
  colorBorder: resolveGuardToken('--guard-color-border', '#e2e8f0'),
  colorBorderSecondary: resolveGuardToken('--guard-color-border', '#e2e8f0'),
  colorTextBase: resolveGuardToken('--guard-color-text-primary', '#0f172a'),
  colorText: resolveGuardToken('--guard-color-text-primary', '#0f172a'),
  colorTextSecondary: resolveGuardToken('--guard-color-text-secondary', '#475569'),
  borderRadius: 8,
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
}

interface ReportSection {
  key: string
  title: string
  description: string
  violations: Violation[]
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('pt-BR')
}

function getSnapshotId(): string | null {
  return new URLSearchParams(window.location.search).get('snapshotId')
}

function downloadJson(result: AuditResult): void {
  const dataStr = JSON.stringify(buildExportableAuditResult(result), null, 2)
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${t('shared.exports.reportFilePrefix')}-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
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
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              {t('shared.actions.print')}
            </Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => downloadJson(auditResult)}
            >
              {t('shared.actions.exportJson')}
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

            {sections.map((section) => (
              <ReportSectionView key={section.key} section={section} />
            ))}
          </>
        )}
      </Content>
    </Layout>
  )
}

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <ConfigProvider
      locale={ptBR}
      theme={{
        token: antThemeTokens,
      }}
    >
      <ReportApp />
    </ConfigProvider>
  </React.StrictMode>,
)
