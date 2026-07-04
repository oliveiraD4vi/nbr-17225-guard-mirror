import { t } from '@/i18n'
import type { Rule, Violation } from '@/types'
import {
  createViolation,
  getAccessibleName,
  getAssociatedDescriptionText,
  getAssociatedLabelText,
  getContrastRatio,
  getEffectiveBackgroundColor,
  getElementIdAttribute,
  getElementLanguage,
  getFocusableElements,
  getVisibleText,
  isElementVisible,
  rgbToHex,
} from '@/utils'

function createWarnings(
  rule: Rule,
  elements: HTMLElement[],
  messageFactory: (element: HTMLElement) => string,
  suggestion: string,
  remediationAdvice: string,
  customIdPrefix: string,
  requiresHumanReview?: boolean,
): Violation[] {
  return elements.map((element) =>
    createViolation(rule, {
      element,
      message: messageFactory(element),
      suggestion,
      remediationAdvice,
      customIdPrefix,
      requiresHumanReview,
    }),
  )
}

const formFieldsSelector =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'
const interactiveSelector =
  'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [tabindex]'
const vagueLabels = ['campo', 'valor', 'digite', 'info', 'informacao', 'informação', 'texto']

function isPaintColor(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return (
    Boolean(normalized) &&
    normalized !== 'none' &&
    normalized !== 'transparent' &&
    !normalized.endsWith(', 0)')
  )
}

function getActiveFocusableElement(): HTMLElement | null {
  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null

  if (!activeElement || !isElementVisible(activeElement)) return null
  return getFocusableElements().includes(activeElement) ? activeElement : null
}

function hasRestrictiveOrientationStyles(): boolean {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList

    try {
      rules = sheet.cssRules
    } catch {
      continue
    }

    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSMediaRule)) continue

      const mediaText = rule.media.mediaText.toLowerCase()
      if (!mediaText.includes('orientation')) continue

      for (const nestedRule of Array.from(rule.cssRules)) {
        if (!(nestedRule instanceof CSSStyleRule)) continue

        const selector = nestedRule.selectorText.toLowerCase()
        const targetsMainLayout = /(body|html|main|#app|#root|\.app|\.main)/.test(selector)
        const hidesLayout =
          nestedRule.style.display === 'none' ||
          nestedRule.style.visibility === 'hidden' ||
          nestedRule.style.pointerEvents === 'none'

        if (targetsMainLayout && hidesLayout) {
          return true
        }
      }
    }
  }

  return false
}

function looksLikeForeignLanguageBlock(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (normalized.length < 32) return false

  const englishSignals = [
    'privacy policy',
    'terms of service',
    'sign in',
    'sign up',
    'create account',
    'checkout',
    'shipping',
    'download now',
  ]
  const englishStopwords = [' the ', ' and ', ' for ', ' with ', ' your ', ' from ']

  const signalCount = englishSignals.filter((signal) => normalized.includes(signal)).length
  const stopwordCount = englishStopwords.filter((word) => ` ${normalized} `.includes(word)).length

  return signalCount >= 1 || stopwordCount >= 3
}

export const predictableFieldLabelRule: Rule = {
  id: 'predictable-field-label',
  nbrReference: '5.9.2',
  name: t('rules.contentFormsMedia.predictableFieldLabel.name'),
  description: t('rules.contentFormsMedia.predictableFieldLabel.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const labelsByAutocomplete = new Map<string, Set<string>>()

    document
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(formFieldsSelector)
      .forEach((field) => {
        const key = (
          field.getAttribute('autocomplete') ||
          field.name ||
          getElementIdAttribute(field)
        )
          .trim()
          .toLowerCase()
        const label = getAssociatedLabelText(field).trim().toLowerCase()
        if (!key || !label) return
        if (!labelsByAutocomplete.has(key)) labelsByAutocomplete.set(key, new Set())
        labelsByAutocomplete.get(key)?.add(label)
      })

    const inconsistent = Array.from(labelsByAutocomplete.entries()).find(
      ([, labels]) => labels.size > 1,
    )
    return inconsistent
      ? [
          createViolation(predictableFieldLabelRule, {
            element: document.body,
            message: t('rules.contentFormsMedia.predictableFieldLabel.message', {
              field: inconsistent[0],
            }),
            suggestion: t('rules.contentFormsMedia.predictableFieldLabel.suggestion'),
            remediationAdvice: t('rules.contentFormsMedia.predictableFieldLabel.remediation'),
            customIdPrefix: 'predictable-label',
          }),
        ]
      : []
  },
}

export const descriptiveFieldLabelRule: Rule = {
  id: 'descriptive-field-label',
  nbrReference: '5.9.4',
  name: t('rules.contentFormsMedia.descriptiveFieldLabel.name'),
  description: t('rules.contentFormsMedia.descriptiveFieldLabel.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      descriptiveFieldLabelRule,
      Array.from(
        document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
          formFieldsSelector,
        ),
      )
        .filter((field) => {
          if (!isElementVisible(field as unknown as HTMLElement)) return false
          const label = getAssociatedLabelText(field).trim().toLowerCase()
          return !!label && vagueLabels.includes(label)
        })
        .map((field) => field as unknown as HTMLElement),
      (field) =>
        `Campo com rótulo potencialmente genérico: "${getAssociatedLabelText(field as HTMLInputElement).trim()}".`,
      t('rules.contentFormsMedia.descriptiveFieldLabel.suggestion'),
      t('rules.contentFormsMedia.descriptiveFieldLabel.remediation'),
      'descriptive-label',
    ),
}

