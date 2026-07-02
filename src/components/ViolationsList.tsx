import React from 'react'
import {
  Button,
  Card,
  Collapse,
  ColorPicker,
  Empty,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  BoldOutlined,
  BgColorsOutlined,
  CheckCircleOutlined,
  ClearOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DownOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ItalicOutlined,
  LinkOutlined,
  PushpinFilled,
  SaveOutlined,
  SearchOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { PROJECT_RULES_URL } from '@/config/links'
import { t } from '@/i18n'
import { isNormativeRequirement } from '@/normative'
import { getRuleTopicCategory, type RuleTopicCategory } from '@/rules'
import type { FindingStatus, IgnoreReason, Violation } from '@/types'
import { getContrastRatio } from '@/utils'
import {
  type FindingStatusUpdate,
  isConfirmedFinding,
  isIgnoredFinding,
  isPendingHumanReviewFinding,
} from '@/utils/audit-triage'
import '../styles/violations-list.css'

export type ViolationsListMode = 'requirements' | 'recommendations' | 'review' | 'ignored'

export interface ViolationsListState {
  openGroupKey?: string
  openOccurrenceByGroup?: Record<string, string>
  selectedCategory?: 'all' | RuleTopicCategory
  selectedListMode?: ViolationsListMode
  visibleCountByGroup?: Record<string, number>
}

interface ViolationsListProps {
  violations: Violation[]
  state?: ViolationsListState
  showHumanReview?: boolean
  onSelectViolation?: (violation: Violation) => void
  onFindingStatusChange?: (violation: Violation, update: FindingStatusUpdate) => void
  onStateChange?: (state: ViolationsListState) => void
  onViolationNoteChange?: (violation: Violation, note: string) => void
  onViolationContrastOverrideChange?: (
    violation: Violation,
    override: Violation['userContrastOverride'] | undefined,
  ) => void
}

interface ViolationGroup {
  ruleId: string
  violations: Violation[]
  topIssueCount: number
  topicCategory: RuleTopicCategory
}

interface TruncatedTextProps {
  as?: keyof React.JSX.IntrinsicElements
  className?: string
  lines?: 1 | 2 | 3 | 4
  monospace?: boolean
  preserveWhitespace?: boolean
  text: string
  tooltipThreshold?: number
}

interface CopyableCodeBlockProps {
  value: string
  copyLabel: string
  successLabel: string
}

type RuleExplanationFamily =
  | 'forms'
  | 'colors'
  | 'navigation'
  | 'keyboard'
  | 'controls'
  | 'semantics'
  | 'structure'
  | 'media'
  | 'content'
  | 'time'

const { TextArea } = Input
const REVIEW_STATUS_TRANSITION_MS = 220

const severityRank: Record<Violation['severity'], number> = {
  error: 0,
  warning: 1,
}

function getSeverityColor(severity: Violation['severity']): string {
  return severity === 'error' ? 'red' : 'orange'
}

function getSeverityLabel(severity: Violation['severity']): string {
  return severity === 'error' ? t('shared.severity.error') : t('shared.severity.warning')
}

function getNormativeTypeLabel(violation: Violation): string {
  return violation.normativeType
}

function getFindingLabel(violation: Violation): string {
  if (isIgnoredFinding(violation)) return t('shared.findings.ignored')
  if (isConfirmedFinding(violation)) return t('shared.findings.confirmed')
  if (violation.findingOrigin === 'manual') return t('shared.findings.manualOpen')
  if (violation.requiresHumanReview) return t('shared.findings.needsConfirmation')
  return t('shared.findings.automaticOpen')
}

function getFindingStatusTagColor(status: FindingStatus): string {
  if (status === 'confirmed') return 'red'
  if (status === 'ignored') return 'default'
  return 'gold'
}

function getFindingActionOptions(
  currentStatus: FindingStatus,
): Array<{ icon: React.ReactNode; label: string; targetStatus: FindingStatus }> {
  if (currentStatus === 'confirmed') {
    return [
      {
        icon: <UndoOutlined />,
        label: t('violations.findingActionReopen'),
        targetStatus: 'open',
      },
      {
        icon: <CloseCircleOutlined />,
        label: t('violations.findingActionIgnore'),
        targetStatus: 'ignored',
      },
    ]
  }

  if (currentStatus === 'ignored') {
    return [
      {
        icon: <UndoOutlined />,
        label: t('violations.findingActionReopen'),
        targetStatus: 'open',
      },
      {
        icon: <CheckCircleOutlined />,
        label: t('violations.findingActionConfirm'),
        targetStatus: 'confirmed',
      },
    ]
  }

  return [
    {
      icon: <CheckCircleOutlined />,
      label: t('violations.findingActionConfirm'),
      targetStatus: 'confirmed',
    },
    {
      icon: <CloseCircleOutlined />,
      label: t('violations.findingActionIgnore'),
      targetStatus: 'ignored',
    },
  ]
}

function getFindingTransitionTitle(targetStatus: FindingStatus): string {
  if (targetStatus === 'confirmed') return t('violations.findingConfirmConfirmedTitle')
  if (targetStatus === 'ignored') return t('violations.findingConfirmIgnoredTitle')
  return t('violations.findingConfirmOpenTitle')
}

function getFindingTransitionDescription(targetStatus: FindingStatus): string {
  if (targetStatus === 'confirmed') return t('violations.findingConfirmConfirmedDescription')
  if (targetStatus === 'ignored') return t('violations.findingConfirmIgnoredDescription')
  return t('violations.findingConfirmOpenDescription')
}

function getIgnoreReasonOptions(): Array<{ label: string; value: IgnoreReason }> {
  return [
    { label: t('violations.ignoreReasons.falsePositive'), value: 'false_positive' },
    { label: t('violations.ignoreReasons.outOfScope'), value: 'out_of_scope' },
    { label: t('violations.ignoreReasons.acceptedRisk'), value: 'accepted_risk' },
    { label: t('violations.ignoreReasons.duplicate'), value: 'duplicate' },
    { label: t('violations.ignoreReasons.other'), value: 'other' },
  ]
}

function getRuleExplanationFamily(topicCategory: RuleTopicCategory): RuleExplanationFamily {
  switch (topicCategory) {
    case 'forms':
      return 'forms'
    case 'colors':
      return 'colors'
    case 'navigation':
      return 'navigation'
    case 'keyboard':
      return 'keyboard'
    case 'controls':
      return 'controls'
    case 'semantics':
      return 'semantics'
    case 'headings':
    case 'regions':
    case 'lists':
    case 'tables':
      return 'structure'
    case 'images':
    case 'media':
      return 'media'
    case 'presentation':
    case 'textContent':
      return 'content'
    case 'time':
      return 'time'
    default:
      return 'semantics'
  }
}

function getViolationTargetLabel(violation: Violation): string {
  const preferredLabel =
    violation.elementAccessibleName || violation.elementVisibleText || getElementTitle(violation)
  const normalizedLabel = preferredLabel.trim()

  if (normalizedLabel.length <= 80) return normalizedLabel
  return `${normalizedLabel.slice(0, 77).trimEnd()}...`
}

function getReadableFindingCopy(
  violation: Violation,
  topicCategory: RuleTopicCategory,
): {
  headline: string
  summary: string
} {
  const family = getRuleExplanationFamily(topicCategory)
  const target = getViolationTargetLabel(violation)
  const baseKey = `violations.families.${family}`

  return {
    headline: t(`${baseKey}.headline`),
    summary: t(`${baseKey}.summary`, { target }),
  }
}

function isVisibleInMainLists(violation: Violation): boolean {
  return !isIgnoredFinding(violation)
}

function getViolationSignature(violation: Violation): string {
  return `${violation.message}|${violation.elementSelector || violation.snippet}`
}

function sortViolations(violations: Violation[]): Violation[] {
  return [...violations].sort((left, right) => {
    const severityCompare = severityRank[left.severity] - severityRank[right.severity]
    if (severityCompare !== 0) return severityCompare

    const leftSelector = left.elementSelector || ''
    const rightSelector = right.elementSelector || ''
    return leftSelector.localeCompare(rightSelector, 'pt-BR')
  })
}

function buildGroups(violations: Violation[]): ViolationGroup[] {
  const groupedByRule = violations.reduce(
    (acc, violation) => {
      if (!acc[violation.ruleId]) {
        acc[violation.ruleId] = []
      }
      acc[violation.ruleId].push(violation)
      return acc
    },
    {} as Record<string, Violation[]>,
  )

  return Object.entries(groupedByRule)
    .map(([ruleId, ruleViolations]) => ({
      ruleId,
      violations: sortViolations(ruleViolations),
      topIssueCount: new Set(ruleViolations.slice(0, 3).map(getViolationSignature)).size,
      topicCategory: getRuleTopicCategory(ruleId),
    }))
    .sort((left, right) => {
      const leftFirst = left.violations[0]
      const rightFirst = right.violations[0]
      const severityCompare = severityRank[leftFirst.severity] - severityRank[rightFirst.severity]
      if (severityCompare !== 0) return severityCompare
      if (right.violations.length !== left.violations.length)
        return right.violations.length - left.violations.length
      return leftFirst.nbrReference.localeCompare(rightFirst.nbrReference, 'pt-BR')
    })
}

function getRuleTopicLabel(topicCategory: RuleTopicCategory): string {
  return t(`ruleTopics.${topicCategory}`)
}

function getRuleAnchorId(reference: string): string {
  const normalizedReference = reference
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `rule-${normalizedReference}`
}

function getRuleDocumentationUrl(reference: string): string {
  return `${PROJECT_RULES_URL}#${getRuleAnchorId(reference)}`
}

function getContrastPreviewText(
  context: NonNullable<Violation['contrastDetails']>['context'],
): string {
  return t(`contrast.preview.${context}`)
}

function getElementTitle(violation: Violation): string {
  const tag = violation.elementTagName || 'elemento'
  const selector = violation.elementSelector || ''
  const selectorSuffix = selector.startsWith(tag) ? selector.slice(tag.length) : selector
  return `${tag}${selectorSuffix ? ` ${selectorSuffix}` : ''}`
}

function getAffectedElementSnippet(violation: Violation): string {
  const snippet = violation.snippet?.replace(/\s+/g, ' ').trim()
  if (snippet) return snippet

  return `<${getElementTitle(violation)}>`
}

const CopyableCodeBlock: React.FC<CopyableCodeBlockProps> = React.memo(
  ({ value, copyLabel, successLabel }) => (
    <button
      type="button"
      className="violation-copyable-code"
      aria-label={copyLabel}
      title={copyLabel}
      onClick={(event) => {
        event.stopPropagation()
        void navigator.clipboard.writeText(value).then(() => {
          message.success(successLabel)
        })
      }}
    >
      <code>{value}</code>
      <CopyOutlined aria-hidden="true" />
    </button>
  ),
)

const TruncatedText: React.FC<TruncatedTextProps> = React.memo(
  ({
    as = 'span',
    className,
    lines = 2,
    monospace = false,
    preserveWhitespace = false,
    text,
    tooltipThreshold = 120,
  }) => {
    const Component = as
    const classes = [
      className,
      'violation-clamp',
      `lines-${lines}`,
      monospace ? 'is-monospace' : '',
      preserveWhitespace ? 'is-preformatted' : '',
    ]
      .filter(Boolean)
      .join(' ')

    const content = <Component className={classes}>{text}</Component>
    const shouldShowTooltip = text.trim().length > tooltipThreshold

    if (!shouldShowTooltip) return content

    return (
      <Tooltip
        placement="topLeft"
        title={
          <div
            className={`violation-tooltip-copy${preserveWhitespace ? ' is-preformatted' : ''}${monospace ? ' is-monospace' : ''}`}
          >
            {text}
          </div>
        }
      >
        {content}
      </Tooltip>
    )
  },
)

function renderViolationGroups(
  violations: Violation[],
  state: ViolationsListState | undefined,
  onStateChange: ((state: ViolationsListState) => void) | undefined,
  groupScope: string,
  onSelectViolation?: (violation: Violation) => void,
  onFindingStatusChange?: (violation: Violation, update: FindingStatusUpdate) => void,
  onViolationNoteChange?: (violation: Violation, note: string) => void,
  onViolationContrastOverrideChange?: (
    violation: Violation,
    override: Violation['userContrastOverride'] | undefined,
  ) => void,
): React.ReactNode {
  if (violations.length === 0) {
    return <Empty description={t('violations.emptyCategory')} />
  }

  const groups = buildGroups(violations)
  const topRuleIds = new Set(groups.slice(0, 3).map((group) => group.ruleId))
  const updateListState = (patch: Partial<ViolationsListState>) => {
    onStateChange?.({
      ...state,
      ...patch,
      openOccurrenceByGroup: {
        ...(state?.openOccurrenceByGroup ?? {}),
        ...(patch.openOccurrenceByGroup ?? {}),
      },
      visibleCountByGroup: {
        ...(state?.visibleCountByGroup ?? {}),
        ...(patch.visibleCountByGroup ?? {}),
      },
    })
  }
  const activeGroupKey = state?.openGroupKey?.startsWith(`${groupScope}:`)
    ? state.openGroupKey
    : undefined

  const items = groups.map((group) => {
    const firstViolation = group.violations[0]
    const groupStateKey = `${groupScope}:${group.ruleId}`
    const visibleCount = Math.min(
      group.violations.length,
      Math.max(3, state?.visibleCountByGroup?.[groupStateKey] ?? 3),
    )
    const visibleIssues = group.violations.slice(0, visibleCount)
    const remainingCount = group.violations.length - visibleIssues.length
    const openOccurrenceId = state?.openOccurrenceByGroup?.[groupStateKey]

    return {
      key: groupStateKey,
      label: (
        <div className="violation-group-header">
          <div className="violation-group-main">
            <div className="violation-group-title-row">
              <span className="violation-rule-name">{firstViolation.ruleName}</span>
              <Tag color="blue">{getRuleTopicLabel(group.topicCategory)}</Tag>
              {topRuleIds.has(group.ruleId) && (
                <Tag className="violation-top-tag" color="volcano">
                  <PushpinFilled /> {t('shared.states.priority')}
                </Tag>
              )}
            </div>
            <span className="violation-group-description">{firstViolation.description}</span>
          </div>
          <div className="violation-group-meta">
            <Tag color={isNormativeRequirement(firstViolation.nbrReference) ? 'red' : 'blue'}>
              {getNormativeTypeLabel(firstViolation)}
            </Tag>
            <Tag color={getSeverityColor(firstViolation.severity)}>
              {getSeverityLabel(firstViolation.severity)}
            </Tag>
            {firstViolation.requiresHumanReview && (
              <Tag color="gold">{t('shared.states.humanConfirmation')}</Tag>
            )}
            <Tag>{t('shared.counts.occurrences', { count: group.violations.length })}</Tag>
            <span className="violation-nbr-ref">NBR {firstViolation.nbrReference}</span>
          </div>
        </div>
      ),
      children: (
        <div className="violation-details">
          <div className="violation-top-issues">
            <div className="violation-section-header">
              <strong>{t('violations.topIssues')}</strong>
              <span>{t('shared.counts.occurrences', { count: group.violations.length })}</span>
            </div>
            <div className="violation-items">
              {visibleIssues.map((violation, index) => (
                <ViolationCard
                  key={violation.id}
                  violation={violation}
                  index={index}
                  isOpen={openOccurrenceId === violation.id}
                  onToggle={() => {
                    updateListState({
                      openGroupKey: groupStateKey,
                      openOccurrenceByGroup: {
                        [groupStateKey]: openOccurrenceId === violation.id ? '' : violation.id,
                      },
                    })
                  }}
                  onSelectViolation={onSelectViolation}
                  onFindingStatusChange={onFindingStatusChange}
                  onViolationNoteChange={onViolationNoteChange}
                  onViolationContrastOverrideChange={onViolationContrastOverrideChange}
                  pinned
                />
              ))}
            </div>
            {remainingCount > 0 && (
              <Button
                className="violation-load-more"
                type="text"
                icon={<DownOutlined className="violation-load-more-icon" />}
                onClick={() => {
                  updateListState({
                    openGroupKey: groupStateKey,
                    visibleCountByGroup: {
                      [groupStateKey]: Math.min(group.violations.length, visibleCount + 3),
                    },
                  })
                }}
              >
                {t('violations.loadMoreOccurrences', {
                  count: Math.min(3, remainingCount),
                })}
              </Button>
            )}
          </div>
        </div>
      ),
    }
  })

  return (
    <Collapse
      accordion
      activeKey={activeGroupKey}
      items={items}
      onChange={(key) => {
        const nextKey = Array.isArray(key) ? String(key[0] ?? '') : String(key)
        updateListState({ openGroupKey: nextKey || undefined })
      }}
    />
  )
}

function renderReviewSections(
  violations: Violation[],
  state: ViolationsListState | undefined,
  onStateChange: ((state: ViolationsListState) => void) | undefined,
  onSelectViolation?: (violation: Violation) => void,
  onFindingStatusChange?: (violation: Violation, update: FindingStatusUpdate) => void,
  onViolationNoteChange?: (violation: Violation, note: string) => void,
  onViolationContrastOverrideChange?: (
    violation: Violation,
    override: Violation['userContrastOverride'] | undefined,
  ) => void,
): React.ReactNode {
  if (violations.length === 0) {
    return <Empty description={t('violations.emptyCategory')} />
  }

  const pendingViolations = violations.filter(isPendingHumanReviewFinding)
  const confirmedViolations = violations.filter(isConfirmedFinding)

  const sections = [
    {
      key: 'pending',
      title: t('violations.reviewSections.pending'),
      description: t('violations.reviewSections.pendingDescription'),
      count: pendingViolations.length,
      colorClassName: 'is-pending',
      violations: pendingViolations,
    },
    {
      key: 'confirmed',
      title: t('violations.reviewSections.confirmed'),
      description: t('violations.reviewSections.confirmedDescription'),
      count: confirmedViolations.length,
      colorClassName: 'is-confirmed',
      violations: confirmedViolations,
    },
  ]

  return (
    <div className="review-sections">
      {sections.map((section) => (
        <section key={section.key} className={`review-section ${section.colorClassName}`}>
          <div className="review-section-header">
            <div>
              <strong>{section.title}</strong>
              <p>{section.description}</p>
            </div>
            <Tag>{t('shared.counts.items', { count: section.count })}</Tag>
          </div>
          {section.count > 0 ? (
            renderViolationGroups(
              section.violations,
              state,
              onStateChange,
              `review-${section.key}`,
              onSelectViolation,
              onFindingStatusChange,
              onViolationNoteChange,
              onViolationContrastOverrideChange,
            )
          ) : (
            <Empty
              description={t('violations.emptyCategory')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </section>
      ))}
    </div>
  )
}

interface ViolationCardProps {
  violation: Violation
  index: number
  isOpen: boolean
  onToggle: () => void
  onSelectViolation?: (violation: Violation) => void
  onFindingStatusChange?: (violation: Violation, update: FindingStatusUpdate) => void
  onViolationNoteChange?: (violation: Violation, note: string) => void
  onViolationContrastOverrideChange?: (
    violation: Violation,
    override: Violation['userContrastOverride'] | undefined,
  ) => void
  pinned?: boolean
}

const ViolationCard: React.FC<ViolationCardProps> = React.memo(
  ({
    violation,
    index,
    isOpen,
    onToggle,
    onSelectViolation,
    onFindingStatusChange,
    onViolationNoteChange,
    onViolationContrastOverrideChange,
    pinned = false,
  }) => {
    const [isNotesOpen, setIsNotesOpen] = React.useState(false)
    const [isContrastModalOpen, setIsContrastModalOpen] = React.useState(false)
    const [pendingFindingStatus, setPendingFindingStatus] = React.useState<FindingStatus | null>(
      null,
    )
    const [isIgnoreModalOpen, setIsIgnoreModalOpen] = React.useState(false)
    const [ignoreReason, setIgnoreReason] = React.useState<IgnoreReason | undefined>(
      violation.ignoreReason,
    )
    const [ignoreNote, setIgnoreNote] = React.useState(violation.ignoreNote || '')
    const [ignoreReasonError, setIgnoreReasonError] = React.useState(false)
    const [isApplyingFindingDecision, setIsApplyingFindingDecision] = React.useState(false)
    const [noteDraft, setNoteDraft] = React.useState(violation.userNote || '')
    const [foregroundHex, setForegroundHex] = React.useState(
      violation.userContrastOverride?.foregroundHex ||
        violation.contrastDetails?.foregroundHex ||
        '#000000',
    )
    const [backgroundHex, setBackgroundHex] = React.useState(
      violation.userContrastOverride?.backgroundHex ||
        violation.contrastDetails?.backgroundHex ||
        '#ffffff',
    )

    React.useEffect(() => {
      setNoteDraft(violation.userNote || '')
    }, [violation.id, violation.userNote])

    React.useEffect(() => {
      setForegroundHex(
        violation.userContrastOverride?.foregroundHex ||
          violation.contrastDetails?.foregroundHex ||
          '#000000',
      )
      setBackgroundHex(
        violation.userContrastOverride?.backgroundHex ||
          violation.contrastDetails?.backgroundHex ||
          '#ffffff',
      )
    }, [violation.contrastDetails, violation.id, violation.userContrastOverride])

    React.useEffect(() => {
      setPendingFindingStatus(null)
      setIsApplyingFindingDecision(false)
      setIsIgnoreModalOpen(false)
      setIgnoreReason(violation.ignoreReason)
      setIgnoreNote(violation.ignoreNote || '')
      setIgnoreReasonError(false)
    }, [violation.findingStatus, violation.id, violation.ignoreNote, violation.ignoreReason])

    const insertAtEnd = React.useCallback((value: string) => {
      setNoteDraft((current) => `${current}${current ? '\n' : ''}${value}`)
    }, [])

    const handleSaveNote = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation()
        onViolationNoteChange?.(violation, noteDraft.trim())
      },
      [noteDraft, onViolationNoteChange, violation],
    )

    const handleCardClick = React.useCallback(() => {
      if (isContrastModalOpen) return
      onSelectViolation?.(violation)
    }, [isContrastModalOpen, onSelectViolation, violation])

    const handleHeaderToggle = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        if (isContrastModalOpen) return
        onToggle()
        if (!isOpen) {
          onSelectViolation?.(violation)
        }
      },
      [isContrastModalOpen, isOpen, onSelectViolation, onToggle, violation],
    )

    const contrastRatio = React.useMemo(() => {
      if (!violation.contrastDetails) return null
      return getContrastRatio(foregroundHex, backgroundHex)
    }, [backgroundHex, foregroundHex, violation.contrastDetails])
    const persistedContrastRatio = React.useMemo(() => {
      if (!violation.contrastDetails) return null
      if (!violation.userContrastOverride) return violation.contrastDetails.measuredRatio
      return getContrastRatio(
        violation.userContrastOverride.foregroundHex,
        violation.userContrastOverride.backgroundHex,
      )
    }, [violation.contrastDetails, violation.userContrastOverride])

    const contrastPasses = React.useMemo(
      () =>
        violation.contrastDetails && contrastRatio !== null
          ? contrastRatio >= violation.contrastDetails.minimumRatio
          : false,
      [contrastRatio, violation.contrastDetails],
    )
    const hasUnsavedContrastChanges = React.useMemo(() => {
      if (!violation.contrastDetails) return false

      const referenceForeground =
        violation.userContrastOverride?.foregroundHex || violation.contrastDetails.foregroundHex
      const referenceBackground =
        violation.userContrastOverride?.backgroundHex || violation.contrastDetails.backgroundHex

      return (
        referenceForeground.toLowerCase() !== foregroundHex.toLowerCase() ||
        referenceBackground.toLowerCase() !== backgroundHex.toLowerCase()
      )
    }, [backgroundHex, foregroundHex, violation.contrastDetails, violation.userContrastOverride])

    const handleSaveContrastOverride = React.useCallback(() => {
      if (!violation.contrastDetails) return
      onViolationContrastOverrideChange?.(violation, {
        foregroundHex,
        backgroundHex,
        updatedAt: Date.now(),
      })
    }, [backgroundHex, foregroundHex, onViolationContrastOverrideChange, violation])

    const handleClearContrastOverride = React.useCallback(() => {
      if (!violation.contrastDetails) return
      setForegroundHex(violation.contrastDetails.foregroundHex)
      setBackgroundHex(violation.contrastDetails.backgroundHex)
      onViolationContrastOverrideChange?.(violation, undefined)
    }, [onViolationContrastOverrideChange, violation])
    const topicCategory = React.useMemo(
      () => getRuleTopicCategory(violation.ruleId),
      [violation.ruleId],
    )
    const readableFindingCopy = React.useMemo(
      () => getReadableFindingCopy(violation, topicCategory),
      [topicCategory, violation],
    )
    const findingActions = React.useMemo(
      () => getFindingActionOptions(violation.findingStatus),
      [violation.findingStatus],
    )
    const findingTransitionTargetStatus = pendingFindingStatus ?? violation.findingStatus
    const isFindingDecisionPending =
      pendingFindingStatus !== null && pendingFindingStatus !== violation.findingStatus

    const handleRequestFindingStatusChange = React.useCallback(
      (event: React.MouseEvent<HTMLElement>, nextStatus: FindingStatus) => {
        event.stopPropagation()
        if (isApplyingFindingDecision || nextStatus === violation.findingStatus) return

        if (nextStatus === 'ignored') {
          setIgnoreReason(violation.ignoreReason)
          setIgnoreNote(violation.ignoreNote || '')
          setIgnoreReasonError(false)
          setIsIgnoreModalOpen(true)
          return
        }

        setPendingFindingStatus(nextStatus)
      },
      [
        isApplyingFindingDecision,
        violation.findingStatus,
        violation.ignoreNote,
        violation.ignoreReason,
      ],
    )

    const handleCancelFindingStatusChange = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation()
        if (isApplyingFindingDecision) return
        setPendingFindingStatus(null)
      },
      [isApplyingFindingDecision],
    )

    const handleConfirmFindingStatusChange = React.useCallback(
      async (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation()
        if (!pendingFindingStatus || pendingFindingStatus === violation.findingStatus) return

        setIsApplyingFindingDecision(true)
        window.setTimeout(() => {
          void onFindingStatusChange?.(violation, { status: pendingFindingStatus })
        }, REVIEW_STATUS_TRANSITION_MS)
      },
      [onFindingStatusChange, pendingFindingStatus, violation],
    )

    const handleConfirmIgnore = React.useCallback(() => {
      if (!ignoreReason) {
        setIgnoreReasonError(true)
        return
      }

      setIsApplyingFindingDecision(true)
      window.setTimeout(() => {
        void onFindingStatusChange?.(violation, {
          status: 'ignored',
          ignoreReason,
          ignoreNote,
        })
      }, REVIEW_STATUS_TRANSITION_MS)
    }, [ignoreNote, ignoreReason, onFindingStatusChange, violation])

    const handleCancelIgnore = React.useCallback(() => {
      if (isApplyingFindingDecision) return
      setIsIgnoreModalOpen(false)
      setIgnoreReasonError(false)
    }, [isApplyingFindingDecision])

    const ignoreReasonOptions = React.useMemo(() => getIgnoreReasonOptions(), [])

    const statusUpdatedAtLabel = violation.findingStatusUpdatedAt
      ? new Date(violation.findingStatusUpdatedAt).toLocaleString('pt-BR')
      : null

    const triageIsEditable = Boolean(onFindingStatusChange)
    const showTriageCard =
      triageIsEditable || isIgnoredFinding(violation) || isConfirmedFinding(violation)

    const findingOriginLabel =
      violation.findingOrigin === 'manual'
        ? t('shared.findings.manualOrigin')
        : t('shared.findings.automaticOrigin')

    const ignoreReasonLabel = violation.ignoreReason
      ? (ignoreReasonOptions.find((option) => option.value === violation.ignoreReason)?.label ??
        violation.ignoreReason)
      : null

    const cardClassName = [
      'violation-item-card',
      pinned ? 'is-pinned' : '',
      `finding-state-${violation.findingStatus}`,
      isApplyingFindingDecision ? 'is-review-transitioning' : '',
      isApplyingFindingDecision
        ? `is-review-transitioning-to-${findingTransitionTargetStatus}`
        : '',
    ]
      .filter(Boolean)
      .join(' ')

    const triageControls = triageIsEditable ? (
      <div
        className="violation-human-review-controls"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <Space wrap size={8}>
          {findingActions.map((action) => (
            <Button
              key={action.targetStatus}
              icon={action.icon}
              loading={
                isApplyingFindingDecision && findingTransitionTargetStatus === action.targetStatus
              }
              size="small"
              type={
                pendingFindingStatus === action.targetStatus ||
                violation.findingStatus === action.targetStatus
                  ? 'primary'
                  : 'default'
              }
              onClick={(event) => handleRequestFindingStatusChange(event, action.targetStatus)}
            >
              {action.label}
            </Button>
          ))}
        </Space>
        {isFindingDecisionPending && (
          <div className="violation-human-review-confirmation" aria-live="polite">
            <div className="violation-human-review-confirmation-copy">
              <strong>{getFindingTransitionTitle(pendingFindingStatus)}</strong>
              <p>{getFindingTransitionDescription(pendingFindingStatus)}</p>
            </div>
            <Space wrap size={8}>
              <Button size="small" onClick={handleCancelFindingStatusChange}>
                {t('violations.reviewConfirmCancel')}
              </Button>
              <Button size="small" type="primary" onClick={handleConfirmFindingStatusChange}>
                {t('violations.reviewConfirmApply')}
              </Button>
            </Space>
          </div>
        )}
        {isApplyingFindingDecision && (
          <span className="violation-human-review-transition-note" aria-live="polite">
            {t('violations.findingTransitionApplying')}
          </span>
        )}
      </div>
    ) : null

    const triageCard = showTriageCard ? (
      <div className="violation-human-review-card">
        <strong>{t('violations.findingTriageTitle')}</strong>
        <p>{t('violations.findingTriageDescription')}</p>
        <Space wrap size={8}>
          {violation.inheritedFromHistory && <Tag color="blue">{t('shared.states.inherited')}</Tag>}
          <Tag color="blue">{findingOriginLabel}</Tag>
          <Tag color={getFindingStatusTagColor(violation.findingStatus)}>
            {getFindingLabel(violation)}
          </Tag>
          {statusUpdatedAtLabel && (
            <Tag>{t('violations.findingStatusUpdatedAt', { date: statusUpdatedAtLabel })}</Tag>
          )}
        </Space>
        {isIgnoredFinding(violation) && (
          <div className="violation-ignore-summary">
            <strong>{t('violations.ignoreSummaryTitle')}</strong>
            {ignoreReasonLabel && <span>{ignoreReasonLabel}</span>}
            {violation.ignoreNote && <p>{violation.ignoreNote}</p>}
          </div>
        )}
        {triageControls}
      </div>
    ) : null

    return (
      <Card size="small" className={cardClassName} onClick={handleCardClick}>
        <button
          className="violation-item-header"
          type="button"
          aria-expanded={isOpen}
          onClick={handleHeaderToggle}
        >
          <span className="violation-item-number">#{index + 1}</span>
          <span className="violation-item-heading">
            <TruncatedText
              className="violation-item-message"
              lines={2}
              text={readableFindingCopy.headline}
              tooltipThreshold={120}
            />
            <TruncatedText
              className="violation-item-summary"
              lines={2}
              text={readableFindingCopy.summary}
              tooltipThreshold={140}
            />
            <span className="violation-item-reference">
              NBR {violation.nbrReference} - WCAG {violation.wcagLevel}
            </span>
          </span>
          <DownOutlined
            className={`violation-item-toggle-icon${isOpen ? ' is-open' : ''}`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <div className="violation-item-content">
            {triageCard}

            <div className="violation-element-card">
              <strong>{t('shared.labels.affectedElement')}</strong>
              <CopyableCodeBlock
                value={getAffectedElementSnippet(violation)}
                copyLabel={t('violations.copyElementHtml')}
                successLabel={t('violations.copyElementHtmlSuccess')}
              />

              <div className="violation-element-fields">
                {violation.elementAccessibleName && (
                  <div className="violation-element-field">
                    <span className="violation-element-field-label">
                      {t('shared.labels.accessibleName')}
                    </span>
                    <TruncatedText
                      className="violation-element-field-value"
                      lines={2}
                      text={violation.elementAccessibleName}
                      tooltipThreshold={100}
                    />
                  </div>
                )}

                {violation.elementVisibleText && (
                  <div className="violation-element-field">
                    <span className="violation-element-field-label">
                      {t('shared.labels.visibleText')}
                    </span>
                    <TruncatedText
                      className="violation-element-field-value"
                      lines={2}
                      text={violation.elementVisibleText}
                      tooltipThreshold={100}
                    />
                  </div>
                )}

                {violation.elementSelector && (
                  <div className="violation-element-field">
                    <span className="violation-element-field-label">
                      {t('shared.labels.selector')}
                    </span>
                    <CopyableCodeBlock
                      value={violation.elementSelector}
                      copyLabel={t('violations.copySelector')}
                      successLabel={t('violations.copySelectorSuccess')}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="violation-detected-signal">
              <strong>{t('violations.detectedSignal')}</strong>
              <TruncatedText
                as="p"
                className="violation-detected-signal-copy"
                lines={3}
                text={violation.message}
                tooltipThreshold={160}
              />
            </div>

            <div className="violation-suggestion">
              <strong>{t('shared.labels.suggestion')}</strong>
              <TruncatedText
                as="p"
                className="violation-suggestion-copy"
                lines={3}
                text={violation.suggestion}
                tooltipThreshold={150}
              />
            </div>

            <div className="violation-remediation">
              <strong>{t('shared.labels.howToFix')}</strong>
              <pre>
                <TruncatedText
                  as="code"
                  className="violation-remediation-code"
                  lines={4}
                  monospace
                  preserveWhitespace
                  text={violation.remediationAdvice}
                  tooltipThreshold={180}
                />
              </pre>
            </div>

            {violation.contrastDetails && (
              <div className="violation-contrast-helper">
                <div className="violation-contrast-helper-copy">
                  <strong>{t('violations.contrastBoardTitle')}</strong>
                  <p>{t('violations.contrastBoardDescription')}</p>
                  <span>
                    {t('violations.contrastRatio')}:{' '}
                    {(persistedContrastRatio ?? violation.contrastDetails.measuredRatio).toFixed(2)}
                    :1
                    {' · '}
                    {t('violations.contrastMinimum')}:{' '}
                    {violation.contrastDetails.minimumRatio.toFixed(1)}:1
                  </span>
                  {violation.userContrastOverride && (
                    <Tag color="blue">{t('violations.contrastUserOverrideSaved')}</Tag>
                  )}
                </div>
                <Button
                  icon={<BgColorsOutlined />}
                  onClick={(event) => {
                    event.stopPropagation()
                    setIsContrastModalOpen(true)
                  }}
                >
                  {t('violations.contrastBoard')}
                </Button>
              </div>
            )}

            <Space className="violation-actions">
              <Button
                size="small"
                icon={<InfoCircleOutlined />}
                href={getRuleDocumentationUrl(violation.nbrReference)}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                {t('shared.actions.ruleDetails')}
              </Button>
              {violation.contrastDetails && (
                <Tooltip title={t('violations.contrastBoard')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<BgColorsOutlined />}
                    onClick={(event) => {
                      event.stopPropagation()
                      setIsContrastModalOpen(true)
                    }}
                  />
                </Tooltip>
              )}
              <Tooltip title={t('violations.notesTooltip')}>
                <Button
                  type={violation.userNote ? 'default' : 'text'}
                  size="small"
                  icon={<FileTextOutlined />}
                  onClick={(event) => {
                    event.stopPropagation()
                    setIsNotesOpen((current) => !current)
                  }}
                />
              </Tooltip>
              <Tooltip title={t('violations.goToElement')}>
                <Button
                  type="text"
                  size="small"
                  icon={<LinkOutlined />}
                  disabled={!onSelectViolation}
                  onClick={(event) => {
                    event.stopPropagation()
                    onSelectViolation?.(violation)
                  }}
                />
              </Tooltip>
              <span className="violation-wcag-level">
                <InfoCircleOutlined /> {getNormativeTypeLabel(violation)} ·{' '}
                {getSeverityLabel(violation.severity)}
              </span>
              <span className="violation-review-state">
                <SearchOutlined /> {getFindingLabel(violation)}
              </span>
            </Space>

            {isNotesOpen && (
              <div className="violation-notes-card" onClick={(event) => event.stopPropagation()}>
                <div className="violation-notes-header">
                  <strong>{t('shared.labels.annotations')}</strong>
                  <span>{t('violations.notesLength', { count: noteDraft.length })}</span>
                </div>

                <Space className="violation-notes-toolbar" wrap>
                  <Tooltip title={t('violations.insertBold')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<BoldOutlined />}
                      onClick={(event) => {
                        event.stopPropagation()
                        insertAtEnd('**texto**')
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t('violations.insertItalic')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ItalicOutlined />}
                      onClick={(event) => {
                        event.stopPropagation()
                        insertAtEnd('*texto*')
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t('violations.insertList')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<UnorderedListOutlined />}
                      onClick={(event) => {
                        event.stopPropagation()
                        insertAtEnd('- item')
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t('violations.clearDraft')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ClearOutlined />}
                      onClick={(event) => {
                        event.stopPropagation()
                        setNoteDraft('')
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t('violations.saveNote')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<SaveOutlined />}
                      onClick={handleSaveNote}
                    />
                  </Tooltip>
                </Space>

                <TextArea
                  rows={4}
                  maxLength={600}
                  placeholder={t('violations.notePlaceholder')}
                  value={noteDraft}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => setNoteDraft(event.target.value)}
                />

                {violation.noteUpdatedAt && (
                  <span className="violation-notes-meta">
                    {t('violations.noteUpdatedAt', {
                      date: new Date(violation.noteUpdatedAt).toLocaleString('pt-BR'),
                    })}
                  </span>
                )}
              </div>
            )}

            <Modal
              open={isIgnoreModalOpen}
              title={t('violations.ignoreModalTitle')}
              okText={t('violations.ignoreModalConfirm')}
              cancelText={t('violations.reviewConfirmCancel')}
              okButtonProps={{
                disabled: isApplyingFindingDecision,
                loading: isApplyingFindingDecision,
              }}
              onCancel={handleCancelIgnore}
              onOk={handleConfirmIgnore}
              destroyOnHidden
              focusTriggerAfterClose={false}
              maskClosable={false}
              centered
            >
              <div
                className="violation-ignore-modal"
                onClick={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <p>{t('violations.ignoreModalDescription')}</p>
                <label className="violation-ignore-field">
                  <span>{t('violations.ignoreReasonLabel')}</span>
                  <Select
                    status={ignoreReasonError ? 'error' : undefined}
                    placeholder={t('violations.ignoreReasonPlaceholder')}
                    value={ignoreReason}
                    options={ignoreReasonOptions}
                    onChange={(value) => {
                      setIgnoreReason(value)
                      setIgnoreReasonError(false)
                    }}
                  />
                  {ignoreReasonError && (
                    <span className="violation-ignore-field-error">
                      {t('violations.ignoreReasonRequired')}
                    </span>
                  )}
                </label>
                <label className="violation-ignore-field">
                  <span>{t('violations.ignoreNoteLabel')}</span>
                  <TextArea
                    rows={3}
                    maxLength={400}
                    placeholder={t('violations.ignoreNotePlaceholder')}
                    value={ignoreNote}
                    onChange={(event) => setIgnoreNote(event.target.value)}
                  />
                </label>
              </div>
            </Modal>

            {violation.contrastDetails && (
              <Modal
                open={isContrastModalOpen}
                title={t('violations.contrastBoardTitle')}
                footer={null}
                onCancel={() => setIsContrastModalOpen(false)}
                width={400}
                className="contrast-board-modal"
                destroyOnHidden
                focusTriggerAfterClose={false}
                maskClosable={false}
                centered
              >
                <div
                  className="contrast-board"
                  onClick={(event) => event.stopPropagation()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <p className="contrast-board-description">
                    {t('violations.contrastBoardDescription')}
                  </p>

                  <div className="contrast-board-grid">
                    <label className="contrast-board-field">
                      <span>
                        {violation.contrastDetails.foregroundLabel || t('contrast.foreground.text')}
                      </span>
                      <div className="contrast-board-picker-row">
                        <ColorPicker
                          value={foregroundHex}
                          onChange={(value) => setForegroundHex(value.toHexString())}
                        />
                        <code>{foregroundHex}</code>
                      </div>
                    </label>

                    <label className="contrast-board-field">
                      <span>
                        {violation.contrastDetails.backgroundLabel ||
                          t('contrast.background.surface')}
                      </span>
                      <div className="contrast-board-picker-row">
                        <ColorPicker
                          value={backgroundHex}
                          onChange={(value) => setBackgroundHex(value.toHexString())}
                        />
                        <code>{backgroundHex}</code>
                      </div>
                    </label>
                  </div>

                  <div className="contrast-board-metrics">
                    <div className="contrast-board-metric">
                      <span>{t('violations.contrastRatio')}</span>
                      <strong>{contrastRatio?.toFixed(2)}:1</strong>
                    </div>
                    <div className="contrast-board-metric">
                      <span>{t('violations.contrastMinimum')}</span>
                      <strong>{violation.contrastDetails.minimumRatio.toFixed(1)}:1</strong>
                    </div>
                    <Tag color={contrastPasses ? 'green' : 'red'}>
                      {contrastPasses
                        ? t('violations.contrastCurrentStatusPass')
                        : t('violations.contrastCurrentStatusFail')}
                    </Tag>
                  </div>

                  <div className="contrast-board-preview-wrap">
                    <span className="contrast-board-preview-label">
                      {t('violations.contrastPreview')}
                    </span>
                    <div
                      className={`contrast-board-preview is-${violation.contrastDetails.context}`}
                      style={{
                        backgroundColor: backgroundHex,
                        color: foregroundHex,
                        borderColor: foregroundHex,
                      }}
                    >
                      <span>{getContrastPreviewText(violation.contrastDetails.context)}</span>
                    </div>
                  </div>

                  {violation.contrastDetails.comparisonHex && (
                    <div className="contrast-board-comparison">
                      <span>{t('violations.contrastComparison')}</span>
                      <div className="contrast-board-comparison-row">
                        <div
                          className="contrast-board-comparison-swatch"
                          style={{ backgroundColor: violation.contrastDetails.comparisonHex }}
                        />
                        <strong>
                          {violation.contrastDetails.comparisonLabel ||
                            t('contrast.background.adjacent')}
                        </strong>
                        <code>{violation.contrastDetails.comparisonHex}</code>
                      </div>
                    </div>
                  )}

                  <div className="contrast-board-actions">
                    <div className="contrast-board-actions-copy">
                      {violation.userContrastOverride ? (
                        <span>
                          {t('violations.contrastSavedAt', {
                            date: new Date(violation.userContrastOverride.updatedAt).toLocaleString(
                              'pt-BR',
                            ),
                          })}
                        </span>
                      ) : (
                        <span>{t('violations.contrastOriginalPageValues')}</span>
                      )}
                    </div>
                    <Space wrap>
                      <Tooltip title={t('violations.contrastResetTooltip')}>
                        <Button
                          icon={<ClearOutlined />}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleClearContrastOverride()
                          }}
                        >
                          {t('violations.contrastReset')}
                        </Button>
                      </Tooltip>
                      <Tooltip title={t('violations.contrastSaveCorrectionTooltip')}>
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          disabled={!hasUnsavedContrastChanges}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleSaveContrastOverride()
                          }}
                        >
                          {t('violations.contrastSaveCorrection')}
                        </Button>
                      </Tooltip>
                    </Space>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}
      </Card>
    )
  },
)

export const ViolationsList: React.FC<ViolationsListProps> = React.memo(
  ({
    violations,
    state,
    showHumanReview = true,
    onSelectViolation,
    onFindingStatusChange,
    onStateChange,
    onViolationNoteChange,
    onViolationContrastOverrideChange,
  }) => {
    const [selectedCategory, setSelectedCategory] = React.useState<'all' | RuleTopicCategory>(
      state?.selectedCategory ?? 'all',
    )
    const [selectedListMode, setSelectedListMode] = React.useState<ViolationsListMode>(
      state?.selectedListMode ?? 'requirements',
    )
    const sortedViolations = React.useMemo(() => sortViolations(violations), [violations])
    const visibleViolations = React.useMemo(
      () => sortedViolations.filter(isVisibleInMainLists),
      [sortedViolations],
    )
    const requirementViolations = React.useMemo(
      () => visibleViolations.filter((violation) => isNormativeRequirement(violation.nbrReference)),
      [visibleViolations],
    )
    const recommendationViolations = React.useMemo(
      () =>
        visibleViolations.filter((violation) => !isNormativeRequirement(violation.nbrReference)),
      [visibleViolations],
    )
    const reviewViolations = React.useMemo(
      () =>
        sortedViolations.filter(
          (violation) => violation.requiresHumanReview && !isIgnoredFinding(violation),
        ),
      [sortedViolations],
    )
    const ignoredViolations = React.useMemo(
      () => sortedViolations.filter(isIgnoredFinding),
      [sortedViolations],
    )
    const availableCategories = React.useMemo(() => {
      const categories = new Set<RuleTopicCategory>()
      sortedViolations.forEach((violation) => {
        categories.add(getRuleTopicCategory(violation.ruleId))
      })
      return Array.from(categories).sort((left, right) =>
        getRuleTopicLabel(left).localeCompare(getRuleTopicLabel(right), 'pt-BR'),
      )
    }, [sortedViolations])

    const filterByCategory = React.useCallback(
      (inputViolations: Violation[]) =>
        selectedCategory === 'all'
          ? inputViolations
          : inputViolations.filter(
              (violation) => getRuleTopicCategory(violation.ruleId) === selectedCategory,
            ),
      [selectedCategory],
    )

    const filteredRequirementViolations = React.useMemo(
      () => filterByCategory(requirementViolations),
      [filterByCategory, requirementViolations],
    )
    const filteredRecommendationViolations = React.useMemo(
      () => filterByCategory(recommendationViolations),
      [filterByCategory, recommendationViolations],
    )
    const filteredReviewViolations = React.useMemo(
      () => filterByCategory(reviewViolations),
      [filterByCategory, reviewViolations],
    )
    const filteredIgnoredViolations = React.useMemo(
      () => filterByCategory(ignoredViolations),
      [filterByCategory, ignoredViolations],
    )
    const modeOptions = React.useMemo<Array<{ label: string; value: ViolationsListMode }>>(() => {
      const options: Array<{ label: string; value: ViolationsListMode }> = [
        {
          label: t('violations.tabRequirements', {
            count: filteredRequirementViolations.length,
          }),
          value: 'requirements',
        },
        {
          label: t('violations.tabRecommendations', {
            count: filteredRecommendationViolations.length,
          }),
          value: 'recommendations',
        },
      ]

      if (showHumanReview) {
        options.push({
          label: t('violations.tabReview', { count: filteredReviewViolations.length }),
          value: 'review',
        })
      }

      options.push({
        label: t('violations.tabIgnored', { count: filteredIgnoredViolations.length }),
        value: 'ignored',
      })

      return options
    }, [
      filteredIgnoredViolations.length,
      filteredRecommendationViolations.length,
      filteredRequirementViolations.length,
      filteredReviewViolations.length,
      showHumanReview,
    ])
    const effectiveSelectedListMode =
      !showHumanReview && selectedListMode === 'review' ? 'requirements' : selectedListMode
    const listState = React.useMemo<ViolationsListState>(
      () => ({
        ...state,
        selectedCategory,
        selectedListMode,
      }),
      [selectedCategory, selectedListMode, state],
    )
    const updateListState = React.useCallback(
      (patch: Partial<ViolationsListState>) => {
        onStateChange?.({
          ...listState,
          ...patch,
          openOccurrenceByGroup: {
            ...(listState.openOccurrenceByGroup ?? {}),
            ...(patch.openOccurrenceByGroup ?? {}),
          },
          visibleCountByGroup: {
            ...(listState.visibleCountByGroup ?? {}),
            ...(patch.visibleCountByGroup ?? {}),
          },
        })
      },
      [listState, onStateChange],
    )

    React.useEffect(() => {
      setSelectedCategory(state?.selectedCategory ?? 'all')
      setSelectedListMode(
        !showHumanReview && state?.selectedListMode === 'review'
          ? 'requirements'
          : (state?.selectedListMode ?? 'requirements'),
      )
    }, [showHumanReview, state?.selectedCategory, state?.selectedListMode])

    const listContent = React.useMemo(() => {
      if (effectiveSelectedListMode === 'recommendations') {
        return renderViolationGroups(
          filteredRecommendationViolations,
          listState,
          updateListState,
          'recommendations',
          onSelectViolation,
          onFindingStatusChange,
          onViolationNoteChange,
          onViolationContrastOverrideChange,
        )
      }

      if (effectiveSelectedListMode === 'ignored') {
        return renderViolationGroups(
          filteredIgnoredViolations,
          listState,
          updateListState,
          'ignored',
          onSelectViolation,
          onFindingStatusChange,
          onViolationNoteChange,
          onViolationContrastOverrideChange,
        )
      }

      if (showHumanReview && effectiveSelectedListMode === 'review') {
        return renderReviewSections(
          filteredReviewViolations,
          listState,
          updateListState,
          onSelectViolation,
          onFindingStatusChange,
          onViolationNoteChange,
          onViolationContrastOverrideChange,
        )
      }

      return renderViolationGroups(
        filteredRequirementViolations,
        listState,
        updateListState,
        'requirements',
        onSelectViolation,
        onFindingStatusChange,
        onViolationNoteChange,
        onViolationContrastOverrideChange,
      )
    }, [
      filteredIgnoredViolations,
      filteredRecommendationViolations,
      filteredRequirementViolations,
      filteredReviewViolations,
      listState,
      onFindingStatusChange,
      onSelectViolation,
      updateListState,
      onViolationContrastOverrideChange,
      onViolationNoteChange,
      effectiveSelectedListMode,
      showHumanReview,
    ])

    if (!violations || violations.length === 0) {
      return <Empty description={t('violations.emptyAll')} />
    }

    return (
      <div className="violations-list">
        <div className="violations-toolbar">
          <div className="violations-toolbar-copy">
            <strong>{t('violations.categoryFilterLabel')}</strong>
            <span>{t('violations.categoryFilterDescription')}</span>
          </div>
          <Select
            className="violations-category-select"
            value={selectedCategory}
            onChange={(value) => {
              setSelectedCategory(value)
              updateListState({ openGroupKey: undefined, selectedCategory: value })
            }}
            options={[
              { value: 'all', label: t('violations.categoryAll') },
              ...availableCategories.map((category) => ({
                value: category,
                label: getRuleTopicLabel(category),
              })),
            ]}
          />
        </div>
        <Segmented
          className="violations-mode-segmented"
          block
          options={modeOptions}
          value={effectiveSelectedListMode}
          onChange={(value) => {
            const nextMode = value as ViolationsListMode
            setSelectedListMode(nextMode)
            updateListState({ openGroupKey: undefined, selectedListMode: nextMode })
          }}
        />
        <div className="violations-mode-content">{listContent}</div>
      </div>
    )
  },
)
