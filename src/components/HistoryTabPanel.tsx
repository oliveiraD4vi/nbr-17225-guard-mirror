import React from 'react'
import { Alert, Button, Collapse, Dropdown, Empty, List, Select, Space, Tag } from 'antd'
import {
  DeleteOutlined,
  DownloadOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { t } from '@/i18n'
import type { AuditHistoryEntry, IgnoreReason, Violation } from '@/types'
import {
  type AuditReviewChange,
  type AuditReviewChangeField,
  type AuditComparisonSummary,
  type AuditStateChange,
  getConfirmedFindingCount,
  getIgnoredFindingCount,
  getPendingHumanReviewCount,
} from '@/utils/audit-comparison'

interface ComparisonTrend {
  icon: React.ReactNode
  label: string
  color: 'green' | 'red' | 'gold' | 'default'
}

interface HistoryTabPanelProps {
  activeTabTitle?: string
  auditHistory: AuditHistoryEntry[]
  siteAuditHistory: AuditHistoryEntry[]
  auditResultId?: string
  selectedHistoryId: string | null
  comparisonEntries: AuditHistoryEntry[]
  comparisonBaselineId?: string
  comparisonTargetId?: string
  comparisonSummary: AuditComparisonSummary | null
  comparisonTrend: ComparisonTrend | null
  onSelectHistory: (historyId: string | null) => void
  onDeleteHistoryEntry: (entry: AuditHistoryEntry) => void
  onComparisonBaselineChange: (historyId: string) => void
  onComparisonTargetChange: (historyId: string) => void
  onExportMarkdown: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onExportHistoryJson: (entry: AuditHistoryEntry) => void
  onExportHistoryCsv: (entry: AuditHistoryEntry) => void
  onExportHistorySummary: (entry: AuditHistoryEntry) => void
  onImportJson: () => void
}

function getHistoryOptionLabel(entry: AuditHistoryEntry): string {
  return t('popup.history.optionLabel', {
    date: new Date(entry.timestamp).toLocaleString('pt-BR'),
    count: entry.totalViolations,
  })
}

function getEntryPathLabel(url: string): string {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return url
  }
}

function getViolationElementLabel(violation: Violation): string {
  return (
    violation.elementAccessibleName ||
    violation.elementVisibleText ||
    violation.elementSelector ||
    violation.elementTagName ||
    t('popup.history.comparisonUnknownElement')
  )
}

function getFindingStatusLabel(status: Violation['findingStatus']): string {
  if (status === 'ignored') return t('popup.history.comparisonStatusIgnored')
  if (status === 'confirmed') return t('popup.history.comparisonStatusRegistered')
  return t('popup.history.comparisonStatusOpen')
}

function getIgnoreReasonLabel(reason?: IgnoreReason): string {
  if (!reason) return t('popup.history.comparisonEmptyValue')
  const labels: Record<IgnoreReason, string> = {
    false_positive: t('violations.ignoreReasons.falsePositive'),
    out_of_scope: t('violations.ignoreReasons.outOfScope'),
    accepted_risk: t('violations.ignoreReasons.acceptedRisk'),
    duplicate: t('violations.ignoreReasons.duplicate'),
    other: t('violations.ignoreReasons.other'),
  }
  return labels[reason]
}

function getTriageChangeLabel(change: AuditStateChange): string {
  if (change.kind === 'ignored') return t('popup.history.comparisonIgnored')
  if (change.kind === 'reopened') return t('popup.history.comparisonReopened')
  if (change.kind === 'status_updated') return t('popup.history.comparisonStatusUpdated')
  return t('popup.history.comparisonTriageUpdated')
}

function getReviewFieldLabel(field: AuditReviewChangeField): string {
  if (field === 'user_note') return t('popup.history.comparisonFieldNote')
  if (field === 'alternative_text') return t('popup.history.comparisonFieldAlternativeText')
  if (field === 'contrast') return t('popup.history.comparisonFieldContrast')
  return t('popup.history.comparisonFieldContent')
}

function formatComparisonValue(value?: string): string {
  return value?.trim() || t('popup.history.comparisonEmptyValue')
}

function getContrastValue(violation: Violation): string {
  const contrast = violation.userContrastOverride
  return contrast
    ? `${contrast.foregroundHex} / ${contrast.backgroundHex}`
    : t('popup.history.comparisonEmptyValue')
}

function ComparisonSectionHeader({ count, label }: { count: number; label: string }) {
  return (
    <div className="history-comparison-section-header">
      <strong>{count}</strong>
      <span>{label}</span>
    </div>
  )
}