export const predictableHelpTextRule: Rule = {
  id: 'predictable-help-text',
  nbrReference: '5.9.5',
  name: t('rules.contentFormsMedia.predictableHelpText.name'),
  description: t('rules.contentFormsMedia.predictableHelpText.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const fields = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(formFieldsSelector),
    )
    return createWarnings(
      predictableHelpTextRule,
      fields
        .filter((field) => {
          if (!isElementVisible(field as unknown as HTMLElement)) return false
          const context =
            `${getAssociatedLabelText(field)} ${field.placeholder || ''}`.toLowerCase()
          const isComplex = /senha|password|cpf|cnpj|telefone|phone|cep|data|email/.test(context)
          return (
            isComplex &&
            !getAssociatedDescriptionText(field as unknown as HTMLElement).trim() &&
            !field.getAttribute('title')?.trim()
          )
        })
        .map((field) => field as unknown as HTMLElement),
      (field) =>
        `Campo "${getAssociatedLabelText(field as HTMLInputElement) || field.getAttribute('name') || getElementIdAttribute(field)}" sem texto de ajuda associado.`,
      t('rules.contentFormsMedia.predictableHelpText.suggestion'),
      t('rules.contentFormsMedia.predictableHelpText.remediation'),
      'predictable-help',
    )
  },
}

export const descriptiveErrorRule: Rule = {
  id: 'descriptive-error',
  nbrReference: '5.9.9',
  name: t('rules.contentFormsMedia.descriptiveError.name'),
  description: t('rules.contentFormsMedia.descriptiveError.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const vagueErrors = ['inválido', 'invalido', 'erro', 'campo obrigatório', 'required', 'invalid']
    return createWarnings(
      descriptiveErrorRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="alert"], [aria-live], .error, .field-error, .invalid-feedback',
        ),
      ).filter((element) => {
        const text = getVisibleText(element).trim().toLowerCase()
        return !!text && vagueErrors.some((message) => text === message || text.endsWith(message))
      }),
      (element) => `Mensagem de erro pouco descritiva: "${getVisibleText(element)}".`,
      t('rules.contentFormsMedia.descriptiveError.suggestion'),
      t('rules.contentFormsMedia.descriptiveError.remediation'),
      'descriptive-error',
    )
  },
}

export const correctionSuggestionRule: Rule = {
  id: 'correction-suggestion',
  nbrReference: '5.9.10',
  name: t('rules.contentFormsMedia.correctionSuggestion.name'),
  description: t('rules.contentFormsMedia.correctionSuggestion.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async () => {
    const guidanceTerms = ['use', 'informe', 'digite', 'formato', 'deve conter', 'exemplo']
    return createWarnings(
      correctionSuggestionRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="alert"], [aria-live], .error, .field-error, .invalid-feedback',
        ),
      ).filter((element) => {
        const text = getVisibleText(element).trim().toLowerCase()
        return !!text && !guidanceTerms.some((term) => text.includes(term))
      }),
      () => t('rules.contentFormsMedia.correctionSuggestion.message'),
      t('rules.contentFormsMedia.correctionSuggestion.suggestion'),
      t('rules.contentFormsMedia.correctionSuggestion.remediation'),
      'correction-suggestion',
    )
  },
}

