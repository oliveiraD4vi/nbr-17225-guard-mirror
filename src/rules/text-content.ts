import { t } from '@/i18n'
import type { Rule, Violation } from '@/types'
import { createViolation, getVisibleText, isElementVisible } from '@/utils'

const commonUppercaseTerms = new Set([
  'ABNT',
  'API',
  'CEP',
  'CPF',
  'CNPJ',
  'CSV',
  'CSS',
  'DOM',
  'FAQ',
  'HTML',
  'HTTP',
  'HTTPS',
  'ID',
  'JSON',
  'LGPD',
  'NBR',
  'PDF',
  'RG',
  'SAAS',
  'SEO',
  'UI',
  'URI',
  'URL',
  'UX',
  'WCAG',
  'XML',
])

export const specialTextSemanticRule: Rule = {
  id: 'special-text-semantic',
  nbrReference: '5.12.8',
  name: t('rules.textContent.specialTextSemantic.name'),
  description: t('rules.textContent.specialTextSemantic.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLElement>('b, i').forEach((element) => {
      if (!isElementVisible(element)) return
      const text = getVisibleText(element)
      if (!text) return

      violations.push(
        createViolation(specialTextSemanticRule, {
          element,
          message: t('rules.textContent.specialTextSemantic.message', {
            tagName: element.tagName.toLowerCase(),
          }),
          suggestion: t('rules.textContent.specialTextSemantic.suggestion'),
          remediationAdvice: t('rules.textContent.specialTextSemantic.remediation', { text }),
          customIdPrefix: 'special-text',
        }),
      )
    })

    return violations
  },
}

export const specialTextUsageRule: Rule = {
  id: 'special-text-usage',
  nbrReference: '5.12.9',
  name: t('rules.textContent.specialTextUsage.name'),
  description: t('rules.textContent.specialTextUsage.description'),
  severity: 'warning',
  wcagLevel: 'A',
  auditScope: 'page',
  verificationMode: 'manual',
  category: 'Não Automatizável',
  check: async (): Promise<Violation[]> => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('strong, em, abbr, cite, mark, b, i'),
    ).filter((element) => isElementVisible(element) && getVisibleText(element).trim())

    if (!candidates.length) return []

    return [
      createViolation(specialTextUsageRule, {
        element: candidates[0],
        message: t('rules.textContent.specialTextUsage.message'),
        suggestion: t('rules.textContent.specialTextUsage.suggestion'),
        remediationAdvice: t('rules.textContent.specialTextUsage.remediation'),
        customIdPrefix: 'special-text-usage',
      }),
    ]
  },
}

export const textAlignmentRule: Rule = {
  id: 'text-alignment',
  nbrReference: '5.12.5',
  name: t('rules.textContent.textAlignment.name'),
  description: t('rules.textContent.textAlignment.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<HTMLElement>('p, li, dd, blockquote, article, section')
      .forEach((element) => {
        if (!isElementVisible(element)) return
        const text = getVisibleText(element)
        if (text.length < 120) return
        const style = window.getComputedStyle(element)

        if (style.textAlign === 'justify') {
          violations.push(
            createViolation(textAlignmentRule, {
              element,
              message: t('rules.textContent.textAlignment.message'),
              suggestion: t('rules.textContent.textAlignment.suggestion'),
              remediationAdvice: t('rules.textContent.textAlignment.remediation'),
              customIdPrefix: 'text-alignment',
            }),
          )
        }
      })

    return violations
  },
}

export const abbreviationMeaningRule: Rule = {
  id: 'abbreviation-meaning',
  nbrReference: '5.12.11',
  name: t('rules.textContent.abbreviationMeaning.name'),
  description: t('rules.textContent.abbreviationMeaning.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []
    const knownAbbreviations = new Set<string>()
    const reportedAbbreviations = new Set<string>()

    document.querySelectorAll<HTMLElement>('abbr[title], acronym[title]').forEach((element) => {
      const text = getVisibleText(element).trim().toUpperCase()
      if (text) knownAbbreviations.add(text)
    })

    document.querySelectorAll<HTMLElement>('p, li, td, th, dd, blockquote').forEach((element) => {
      if (!isElementVisible(element)) return
      const text = getVisibleText(element)
      if (text.length < 24) return
      const matches = [...text.matchAll(/\b\p{Lu}{2,6}\b/gu)]
        .map((match) => match[0].toUpperCase())
        .filter(
          (token) =>
            !knownAbbreviations.has(token) &&
            !commonUppercaseTerms.has(token) &&
            !reportedAbbreviations.has(token),
        )
      const uniqueMatches = [...new Set(matches)]

      if (uniqueMatches.length >= 2) {
        uniqueMatches.forEach((term) => reportedAbbreviations.add(term))
        violations.push(
          createViolation(abbreviationMeaningRule, {
            element,
            message: t('rules.textContent.abbreviationMeaning.message', {
              terms: uniqueMatches.slice(0, 3).join(', '),
            }),
            suggestion: t('rules.textContent.abbreviationMeaning.suggestion'),
            remediationAdvice: t('rules.textContent.abbreviationMeaning.remediation'),
            customIdPrefix: 'abbreviation-meaning',
          }),
        )
      }
    })

    return violations
  },
}

export const textContentRules: Rule[] = [
  textAlignmentRule,
  specialTextSemanticRule,
  specialTextUsageRule,
  abbreviationMeaningRule,
]