function ComparisonViolationList({ violations }: { violations: Violation[] }) {
  return (
    <div className="history-comparison-change-list">
      {violations.map((violation) => (
        <div key={violation.id} className="history-comparison-change-item">
          <strong>
            NBR {violation.nbrReference} · {violation.ruleName}
          </strong>
          <span>{violation.message}</span>
          <code>{getViolationElementLabel(violation)}</code>
        </div>
      ))}
    </div>
  )
}

function ComparisonTriageList({ changes }: { changes: AuditStateChange[] }) {
  return (
    <div className="history-comparison-change-list">
      {changes.map((change) => (
        <div key={change.target.id} className="history-comparison-change-item">
          <div className="history-comparison-change-heading">
            <strong>
              NBR {change.target.nbrReference} · {change.target.ruleName}
            </strong>
            <Tag>{getTriageChangeLabel(change)}</Tag>
          </div>
          <span>
            {t('popup.history.comparisonStatusTransition', {
              from: getFindingStatusLabel(change.baseline.findingStatus),
              to: getFindingStatusLabel(change.target.findingStatus),
            })}
          </span>
          {(change.baseline.ignoreReason !== change.target.ignoreReason ||
            change.baseline.ignoreNote !== change.target.ignoreNote) && (
            <div className="history-comparison-value-grid">
              <span>
                {t('popup.history.comparisonReasonTransition', {
                  from: getIgnoreReasonLabel(change.baseline.ignoreReason),
                  to: getIgnoreReasonLabel(change.target.ignoreReason),
                })}
              </span>
              <span>
                {t('popup.history.comparisonNoteTransition', {
                  from: formatComparisonValue(change.baseline.ignoreNote),
                  to: formatComparisonValue(change.target.ignoreNote),
                })}
              </span>
            </div>
          )}
          <code>{getViolationElementLabel(change.target)}</code>
        </div>
      ))}
    </div>
  )
}

function ComparisonReviewList({ changes }: { changes: AuditReviewChange[] }) {
  return (
    <div className="history-comparison-change-list">
      {changes.map((change) => (
        <div key={change.target.id} className="history-comparison-change-item">
          <div className="history-comparison-change-heading">
            <strong>
              NBR {change.target.nbrReference} · {change.target.ruleName}
            </strong>
            <div>
              {change.changedFields.map((field) => (
                <Tag key={field}>{getReviewFieldLabel(field)}</Tag>
              ))}
            </div>
          </div>
          {change.changedFields.includes('user_note') && (
            <span>
              {t('popup.history.comparisonValueTransition', {
                label: getReviewFieldLabel('user_note'),
                from: formatComparisonValue(change.baseline.userNote),
                to: formatComparisonValue(change.target.userNote),
              })}
            </span>
          )}
          {change.changedFields.includes('alternative_text') && (
            <span>
              {t('popup.history.comparisonValueTransition', {
                label: getReviewFieldLabel('alternative_text'),
                from: formatComparisonValue(change.baseline.alternativeTextReview?.proposedText),
                to: formatComparisonValue(change.target.alternativeTextReview?.proposedText),
              })}
            </span>
          )}
          {change.changedFields.includes('contrast') && (
            <span>
              {t('popup.history.comparisonValueTransition', {
                label: getReviewFieldLabel('contrast'),
                from: getContrastValue(change.baseline),
                to: getContrastValue(change.target),
              })}
            </span>
          )}
          {change.changedFields.includes('violation_content') && (
            <span>
              {t('popup.history.comparisonValueTransition', {
                label: getReviewFieldLabel('violation_content'),
                from: change.baseline.message,
                to: change.target.message,
              })}
            </span>
          )}
          <code>{getViolationElementLabel(change.target)}</code>
        </div>
      ))}
    </div>
  )
}