export const criticalFormPreventionRule: Rule = {
  id: 'critical-form-prevention',
  nbrReference: '5.9.12',
  name: t('rules.contentFormsMedia.criticalFormPrevention.name'),
  description: t('rules.contentFormsMedia.criticalFormPrevention.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  readiness: 'not_ready',
  readinessReason:
    'Depende da jornada crítica completa e de confirmação de fluxo; a Beta ainda não interage com formulários.',
  category: 'Semi-Automatizável',
  check: async () => {
    const criticalControls = Array.from(
      document.querySelectorAll<HTMLElement>('button, input[type="submit"], a[href]'),
    ).filter((element) => {
      const text = getAccessibleName(element).toLowerCase()
      return /pagar|confirmar compra|finalizar|excluir|cancelar conta|remover definitivamente/.test(
        text,
      )
    })

    return createWarnings(
      criticalFormPreventionRule,
      criticalControls.filter((element) => {
        const form = element.closest('form')
        const surroundingText = getVisibleText(form || document.body).toLowerCase()
        return !/revisar|confirmar|voltar|cancelar/.test(surroundingText)
      }),
      (element) =>
        `Ação crítica "${getAccessibleName(element)}" sem indício de revisão ou confirmação.`,
      t('rules.contentFormsMedia.criticalFormPrevention.suggestion'),
      t('rules.contentFormsMedia.criticalFormPrevention.remediation'),
      'critical-form',
    )
  },
}

export const dataReentryRule: Rule = {
  id: 'data-reentry',
  nbrReference: '5.9.15',
  name: t('rules.contentFormsMedia.dataReentry.name'),
  description: t('rules.contentFormsMedia.dataReentry.description'),
  severity: 'warning',
  wcagLevel: 'A',
  readiness: 'not_ready',
  readinessReason:
    'Campo repetido na mesma página não prova reentrada indevida de dados entre etapas ou sessões.',
  category: 'Semi-Automatizável',
  check: async () => {
    const repeatedFields = new Map<string, HTMLElement[]>()

    document
      .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(formFieldsSelector)
      .forEach((field) => {
        const key = `${field.getAttribute('autocomplete') || ''}:${getAssociatedLabelText(field).trim().toLowerCase()}`
        if (!key || key === ':') return
        if (!repeatedFields.has(key)) repeatedFields.set(key, [])
        repeatedFields.get(key)?.push(field as unknown as HTMLElement)
      })

    const duplicate = Array.from(repeatedFields.entries()).find(([, fields]) => fields.length > 1)
    return duplicate
      ? [
          createViolation(dataReentryRule, {
            element: duplicate[1][0],
            message: t('rules.contentFormsMedia.dataReentry.message', {
              field: duplicate[0],
            }),
            suggestion: t('rules.contentFormsMedia.dataReentry.suggestion'),
            remediationAdvice: t('rules.contentFormsMedia.dataReentry.remediation'),
            customIdPrefix: 'data-reentry',
          }),
        ]
      : []
  },
}

export const sensoryValidationRule: Rule = {
  id: 'sensory-validation',
  nbrReference: '5.9.16',
  name: t('rules.contentFormsMedia.sensoryValidation.name'),
  description: t('rules.contentFormsMedia.sensoryValidation.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      sensoryValidationRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('label, legend, p, span, small, .help, .hint'),
      ).filter((element) => hasActionableSensoryInstruction(getVisibleText(element))),
      (element) => `Instrução com dependência sensorial detectada: "${getVisibleText(element)}".`,
      t('rules.contentFormsMedia.sensoryValidation.suggestion'),
      t('rules.contentFormsMedia.sensoryValidation.remediation'),
      'sensory-validation',
    ),
}

export const sensoryCharacteristicsRule: Rule = {
  id: 'sensory-characteristics',
  nbrReference: '5.10.1',
  name: t('rules.contentFormsMedia.sensoryCharacteristics.name'),
  description: t('rules.contentFormsMedia.sensoryCharacteristics.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      sensoryCharacteristicsRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('p, span, li, label, legend, small, strong, em'),
      ).filter((element) =>
        /clique no bot[aã]o vermelho|campo à direita|item acima|item abaixo|lado esquerdo|lado direito|círculo verde|retângulo azul/.test(
          getVisibleText(element).toLowerCase(),
        ),
      ),
      (element) =>
        `Instrução dependente de característica sensorial: "${getVisibleText(element)}".`,
      t('rules.contentFormsMedia.sensoryCharacteristics.suggestion'),
      t('rules.contentFormsMedia.sensoryCharacteristics.remediation'),
      'sensory-characteristics',
    ),
}

export const presentationOrderRule: Rule = {
  id: 'presentation-order',
  nbrReference: '5.10.2',
  name: t('rules.contentFormsMedia.presentationOrder.name'),
  description: t('rules.contentFormsMedia.presentationOrder.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLElement>('[tabindex]').forEach((element) => {
      const tabIndex = Number(element.getAttribute('tabindex'))
      if (tabIndex > 0) {
        violations.push(
          createViolation(presentationOrderRule, {
            element,
            message: t('rules.contentFormsMedia.presentationOrder.positiveTabindexMessage', {
              value: tabIndex,
            }),
            suggestion: t(
              'rules.contentFormsMedia.presentationOrder.positiveTabindexSuggestion',
            ),
            remediationAdvice: t(
              'rules.contentFormsMedia.presentationOrder.positiveTabindexRemediation',
            ),
            customIdPrefix: 'presentation-order',
          }),
        )
      }
    })

    document.querySelectorAll<HTMLElement>(interactiveSelector).forEach((element) => {
      if (!isElementVisible(element)) return
      const style = window.getComputedStyle(element)
      if (
        (style.display.includes('flex') || style.display.includes('grid')) &&
        style.order !== '0'
      ) {
        violations.push(
          createViolation(presentationOrderRule, {
            element,
            message: t('rules.contentFormsMedia.presentationOrder.cssOrderMessage'),
            suggestion: t('rules.contentFormsMedia.presentationOrder.cssOrderSuggestion'),
            remediationAdvice: t(
              'rules.contentFormsMedia.presentationOrder.cssOrderRemediation',
            ),
            customIdPrefix: 'presentation-order',
          }),
        )
      }
    })

    return violations
  },
}

export const orientationRule: Rule = {
  id: 'orientation',
  nbrReference: '5.10.3',
  name: t('rules.contentFormsMedia.orientation.name'),
  description: t('rules.contentFormsMedia.orientation.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () => {
    if (!hasRestrictiveOrientationStyles()) {
      return []
    }

    return [
      createViolation(orientationRule, {
        element: document.body,
        message: t('rules.contentFormsMedia.orientation.message'),
        suggestion: t('rules.contentFormsMedia.orientation.suggestion'),
        remediationAdvice: t('rules.contentFormsMedia.orientation.remediation'),
        customIdPrefix: 'orientation',
        requiresHumanReview: true,
      }),
    ]
  },
}

