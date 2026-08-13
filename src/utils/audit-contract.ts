import {
  AUTOMATION_CATEGORIES,
  type AuditScope,
  type AutomationCategory,
  type FindingConfidence,
  type Rule,
  type VerificationMode,
  type Violation,
} from '@/types'

const siteScopeReferences = new Set(['5.7.13', '5.7.15', '5.7.16', '5.8.5'])
const journeyScopeReferences = new Set(['5.9.12', '5.9.15'])

export function getAuditScopeForReference(reference: string): AuditScope {
  if (siteScopeReferences.has(reference)) return 'site'
  if (journeyScopeReferences.has(reference)) return 'journey'
  return 'page'
}

export function getVerificationModeFromCategory(category: AutomationCategory): VerificationMode {
  if (category === AUTOMATION_CATEGORIES.fully) return 'automatic'
  if (category === AUTOMATION_CATEGORIES.semi) return 'assisted'
  return 'manual'
}

export function getRuleVerificationMode(
  rule: Pick<Rule, 'category' | 'verificationMode'>,
): VerificationMode {
  return rule.verificationMode ?? getVerificationModeFromCategory(rule.category)
}

export function getRuleAuditScope(rule: Pick<Rule, 'nbrReference' | 'auditScope'>): AuditScope {
  return rule.auditScope ?? getAuditScopeForReference(rule.nbrReference)
}

export function getFindingConfidence(mode: VerificationMode): FindingConfidence {
  if (mode === 'automatic') return 'high'
  if (mode === 'assisted') return 'medium'
  return 'contextual'
}

export function getDefaultReviewQuestion(mode: VerificationMode): string | undefined {
  if (mode === 'automatic') return undefined
  if (mode === 'assisted') {
    return 'A evidência observada confirma o problema neste contexto?'
  }
  return 'A verificação manual confirma que o requisito não foi atendido?'
}

export function getViolationVerificationMode(
  violation: Pick<Violation, 'automationCategory' | 'verificationMode'>,
): VerificationMode {
  return violation.verificationMode ?? getVerificationModeFromCategory(violation.automationCategory)
}