function HistoryListSection({
  entries,
  sectionTitle,
  emptyDescription,
  activeTabTitle,
  auditHistory,
  auditResultId,
  selectedHistoryId,
  onSelectHistory,
  onDeleteHistoryEntry,
  onExportHistoryJson,
  onExportHistoryCsv,
  onExportHistorySummary,
  showCurrentMarkers = true,
  showEntryUrl = false,
}: {
  entries: AuditHistoryEntry[]
  sectionTitle: string
  emptyDescription: string
  activeTabTitle?: string
  auditHistory: AuditHistoryEntry[]
  auditResultId?: string
  selectedHistoryId: string | null
  onSelectHistory: (historyId: string | null) => void
  onDeleteHistoryEntry: (entry: AuditHistoryEntry) => void
  onExportHistoryJson: (entry: AuditHistoryEntry) => void
  onExportHistoryCsv: (entry: AuditHistoryEntry) => void
  onExportHistorySummary: (entry: AuditHistoryEntry) => void
  showCurrentMarkers?: boolean
  showEntryUrl?: boolean
}) {
  return (
    <div className="history-section">
      <div className="history-section-header">
        <strong>{sectionTitle}</strong>
        <span>{t('shared.counts.audits', { count: entries.length })}</span>
      </div>
      {entries.length === 0 ? (
        <Empty description={emptyDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={entries}
          renderItem={(entry) => {
            const isCurrent =
              showCurrentMarkers && !selectedHistoryId
                ? entry.id === auditHistory[0]?.id
                : entry.id === selectedHistoryId
            const pendingReviews = getPendingHumanReviewCount(entry)
            const confirmedFindings = getConfirmedFindingCount(entry)
            const ignoredFindings = getIgnoredFindingCount(entry)

            return (
              <List.Item
                className={`history-item${entry.id === selectedHistoryId ? ' is-selected' : ''}${pendingReviews > 0 ? ' is-pending' : ' is-complete'}`}
                actions={[
                  <Dropdown
                    key="download"
                    trigger={['click']}
                    menu={{
                      items: [
                        { key: 'json', label: t('shared.actions.json') },
                        { key: 'csv', label: t('shared.actions.csv') },
                        { key: 'summary', label: t('shared.actions.downloadSummary') },
                      ],
                      onClick: ({ key }) => {
                        if (key === 'json') onExportHistoryJson(entry)
                        if (key === 'csv') onExportHistoryCsv(entry)
                        if (key === 'summary') onExportHistorySummary(entry)
                      },
                    }}
                  >
                    <Button
                      key="download-button"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {t('shared.actions.download')}
                    </Button>
                  </Dropdown>,
                  <Button
                    key="view"
                    type={entry.id === selectedHistoryId ? 'primary' : 'default'}
                    size="small"
                    icon={<HistoryOutlined />}
                    disabled={
                      showCurrentMarkers && entry.id === selectedHistoryId && !auditResultId
                    }
                    onClick={() =>
                      onSelectHistory(entry.id === selectedHistoryId ? null : entry.id)
                    }
                  >
                    {entry.id === selectedHistoryId
                      ? auditResultId
                        ? t('shared.actions.viewCurrent')
                        : t('shared.actions.usingHistory')
                      : t('shared.actions.view')}
                  </Button>,
                  <Button
                    key="delete"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => onDeleteHistoryEntry(entry)}
                  >
                    {t('shared.actions.delete')}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FileSearchOutlined />}
                  title={
                    <div className="history-item-title">
                      <span>{entry.pageTitle || activeTabTitle || entry.url}</span>
                      {showEntryUrl && <Tag>{getEntryPathLabel(entry.url)}</Tag>}
                      {showCurrentMarkers &&
                        !selectedHistoryId &&
                        entry.id === auditHistory[0]?.id && (
                          <Tag color="blue">{t('shared.states.moreRecent')}</Tag>
                        )}
                      {entry.id === selectedHistoryId && (
                        <Tag color="gold">{t('shared.states.currentlyViewing')}</Tag>
                      )}
                      {isCurrent && selectedHistoryId && (
                        <Tag color="blue">{t('shared.states.currentInFocus')}</Tag>
                      )}
                      {entry.importedAt && <Tag>{t('shared.states.imported')}</Tag>}
                      <Tag color={pendingReviews > 0 ? 'gold' : 'green'}>
                        {pendingReviews > 0
                          ? t('shared.states.reviewPending')
                          : t('shared.states.reviewComplete')}
                      </Tag>
                      <Tag color={entry.includeRecommendations ? 'blue' : 'default'}>
                        {entry.includeRecommendations
                          ? t('popup.scope.withRecommendations')
                          : t('popup.scope.requirementsOnly')}
                      </Tag>
                    </div>
                  }
                  description={
                    <div className="history-item-meta">
                      <div className="history-item-meta-row">
                        <span>{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
                        <span>{t('shared.counts.items', { count: entry.totalViolations })}</span>
                      </div>
                      {showEntryUrl && <span className="history-item-url">{entry.url}</span>}
                      <div className="history-item-tag-row">
                        <Tag color="red">
                          {t('shared.counts.confirmed', { count: confirmedFindings })}
                        </Tag>
                        <Tag>{t('shared.counts.ignored', { count: ignoredFindings })}</Tag>
                        <Tag color="gold">
                          {t('shared.counts.pending', { count: pendingReviews })}
                        </Tag>
                        <Tag color="blue">
                          {t('shared.counts.annotations', {
                            count: entry.violations.filter((violation) =>
                              Boolean(violation.userNote?.trim()),
                            ).length,
                          })}
                        </Tag>
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )
          }}
        />
      )}
    </div>
  )
}

export const HistoryTabPanel: React.FC<HistoryTabPanelProps> = React.memo(
  ({
    activeTabTitle,
    auditHistory,
    siteAuditHistory,
    auditResultId,
    selectedHistoryId,
    comparisonEntries,
    comparisonBaselineId,
    comparisonTargetId,
    comparisonSummary,
    comparisonTrend,
    onSelectHistory,
    onDeleteHistoryEntry,
    onComparisonBaselineChange,
    onComparisonTargetChange,
    onExportMarkdown,
    onExportJson,
    onExportCsv,
    onExportHistoryJson,
    onExportHistoryCsv,
    onExportHistorySummary,
    onImportJson,
  }) => {
    const pendingHistoryEntries = React.useMemo(
      () => auditHistory.filter((entry) => getPendingHumanReviewCount(entry) > 0),
      [auditHistory],
    )
    const completedHistoryEntries = React.useMemo(
      () => auditHistory.filter((entry) => getPendingHumanReviewCount(entry) === 0),
      [auditHistory],
    )

    return (
      <div className="history-tab">
        <div className="history-toolbar">
          <div>
            <strong>{t('popup.history.importTitle')}</strong>
            <p>{t('popup.history.importDescription')}</p>
          </div>
          <Button icon={<UploadOutlined />} onClick={onImportJson}>
            {t('shared.actions.importJson')}
          </Button>
        </div>

        {comparisonEntries.length >= 2 && (
          <div className="history-comparison-card">
            <div className="history-comparison-header">
              <div>
                <strong>{t('popup.history.comparisonTitle')}</strong>
                <p>{t('popup.history.comparisonDescription')}</p>
              </div>
              <Space>
                {comparisonTrend && (
                  <Tag color={comparisonTrend.color}>
                    {comparisonTrend.icon} {comparisonTrend.label}
                  </Tag>
                )}
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={onExportMarkdown}
                  disabled={!comparisonSummary}
                >
                  {t('shared.actions.exportMarkdown')}
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={onExportJson}
                  disabled={!comparisonSummary}
                >
                  {t('shared.actions.json')}
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={onExportCsv}
                  disabled={!comparisonSummary}
                >
                  {t('shared.actions.csv')}
                </Button>
              </Space>
            </div>

            <div className="history-comparison-selectors">
              <div className="history-comparison-field">
                <span>{t('shared.labels.base')}</span>
                <Select
                  aria-label={t('shared.labels.base')}
                  value={comparisonBaselineId}
                  onChange={onComparisonBaselineChange}
                  options={comparisonEntries.map((entry) => ({
                    value: entry.id,
                    label: getHistoryOptionLabel(entry),
                  }))}
                />
              </div>
              <div className="history-comparison-field">
                <span>{t('shared.labels.compareWith')}</span>
                <Select
                  aria-label={t('shared.labels.compareWith')}
                  value={comparisonTargetId}
                  onChange={onComparisonTargetChange}
                  options={comparisonEntries.map((entry) => ({
                    value: entry.id,
                    label: getHistoryOptionLabel(entry),
                  }))}
                />
              </div>
            </div>

            {comparisonSummary ? (
              <div className="history-comparison-body">
                {comparisonSummary.comparisonScope.mode === 'partial' && (
                  <Alert
                    type="warning"
                    showIcon
                    message={t('popup.history.comparisonPartialScopeTitle')}
                    description={t('popup.history.comparisonPartialScopeDescription')}
                  />
                )}
                <div className="history-comparison-meta">
                  <span>
                    {t('popup.history.metadataVisible', {
                      from: comparisonSummary.baselineOpenCount,
                      to: comparisonSummary.targetOpenCount,
                    })}
                  </span>
                  <span>
                    {t('popup.history.metadataIgnored', {
                      from: comparisonSummary.baselineDismissedReviews,
                      to: comparisonSummary.targetDismissedReviews,
                    })}
                  </span>
                  <span>
                    {t('popup.history.metadataPending', {
                      from: comparisonSummary.baselinePendingReviews,
                      to: comparisonSummary.targetPendingReviews,
                    })}
                  </span>
                  <span>
                    {t('popup.history.metadataNotes', {
                      from: comparisonSummary.baselineNoteCount,
                      to: comparisonSummary.targetNoteCount,
                    })}
                  </span>
                </div>

                <Collapse
                  className="history-comparison-details"
                  items={[
                    {
                      key: 'new',
                      label: (
                        <ComparisonSectionHeader
                          count={comparisonSummary.newViolations.length}
                          label={t('popup.history.newProblems')}
                        />
                      ),
                      children: (
                        <ComparisonViolationList violations={comparisonSummary.newViolations} />
                      ),
                    },
                    {
                      key: 'not-detected',
                      label: (
                        <ComparisonSectionHeader
                          count={comparisonSummary.noLongerDetectedViolations.length}
                          label={t('popup.history.resolvedProblems')}
                        />
                      ),
                      children: (
                        <ComparisonViolationList
                          violations={comparisonSummary.noLongerDetectedViolations}
                        />
                      ),
                    },
                    {
                      key: 'persistent',
                      label: (
                        <ComparisonSectionHeader
                          count={comparisonSummary.persistentViolations.length}
                          label={t('popup.history.persistentProblems')}
                        />
                      ),
                      children: (
                        <ComparisonViolationList
                          violations={comparisonSummary.persistentViolations}
                        />
                      ),
                    },
                    {
                      key: 'triage',
                      label: (
                        <ComparisonSectionHeader
                          count={comparisonSummary.stateChangedViolations.length}
                          label={t('popup.history.stateChangedFindings')}
                        />
                      ),
                      children: (
                        <ComparisonTriageList changes={comparisonSummary.stateChangedViolations} />
                      ),
                    },
                    {
                      key: 'review',
                      label: (
                        <ComparisonSectionHeader
                          count={comparisonSummary.reviewChangedViolations.length}
                          label={t('popup.history.reviewChangedRecords')}
                        />
                      ),
                      children: (
                        <ComparisonReviewList changes={comparisonSummary.reviewChangedViolations} />
                      ),
                    },
                  ]}
                />
              </div>
            ) : (
              <Alert type="info" showIcon message={t('popup.messages.comparisonSelectInfo')} />
            )}
          </div>
        )}

        {auditHistory.length === 0 ? (
          <Empty description={t('popup.history.emptyCurrentUrl')} />
        ) : (
          <>
            <HistoryListSection
              entries={pendingHistoryEntries}
              sectionTitle={t('popup.history.sectionPending')}
              emptyDescription={t('popup.history.emptyPending')}
              activeTabTitle={activeTabTitle}
              auditHistory={auditHistory}
              auditResultId={auditResultId}
              selectedHistoryId={selectedHistoryId}
              onSelectHistory={onSelectHistory}
              onDeleteHistoryEntry={onDeleteHistoryEntry}
              onExportHistoryJson={onExportHistoryJson}
              onExportHistoryCsv={onExportHistoryCsv}
              onExportHistorySummary={onExportHistorySummary}
            />
            <HistoryListSection
              entries={completedHistoryEntries}
              sectionTitle={t('popup.history.sectionCompleted')}
              emptyDescription={t('popup.history.emptyCompleted')}
              activeTabTitle={activeTabTitle}
              auditHistory={auditHistory}
              auditResultId={auditResultId}
              selectedHistoryId={selectedHistoryId}
              onSelectHistory={onSelectHistory}
              onDeleteHistoryEntry={onDeleteHistoryEntry}
              onExportHistoryJson={onExportHistoryJson}
              onExportHistoryCsv={onExportHistoryCsv}
              onExportHistorySummary={onExportHistorySummary}
            />
          </>
        )}

        {siteAuditHistory.length > 0 && (
          <HistoryListSection
            entries={siteAuditHistory}
            sectionTitle={t('popup.history.otherPagesTitle')}
            emptyDescription={t('popup.history.otherPagesEmpty')}
            activeTabTitle={activeTabTitle}
            auditHistory={auditHistory}
            auditResultId={auditResultId}
            selectedHistoryId={selectedHistoryId}
            onSelectHistory={onSelectHistory}
            onDeleteHistoryEntry={onDeleteHistoryEntry}
            onExportHistoryJson={onExportHistoryJson}
            onExportHistoryCsv={onExportHistoryCsv}
            onExportHistorySummary={onExportHistorySummary}
            showCurrentMarkers={false}
            showEntryUrl
          />
        )}
      </div>
    )
  },
)