export const colorUsageRule: Rule = {
  id: 'color-usage',
  nbrReference: '5.11.1',
  name: t('rules.contentFormsMedia.colorUsage.name'),
  description: t('rules.contentFormsMedia.colorUsage.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      colorUsageRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('p, span, li, label, legend, small, strong, em'),
      ).filter((element) =>
        /em vermelho|em verde|em azul|destacado em amarelo|campos em vermelho|botão verde/.test(
          getVisibleText(element).toLowerCase(),
        ),
      ),
      (element) =>
        `Indício de informação transmitida apenas por cor: "${getVisibleText(element)}".`,
      t('rules.contentFormsMedia.colorUsage.suggestion'),
      t('rules.contentFormsMedia.colorUsage.remediation'),
      'color-usage',
    ),
}

export const graphicContrastRule: Rule = {
  id: 'graphic-contrast',
  nbrReference: '5.11.5',
  name: t('rules.contentFormsMedia.graphicContrast.name'),
  description: t('rules.contentFormsMedia.graphicContrast.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLElement>('svg').forEach((element) => {
      if (!isElementVisible(element)) return
      const style = window.getComputedStyle(element)
      const paintColor = [style.fill, style.stroke, style.color].find(isPaintColor)
      if (!paintColor) return
      const foreground = rgbToHex(paintColor)
      const background = rgbToHex(getEffectiveBackgroundColor(element))
      const ratio = getContrastRatio(foreground, background)

      if (ratio < 3) {
        violations.push(
          createViolation(graphicContrastRule, {
            element,
            message: t('rules.contentFormsMedia.graphicContrast.message', {
              ratio: ratio.toFixed(2),
            }),
            suggestion: t('rules.contentFormsMedia.graphicContrast.suggestion'),
            remediationAdvice: t('rules.contentFormsMedia.graphicContrast.remediation'),
            contrastDetails: {
              context: 'graphic',
              foregroundHex: foreground,
              backgroundHex: background,
              measuredRatio: ratio,
              minimumRatio: 3,
              foregroundLabel: t('contrast.foreground.graphic'),
              backgroundLabel: t('contrast.background.surface'),
            },
            customIdPrefix: 'graphic-contrast',
            requiresHumanReview: true,
          }),
        )
      }
    })

    return violations
  },
}

export const focusIndicatorContrastRule: Rule = {
  id: 'focus-indicator-contrast',
  nbrReference: '5.11.6',
  name: t('rules.contentFormsMedia.focusIndicatorContrast.name'),
  description: t('rules.contentFormsMedia.focusIndicatorContrast.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () => {
    const violations: Violation[] = []

    const activeElement = getActiveFocusableElement()
    if (!activeElement) {
      return violations
    }

    const style = window.getComputedStyle(activeElement)
    const outlineWidth = parseFloat(style.outlineWidth || '0')
    if (outlineWidth <= 0 || style.outlineStyle === 'none') return violations

    const outlineColor = rgbToHex(style.outlineColor || '#000000')
    const background = rgbToHex(getEffectiveBackgroundColor(activeElement))
    const ratio = getContrastRatio(outlineColor, background)

    if (ratio < 3) {
      violations.push(
        createViolation(focusIndicatorContrastRule, {
          element: activeElement,
          message: t('rules.contentFormsMedia.focusIndicatorContrast.message', {
            ratio: ratio.toFixed(2),
          }),
          suggestion: t('rules.contentFormsMedia.focusIndicatorContrast.suggestion'),
          remediationAdvice: t('rules.contentFormsMedia.focusIndicatorContrast.remediation'),
          contrastDetails: {
            context: 'focus',
            foregroundHex: outlineColor,
            backgroundHex: background,
            measuredRatio: ratio,
            minimumRatio: 3,
            foregroundLabel: t('contrast.foreground.focus'),
            backgroundLabel: t('contrast.background.surface'),
          },
          customIdPrefix: 'focus-contrast',
          requiresHumanReview: true,
        }),
      )
    }

    return violations
  },
}

function getTextBlocks(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('p, li, blockquote, td, th, dd, dt, article, section'),
  ).filter((element) => isElementVisible(element) && getVisibleText(element).length >= 80)
}

function getReadableTextBlocks(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('p, li, blockquote, td, th, dd, dt'),
  ).filter((element) => isElementVisible(element) && getVisibleText(element).length >= 80)
}

function hasActionableSensoryInstruction(text: string): boolean {
  const normalized = text.toLowerCase()
  const sensoryPattern =
    /vermelh|azul|verde|direita|esquerda|acima|abaixo|agite|balance|mova o dispositivo/
  const actionPattern =
    /clique|toque|pressione|selecione|escolha|arraste|mova|digite|preencha|marque|ative|use|confirme|siga|verifique|identifique/

  return sensoryPattern.test(normalized) && actionPattern.test(normalized)
}

function hasClippedTextRisk(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  const hasConstrainedHeight =
    style.maxHeight !== 'none' ||
    style.webkitLineClamp !== 'none' ||
    Boolean(element.style.height || element.style.maxHeight)

  return (
    hasConstrainedHeight &&
    (style.overflow === 'hidden' || style.overflowY === 'hidden') &&
    element.scrollHeight > element.clientHeight
  )
}

