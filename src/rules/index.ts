/**
 * Agregador de todas as regras de acessibilidade
 * ABNT NBR 17225:2025
 */

import { AUTOMATION_CATEGORIES, type AuditScope, type Rule } from '@/types'
import { isNormativeRequirement } from '@/normative'
import { getRuleAuditScope, getRuleVerificationMode } from '@/utils/audit-contract'
import { colorRules } from './colors'
import { controlRules } from './controls'
import { contentFormsMediaRules } from './content-forms-media'
import { structuralNavigationControlRules } from './structural-navigation-controls'
import { formRules } from './forms'
import { headingRules } from './headings'
import { imageRules } from './images'
import { keyboardRules } from './keyboard-interaction'
import { listRules } from './lists'
import { mediaRules } from './media'
import { navigationRules } from './navigation'
import { presentationRules } from './presentation'
import { regionRules } from './regions'
import { semanticRules } from './semantics'
import { tableRules } from './tables'
import { textContentRules } from './text-content'
import { timeRules } from './time'
import { remainingRecommendationRules } from './remaining-recommendations'

export const RULE_TOPIC_GROUPS = {
  keyboard: keyboardRules,
  images: imageRules,
  headings: headingRules,
  regions: regionRules,
  lists: listRules,
  tables: tableRules,
  navigation: navigationRules,
  controls: controlRules,
  forms: formRules,
  structureNavigationControls: structuralNavigationControlRules,
  contentFormsMedia: contentFormsMediaRules,
  presentation: presentationRules,
  colors: colorRules,
  textContent: textContentRules,
  semantics: semanticRules,
  media: mediaRules,
  time: timeRules,
  remainingRecommendations: remainingRecommendationRules,
} as const

export const RULE_TOPIC_CATEGORIES = [
  'keyboard',
  'images',
  'headings',
  'regions',
  'lists',
  'tables',
  'navigation',
  'controls',
  'forms',
  'presentation',
  'colors',
  'textContent',
  'semantics',
  'media',
  'time',
] as const

export type RuleTopicCategory = (typeof RULE_TOPIC_CATEGORIES)[number]

/**
 * Todas as regras de acessibilidade disponiveis
 */
export const allRules: Rule[] = [
  ...RULE_TOPIC_GROUPS.keyboard,
  ...RULE_TOPIC_GROUPS.images,
  ...RULE_TOPIC_GROUPS.headings,
  ...RULE_TOPIC_GROUPS.regions,
  ...RULE_TOPIC_GROUPS.lists,
  ...RULE_TOPIC_GROUPS.tables,
  ...RULE_TOPIC_GROUPS.navigation,
  ...RULE_TOPIC_GROUPS.controls,
  ...RULE_TOPIC_GROUPS.forms,
  ...RULE_TOPIC_GROUPS.structureNavigationControls,
  ...RULE_TOPIC_GROUPS.contentFormsMedia,
  ...RULE_TOPIC_GROUPS.presentation,
  ...RULE_TOPIC_GROUPS.colors,
  ...RULE_TOPIC_GROUPS.textContent,
  ...RULE_TOPIC_GROUPS.semantics,
  ...RULE_TOPIC_GROUPS.media,
  ...RULE_TOPIC_GROUPS.time,
  ...RULE_TOPIC_GROUPS.remainingRecommendations,
]

export function isRuleReady(rule: Rule): boolean {
  return rule.readiness !== 'not_ready'
}

export function getRunnableRules(
  includeRecommendations: boolean,
  includeHumanReview = true,
  auditScope: AuditScope = 'page',
): Rule[] {
  return allRules.filter(
    (rule) =>
      isRuleReady(rule) &&
      (includeRecommendations || isNormativeRequirement(rule.nbrReference)) &&
      (includeHumanReview || getRuleVerificationMode(rule) === 'automatic') &&
      (getRuleAuditScope(rule) === 'page' || getRuleAuditScope(rule) === auditScope),
  )
}

const ruleById = new Map(allRules.map((rule) => [rule.id, rule] as const))

/**
 * Regras por nivel WCAG
 */
export const rulesByWCAGLevel = {
  A: allRules.filter((rule) => rule.wcagLevel === 'A'),
  AA: allRules.filter((rule) => rule.wcagLevel === 'AA'),
  AAA: allRules.filter((rule) => rule.wcagLevel === 'AAA'),
}

/**
 * Regras por categoria de automacao
 */
export const rulesByAutomation = {
  [AUTOMATION_CATEGORIES.fully]: allRules.filter(
    (rule) => rule.category === AUTOMATION_CATEGORIES.fully,
  ),
  [AUTOMATION_CATEGORIES.semi]: allRules.filter(
    (rule) => rule.category === AUTOMATION_CATEGORIES.semi,
  ),
  [AUTOMATION_CATEGORIES.none]: allRules.filter(
    (rule) => rule.category === AUTOMATION_CATEGORIES.none,
  ),
}

export function getRuleTopicCategory(ruleId: string): RuleTopicCategory {
  const reference = ruleById.get(ruleId)?.nbrReference ?? ''

  if (reference.startsWith('5.1.')) return 'keyboard'
  if (reference.startsWith('5.2.')) return 'images'
  if (reference.startsWith('5.3.')) return 'headings'
  if (reference.startsWith('5.4.')) return 'regions'
  if (reference.startsWith('5.5.')) return 'lists'
  if (reference.startsWith('5.6.')) return 'tables'
  if (reference.startsWith('5.7.')) return 'navigation'
  if (reference.startsWith('5.8.')) return 'controls'
  if (reference.startsWith('5.9.')) return 'forms'
  if (reference.startsWith('5.10.')) return 'presentation'
  if (reference.startsWith('5.11.')) return 'colors'
  if (reference.startsWith('5.12.')) return 'textContent'
  if (reference.startsWith('5.13.')) return 'semantics'
  if (reference.startsWith('5.14.') || reference.startsWith('5.15.')) return 'media'
  if (reference.startsWith('5.16.')) return 'time'

  return 'semantics'
}

export {
  keyboardRules,
  imageRules,
  headingRules,
  regionRules,
  listRules,
  tableRules,
  navigationRules,
  controlRules,
  structuralNavigationControlRules,
  contentFormsMediaRules,
  formRules,
  presentationRules,
  colorRules,
  textContentRules,
  semanticRules,
  mediaRules,
  timeRules,
}