function hasHorizontalTextOverflowRisk(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element)
  return (
    style.whiteSpace === 'nowrap' ||
    ((style.overflowX === 'hidden' || style.textOverflow === 'ellipsis') &&
      element.scrollWidth > element.clientWidth)
  )
}

function hasWideReadableLine(element: HTMLElement): boolean {
  const text = getVisibleText(element)
  if (text.length < 140) return false

  const style = window.getComputedStyle(element)
  const fontSize = parseFloat(style.fontSize || '16') || 16
  const readableWidth = fontSize * 0.56 * 90

  return element.getBoundingClientRect().width > readableWidth
}

export const lineSpacingRule: Rule = {
  id: 'line-spacing',
  nbrReference: '5.12.1',
  name: t('rules.contentFormsMedia.lineSpacing.name'),
  description: t('rules.contentFormsMedia.lineSpacing.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () =>
    createWarnings(
      lineSpacingRule,
      getTextBlocks().filter((element) => {
        const style = window.getComputedStyle(element)
        return (
          hasClippedTextRisk(element) &&
          parseFloat(style.lineHeight || '0') > 0 &&
          parseFloat(style.lineHeight || '0') < parseFloat(style.fontSize) * 1.5
        )
      }),
      () => t('rules.contentFormsMedia.lineSpacing.message'),
      t('rules.contentFormsMedia.lineSpacing.suggestion'),
      t('rules.contentFormsMedia.lineSpacing.remediation'),
      'line-spacing',
      true,
    ),
}

export const paragraphSpacingRule: Rule = {
  id: 'paragraph-spacing',
  nbrReference: '5.12.2',
  name: t('rules.contentFormsMedia.paragraphSpacing.name'),
  description: t('rules.contentFormsMedia.paragraphSpacing.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () =>
    createWarnings(
      paragraphSpacingRule,
      Array.from(document.querySelectorAll<HTMLElement>('article, section, main, div')).filter(
        (element) => {
          const paragraphs = element.querySelectorAll('p')
          return paragraphs.length >= 2 && hasClippedTextRisk(element)
        },
      ),
      () => t('rules.contentFormsMedia.paragraphSpacing.message'),
      t('rules.contentFormsMedia.paragraphSpacing.suggestion'),
      t('rules.contentFormsMedia.paragraphSpacing.remediation'),
      'paragraph-spacing',
      true,
    ),
}

export const letterSpacingRule: Rule = {
  id: 'letter-spacing',
  nbrReference: '5.12.3',
  name: t('rules.contentFormsMedia.letterSpacing.name'),
  description: t('rules.contentFormsMedia.letterSpacing.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () =>
    createWarnings(
      letterSpacingRule,
      getTextBlocks().filter((element) => {
        const style = window.getComputedStyle(element)
        return style.whiteSpace === 'nowrap' || style.textOverflow === 'ellipsis'
      }),
      () => t('rules.contentFormsMedia.letterSpacing.message'),
      t('rules.contentFormsMedia.letterSpacing.suggestion'),
      t('rules.contentFormsMedia.letterSpacing.remediation'),
      'letter-spacing',
      true,
    ),
}

export const wordSpacingRule: Rule = {
  id: 'word-spacing',
  nbrReference: '5.12.4',
  name: t('rules.contentFormsMedia.wordSpacing.name'),
  description: t('rules.contentFormsMedia.wordSpacing.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () =>
    createWarnings(
      wordSpacingRule,
      getTextBlocks().filter((element) => hasHorizontalTextOverflowRisk(element)),
      () => t('rules.contentFormsMedia.wordSpacing.message'),
      t('rules.contentFormsMedia.wordSpacing.suggestion'),
      t('rules.contentFormsMedia.wordSpacing.remediation'),
      'word-spacing',
      true,
    ),
}

export const textWidthRule: Rule = {
  id: 'text-width',
  nbrReference: '5.12.6',
  name: t('rules.contentFormsMedia.textWidth.name'),
  description: t('rules.contentFormsMedia.textWidth.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () =>
    createWarnings(
      textWidthRule,
      getReadableTextBlocks().filter((element) => hasWideReadableLine(element)),
      () => t('rules.contentFormsMedia.textWidth.message'),
      t('rules.contentFormsMedia.textWidth.suggestion'),
      t('rules.contentFormsMedia.textWidth.remediation'),
      'text-width',
      true,
    ),
}

export const resizedTextRule: Rule = {
  id: 'resized-text',
  nbrReference: '5.12.7',
  name: t('rules.contentFormsMedia.resizedText.name'),
  description: t('rules.contentFormsMedia.resizedText.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      resizedTextRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'p, li, td, th, label, button, a, div, section, article',
        ),
      ).filter((element) => {
        if (!isElementVisible(element) || getVisibleText(element).length < 40) return false
        const style = window.getComputedStyle(element)
        const fixedHeight = parseFloat(style.height || '0') > 0 && style.height !== 'auto'
        return fixedHeight && style.overflow === 'hidden' && style.whiteSpace !== 'normal'
      }),
      () => t('rules.contentFormsMedia.resizedText.message'),
      t('rules.contentFormsMedia.resizedText.suggestion'),
      t('rules.contentFormsMedia.resizedText.remediation'),
      'resized-text',
    ),
}

export const pagePartLanguageRule: Rule = {
  id: 'page-part-language',
  nbrReference: '5.13.3',
  name: t('rules.contentFormsMedia.pagePartLanguage.name'),
  description: t('rules.contentFormsMedia.pagePartLanguage.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () => {
    const pageLang = document.documentElement.getAttribute('lang') || ''
    return createWarnings(
      pagePartLanguageRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('blockquote, q, span, em, strong, p, li'),
      ).filter((element) => {
        const text = getVisibleText(element).trim()
        if (element.closest('[lang]') && getElementLanguage(element) !== pageLang) return false
        if (!looksLikeForeignLanguageBlock(text)) return false
        return getElementLanguage(element) === pageLang && text.split(/\s+/).length >= 5
      }),
      (element) =>
        `Trecho com possível conteúdo em idioma diferente sem marcação de lang: "${getVisibleText(element).slice(0, 80)}".`,
      t('rules.contentFormsMedia.pagePartLanguage.suggestion'),
      t('rules.contentFormsMedia.pagePartLanguage.remediation'),
      'page-part-language',
      true,
    )
  },
}

export const readingOrderRule: Rule = {
  id: 'reading-order',
  nbrReference: '5.13.6',
  name: t('rules.contentFormsMedia.readingOrder.name'),
  description: t('rules.contentFormsMedia.readingOrder.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLElement>('[aria-flowto]').forEach((element) => {
      violations.push(
        createViolation(readingOrderRule, {
          element,
          message: t('rules.contentFormsMedia.readingOrder.ariaFlowtoMessage'),
          suggestion: t('rules.contentFormsMedia.readingOrder.ariaFlowtoSuggestion'),
          remediationAdvice: t('rules.contentFormsMedia.readingOrder.ariaFlowtoRemediation'),
          customIdPrefix: 'reading-order',
        }),
      )
    })

    return violations
  },
}

export const visibleTextInNameRule: Rule = {
  id: 'visible-text-in-name',
  nbrReference: '5.13.7',
  name: t('rules.contentFormsMedia.visibleTextInName.name'),
  description: t('rules.contentFormsMedia.visibleTextInName.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      visibleTextInNameRule,
      Array.from(document.querySelectorAll<HTMLElement>(interactiveSelector)).filter((element) => {
        if (!isElementVisible(element)) return false
        const visible = getVisibleText(element).trim().toLowerCase()
        const accessible = getAccessibleName(element).trim().toLowerCase()
        return !!visible && !!accessible && !accessible.includes(visible)
      }),
      (element) =>
        `Nome acessível não contém o texto visível do controle "${getVisibleText(element)}".`,
      t('rules.contentFormsMedia.visibleTextInName.suggestion'),
      t('rules.contentFormsMedia.visibleTextInName.remediation'),
      'visible-text-name',
    ),
}

export const statusMessageRule: Rule = {
  id: 'status-message',
  nbrReference: '5.13.8',
  name: t('rules.contentFormsMedia.statusMessage.name'),
  description: t('rules.contentFormsMedia.statusMessage.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async () =>
    createWarnings(
      statusMessageRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '.status, .toast, .snackbar, .alert, .success, .error-message, [data-status], [data-toast]',
        ),
      ).filter((element) => {
        if (!isElementVisible(element)) return false
        if (element.hasAttribute('role') || element.hasAttribute('aria-live')) return false
        const text = getVisibleText(element).trim().toLowerCase()
        if (text.length < 4 || text.length > 160) return false
        return /(salvo|enviado|atualizado|erro|falha|sucesso|carregado|copiado|removido|adicionado)/.test(
          text,
        )
      }),
      () => t('rules.contentFormsMedia.statusMessage.message'),
      t('rules.contentFormsMedia.statusMessage.suggestion'),
      t('rules.contentFormsMedia.statusMessage.remediation'),
      'status-message',
      true,
    ),
}

export const customComponentSemanticRule: Rule = {
  id: 'custom-component-semantics',
  nbrReference: '5.13.12',
  name: t('rules.contentFormsMedia.customComponentSemantic.name'),
  description: t('rules.contentFormsMedia.customComponentSemantic.description'),
  severity: 'warning',
  wcagLevel: 'A',
  readiness: 'not_ready',
  readinessReason:
    'A detecção por tabindex/evento inferiu intenção interativa demais e gerou falso positivo em cards narrativos.',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      customComponentSemanticRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('[onclick], [onkeydown], [tabindex]'),
      ).filter((element) => {
        if (!isElementVisible(element)) return false
        if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(element.tagName))
          return false
        return !element.getAttribute('role')
      }),
      (element) =>
        `Componente customizado interativo sem role semântica: <${element.tagName.toLowerCase()}>.`,
      t('rules.contentFormsMedia.customComponentSemantic.suggestion'),
      t('rules.contentFormsMedia.customComponentSemantic.remediation'),
      'custom-component-semantics',
    ),
}

export const audioTranscriptRule: Rule = {
  id: 'audio-transcript',
  nbrReference: '5.14.1',
  name: t('rules.contentFormsMedia.audioTranscript.name'),
  description: t('rules.contentFormsMedia.audioTranscript.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      audioTranscriptRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'audio, a[href$=".mp3"], a[href$=".wav"], a[href$=".ogg"]',
        ),
      ).filter((element) => {
        const container =
          (element.closest('figure, section, article, div') as HTMLElement | null) || document.body
        return !/transcri|transcript|roteiro|texto alternativo/.test(
          getVisibleText(container).toLowerCase(),
        )
      }),
      () => t('rules.contentFormsMedia.audioTranscript.message'),
      t('rules.contentFormsMedia.audioTranscript.suggestion'),
      t('rules.contentFormsMedia.audioTranscript.remediation'),
      'audio-transcript',
    ),
}

export const videoTranscriptRule: Rule = {
  id: 'video-transcript',
  nbrReference: '5.14.3',
  name: t('rules.contentFormsMedia.videoTranscript.name'),
  description: t('rules.contentFormsMedia.videoTranscript.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      videoTranscriptRule,
      Array.from(document.querySelectorAll<HTMLVideoElement>('video')).filter((video) => {
        const container =
          (video.closest('figure, section, article, div') as HTMLElement | null) || document.body
        const text = getVisibleText(container).toLowerCase()
        return !/transcri|transcript|descri[cç][aã]o textual|vers[aã]o em texto/.test(text)
      }) as unknown as HTMLElement[],
      () => t('rules.contentFormsMedia.videoTranscript.message'),
      t('rules.contentFormsMedia.videoTranscript.suggestion'),
      t('rules.contentFormsMedia.videoTranscript.remediation'),
      'video-transcript',
    ),
}

export const videoCaptionsRule: Rule = {
  id: 'video-captions',
  nbrReference: '5.14.2',
  name: t('rules.contentFormsMedia.videoCaptions.name'),
  description: t('rules.contentFormsMedia.videoCaptions.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      videoCaptionsRule,
      Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
        .filter((video) => !video.querySelector('track[kind="captions"], track[kind="subtitles"]'))
        .map((video) => video as unknown as HTMLElement),
      () => t('rules.contentFormsMedia.videoCaptions.message'),
      t('rules.contentFormsMedia.videoCaptions.suggestion'),
      t('rules.contentFormsMedia.videoCaptions.remediation'),
      'video-captions',
    ),
}

export const audioDescriptionRule: Rule = {
  id: 'audio-description',
  nbrReference: '5.14.4',
  name: t('rules.contentFormsMedia.audioDescription.name'),
  description: t('rules.contentFormsMedia.audioDescription.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      audioDescriptionRule,
      Array.from(document.querySelectorAll<HTMLVideoElement>('video'))
        .filter((video) => !video.querySelector('track[kind="descriptions"]'))
        .map((video) => video as unknown as HTMLElement),
      () => t('rules.contentFormsMedia.audioDescription.message'),
      t('rules.contentFormsMedia.audioDescription.suggestion'),
      t('rules.contentFormsMedia.audioDescription.remediation'),
      'audio-description',
    ),
}

export const liveCaptionsRule: Rule = {
  id: 'live-captions',
  nbrReference: '5.14.9',
  name: t('rules.contentFormsMedia.liveCaptions.name'),
  description: t('rules.contentFormsMedia.liveCaptions.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      liveCaptionsRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('video, iframe, section, article, div'),
      ).filter(
        (element) =>
          /ao vivo|live|transmiss[aã]o/.test(getVisibleText(element).toLowerCase()) &&
          !/legenda|caption/.test(getVisibleText(element).toLowerCase()),
      ),
      () => t('rules.contentFormsMedia.liveCaptions.message'),
      t('rules.contentFormsMedia.liveCaptions.suggestion'),
      t('rules.contentFormsMedia.liveCaptions.remediation'),
      'live-captions',
    ),
}

export const animationControlRule: Rule = {
  id: 'animation-control',
  nbrReference: '5.15.1',
  name: t('rules.contentFormsMedia.animationControl.name'),
  description: t('rules.contentFormsMedia.animationControl.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const violations: Violation[] = []

    document
      .querySelectorAll<HTMLElement>(
        'marquee, [data-carousel], [data-slider], [class*="carousel" i], [class*="slider" i]',
      )
      .forEach((element) => {
        const containerText = getVisibleText(element.parentElement || element).toLowerCase()
        if (!/pausar|pause|parar|stop/.test(containerText)) {
          violations.push(
            createViolation(animationControlRule, {
              element,
              message: t('rules.contentFormsMedia.animationControl.carouselMessage'),
              suggestion: t('rules.contentFormsMedia.animationControl.carouselSuggestion'),
              remediationAdvice: t(
                'rules.contentFormsMedia.animationControl.carouselRemediation',
              ),
              customIdPrefix: 'animation-control',
            }),
          )
        }
      })

    document
      .querySelectorAll<HTMLMediaElement>('video[autoplay], audio[autoplay]')
      .forEach((media) => {
        if (!media.hasAttribute('controls')) {
          violations.push(
            createViolation(animationControlRule, {
              element: media as unknown as HTMLElement,
              message: t('rules.contentFormsMedia.animationControl.mediaMessage'),
              suggestion: t('rules.contentFormsMedia.animationControl.mediaSuggestion'),
              remediationAdvice: t(
                'rules.contentFormsMedia.animationControl.mediaRemediation',
              ),
              customIdPrefix: 'animation-control',
            }),
          )
        }
      })

    return violations
  },
}

export const flashingContentRule: Rule = {
  id: 'flashing-content',
  nbrReference: '5.15.4',
  name: t('rules.contentFormsMedia.flashingContent.name'),
  description: t('rules.contentFormsMedia.flashingContent.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async () =>
    createWarnings(
      flashingContentRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'video, canvas, svg, [role="img"], [class*="animation" i], [class*="blink" i]',
        ),
      ).filter((element) => {
        if (!isElementVisible(element)) return false
        const style = window.getComputedStyle(element)
        if (style.animationName === 'none') return false
        const duration = parseFloat(style.animationDuration || '0')
        const infinite = style.animationIterationCount === 'infinite'
        const area = element.getBoundingClientRect().width * element.getBoundingClientRect().height
        const nearbyControls = getVisibleText(
          (element.parentElement as HTMLElement | null) || element,
        ).toLowerCase()
        return (
          duration > 0.08 &&
          duration < 0.24 &&
          infinite &&
          area >= 4900 &&
          !/pausar|parar animação|reduzir movimento/.test(nearbyControls)
        )
      }),
      () => t('rules.contentFormsMedia.flashingContent.message'),
      t('rules.contentFormsMedia.flashingContent.suggestion'),
      t('rules.contentFormsMedia.flashingContent.remediation'),
      'flashing-content',
      true,
    ),
}

export const adjustableTimeLimitRule: Rule = {
  id: 'adjustable-time-limit',
  nbrReference: '5.16.2',
  name: t('rules.contentFormsMedia.adjustableTimeLimit.name'),
  description: t('rules.contentFormsMedia.adjustableTimeLimit.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const violations: Violation[] = []
    const refreshMeta = document.querySelector<HTMLMetaElement>('meta[http-equiv="refresh"]')

    if (refreshMeta) {
      const refreshContent = refreshMeta.getAttribute('content') || ''
      const refreshSeconds = Number.parseInt(refreshContent.split(';')[0] || '', 10)
      violations.push(
        createViolation(adjustableTimeLimitRule, {
          element: refreshMeta as unknown as HTMLElement,
          message:
            Number.isFinite(refreshSeconds) && refreshSeconds > 0
              ? t('rules.contentFormsMedia.adjustableTimeLimit.metaMessageWithSeconds', {
                  seconds: refreshSeconds,
                })
              : t('rules.contentFormsMedia.adjustableTimeLimit.metaMessage'),
          suggestion: t('rules.contentFormsMedia.adjustableTimeLimit.metaSuggestion'),
          remediationAdvice: t('rules.contentFormsMedia.adjustableTimeLimit.metaRemediation'),
          customIdPrefix: 'adjustable-time',
        }),
      )
    }

    document
      .querySelectorAll<HTMLElement>(
        '[role="timer"], [aria-live], .countdown, .timer, .session-timeout, p, span, strong, small, div, section',
      )
      .forEach((element) => {
        const text = getVisibleText(element).toLowerCase()
        const localContext = getVisibleText(
          (element.parentElement as HTMLElement | null) || element,
        ).toLowerCase()
        const hasControlNearby =
          /estender|renovar|continuar sessão|pausar|desativar temporizador/.test(localContext)
        if (
          /segundos restantes|tempo restante|sess[aã]o expira|expira em/.test(text) &&
          !hasControlNearby
        ) {
          violations.push(
            createViolation(adjustableTimeLimitRule, {
              element,
              message: t('rules.contentFormsMedia.adjustableTimeLimit.countdownMessage'),
              suggestion: t(
                'rules.contentFormsMedia.adjustableTimeLimit.countdownSuggestion',
              ),
              remediationAdvice: t(
                'rules.contentFormsMedia.adjustableTimeLimit.countdownRemediation',
              ),
              customIdPrefix: 'adjustable-time',
            }),
          )
        }
      })

    return violations
  },
}

export const contentFormsMediaRules: Rule[] = [
  predictableFieldLabelRule,
  descriptiveFieldLabelRule,
  predictableHelpTextRule,
  descriptiveErrorRule,
  correctionSuggestionRule,
  criticalFormPreventionRule,
  dataReentryRule,
  sensoryValidationRule,
  sensoryCharacteristicsRule,
  presentationOrderRule,
  orientationRule,
  colorUsageRule,
  graphicContrastRule,
  focusIndicatorContrastRule,
  lineSpacingRule,
  paragraphSpacingRule,
  letterSpacingRule,
  wordSpacingRule,
  textWidthRule,
  resizedTextRule,
  pagePartLanguageRule,
  readingOrderRule,
  visibleTextInNameRule,
  statusMessageRule,
  customComponentSemanticRule,
  audioTranscriptRule,
  videoTranscriptRule,
  videoCaptionsRule,
  audioDescriptionRule,
  liveCaptionsRule,
  animationControlRule,
  flashingContentRule,
  adjustableTimeLimitRule,
]
