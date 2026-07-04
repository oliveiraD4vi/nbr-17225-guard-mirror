/**
 * Regras da Seção 5.1 - Interação por teclado
 * ABNT NBR 17225:2025
 */

import { t } from '@/i18n'
import type { Rule, Violation } from '@/types'
import {
  createViolation,
  getAccessibleName,
  getAssociatedDescriptionText,
  getElementIdAttribute,
  getFocusableElements,
  getVisibleText,
  isElementFullyInViewport,
  isElementPartiallyInViewport,
  isElementVisible,
} from '@/utils'

export const keyboardAccessibilityRule: Rule = {
  id: 'keyboard-accessibility',
  nbrReference: '5.1.13',
  name: t('rules.keyboard.keyboardAccessibility.name'),
  description: t('rules.keyboard.keyboardAccessibility.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []
    const interactiveElements = document.querySelectorAll<HTMLElement>(
      'button, input, select, textarea, a[href], [role="button"], [role="link"], [role="menuitem"], [onclick]',
    )

    interactiveElements.forEach((el) => {
      if (!isElementVisible(el)) return

      const tabIndex = el.getAttribute('tabindex')
      const hasHref = el.tagName !== 'A' || Boolean(el.getAttribute('href')?.trim())
      const isNaturallyFocusable =
        ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
        (el.tagName === 'A' && hasHref)
      const isGenericOnClickOnly =
        el.hasAttribute('onclick') &&
        !el.hasAttribute('role') &&
        el.tagName !== 'A' &&
        el.tagName !== 'BUTTON' &&
        !el.matches('input, select, textarea')

      if (isGenericOnClickOnly && !el.textContent?.trim()) return

      if (!isNaturallyFocusable && (!tabIndex || parseInt(tabIndex, 10) < 0)) {
        violations.push(
          createViolation(keyboardAccessibilityRule, {
            element: el,
            message: t('rules.keyboard.keyboardAccessibility.message', { tagName: el.tagName }),
            suggestion: t('rules.keyboard.keyboardAccessibility.suggestion'),
            remediationAdvice: t('rules.keyboard.keyboardAccessibility.remediation'),
            customIdPrefix: 'keyboard',
          }),
        )
      }
    })

    return violations
  },
}

export const focusIndicatorRule: Rule = {
  id: 'focus-indicator',
  nbrReference: '5.1.1',
  name: t('rules.keyboard.focusIndicator.name'),
  description: t('rules.keyboard.focusIndicator.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (
      !activeElement ||
      !isElementVisible(activeElement) ||
      !getFocusableElements().includes(activeElement)
    ) {
      return violations
    }

    const styles = window.getComputedStyle(activeElement)
    const outlineStyle = styles.outlineStyle
    const outlineWidth = parseFloat(styles.outlineWidth || '0')
    const boxShadow = styles.boxShadow
    const borderStyle = styles.borderStyle
    const borderWidth = parseFloat(styles.borderWidth || '0')

    if (
      (outlineStyle === 'none' || outlineWidth === 0) &&
      (!boxShadow || boxShadow === 'none') &&
      (borderStyle === 'none' || borderWidth === 0)
    ) {
      violations.push(
        createViolation(focusIndicatorRule, {
          element: activeElement,
          message: t('rules.keyboard.focusIndicator.message', { tagName: activeElement.tagName }),
          suggestion: t('rules.keyboard.focusIndicator.suggestion'),
          remediationAdvice: t('rules.keyboard.focusIndicator.remediation'),
          customIdPrefix: 'focus',
        }),
      )
    }

    return violations
  },
}

export const focusFullyVisibleRule: Rule = {
  id: 'focus-fully-visible',
  nbrReference: '5.1.2',
  name: t('rules.keyboard.focusFullyVisible.name'),
  description: t('rules.keyboard.focusFullyVisible.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (
      !activeElement ||
      !isElementVisible(activeElement) ||
      !getFocusableElements().includes(activeElement)
    ) {
      return []
    }

    return !isElementFullyInViewport(activeElement)
      ? [
          createViolation(focusFullyVisibleRule, {
            element: activeElement,
            message: t('rules.keyboard.focusFullyVisible.message'),
            suggestion: t('rules.keyboard.focusFullyVisible.suggestion'),
            remediationAdvice: t('rules.keyboard.focusFullyVisible.remediation'),
            customIdPrefix: 'focus-full',
          }),
        ]
      : []
  },
}

export const focusPartiallyVisibleRule: Rule = {
  id: 'focus-partially-visible',
  nbrReference: '5.1.3',
  name: t('rules.keyboard.focusPartiallyVisible.name'),
  description: t('rules.keyboard.focusPartiallyVisible.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (
      !activeElement ||
      !isElementVisible(activeElement) ||
      !getFocusableElements().includes(activeElement)
    ) {
      return []
    }

    return !isElementPartiallyInViewport(activeElement)
      ? [
          createViolation(focusPartiallyVisibleRule, {
            element: activeElement,
            message: t('rules.keyboard.focusPartiallyVisible.message'),
            suggestion: t('rules.keyboard.focusPartiallyVisible.suggestion'),
            remediationAdvice: t('rules.keyboard.focusPartiallyVisible.remediation'),
            customIdPrefix: 'focus-partial',
          }),
        ]
      : []
  },
}

export const focusOrderRule: Rule = {
  id: 'focus-order',
  nbrReference: '5.1.4',
  name: t('rules.keyboard.focusOrder.name'),
  description: t('rules.keyboard.focusOrder.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLElement>('[tabindex]').forEach((el) => {
      const value = Number(el.getAttribute('tabindex'))
      if (value > 0) {
        violations.push(
          createViolation(focusOrderRule, {
            element: el,
            message: t('rules.keyboard.focusOrder.message', { value }),
            suggestion: t('rules.keyboard.focusOrder.suggestion'),
            remediationAdvice: t('rules.keyboard.focusOrder.remediation'),
            customIdPrefix: 'focus-order',
          }),
        )
      }
    })

    return violations
  },
}

export const focusTrapRule: Rule = {
  id: 'focus-trap',
  nbrReference: '5.1.6',
  name: t('rules.keyboard.focusTrap.name'),
  description: t('rules.keyboard.focusTrap.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<HTMLElement>('dialog, [role="dialog"], [role="alertdialog"]')
      .forEach((dialog) => {
        const focusable = getFocusableElements(dialog)
        const hasCloseControl = focusable.some((item) => {
          const text = (item.textContent || item.getAttribute('aria-label') || '').toLowerCase()
          return (
            text.includes('fechar') || text.includes('close') || item.hasAttribute('data-close')
          )
        })

        if (!hasCloseControl) {
          violations.push(
            createViolation(focusTrapRule, {
              element: dialog,
              message: t('rules.keyboard.focusTrap.message'),
              suggestion: t('rules.keyboard.focusTrap.suggestion'),
              remediationAdvice: t('rules.keyboard.focusTrap.remediation'),
              customIdPrefix: 'focus-trap',
            }),
          )
        }
      })

    return violations
  },
}

export const additionalContentPersistentRule: Rule = {
  id: 'additional-content-persistent',
  nbrReference: '5.1.8',
  name: t('rules.keyboard.additionalContentPersistent.name'),
  description: t('rules.keyboard.additionalContentPersistent.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<HTMLElement>('[role="tooltip"], [aria-describedby]')
      .forEach((element) => {
        if (element.getAttribute('role') === 'tooltip' && !getElementIdAttribute(element)) {
          violations.push(
            createViolation(additionalContentPersistentRule, {
              element,
              message: t('rules.keyboard.additionalContentPersistent.message'),
              suggestion: t('rules.keyboard.additionalContentPersistent.suggestion'),
              remediationAdvice: t('rules.keyboard.additionalContentPersistent.remediation'),
              customIdPrefix: 'tooltip-persistent',
            }),
          )
        }
      })

    return violations
  },
}

export const additionalContentDismissibleRule: Rule = {
  id: 'additional-content-dismissible',
  nbrReference: '5.1.9',
  name: t('rules.keyboard.additionalContentDismissible.name'),
  description: t('rules.keyboard.additionalContentDismissible.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<HTMLElement>('[role="tooltip"], [role="dialog"], [popover]')
      .forEach((element) => {
        const hasDismissControl = Boolean(
          element.querySelector(
            'button, [role="button"], [aria-label*="fechar" i], [aria-label*="close" i]',
          ),
        )
        if (!hasDismissControl && element.getAttribute('role') !== 'tooltip') {
          violations.push(
            createViolation(additionalContentDismissibleRule, {
              element,
              message: t('rules.keyboard.additionalContentDismissible.message'),
              suggestion: t('rules.keyboard.additionalContentDismissible.suggestion'),
              remediationAdvice: t('rules.keyboard.additionalContentDismissible.remediation'),
              customIdPrefix: 'dismissible',
            }),
          )
        }
      })

    return violations
  },
}

export const keyboardShortcutRule: Rule = {
  id: 'keyboard-shortcut',
  nbrReference: '5.1.11',
  name: t('rules.keyboard.keyboardShortcut.name'),
  description: t('rules.keyboard.keyboardShortcut.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> =>
    Array.from(document.querySelectorAll<HTMLElement>('[accesskey]')).map((el) =>
      createViolation(keyboardShortcutRule, {
        element: el,
        message: t('rules.keyboard.keyboardShortcut.message', {
          accessKey: el.getAttribute('accesskey'),
        }),
        suggestion: t('rules.keyboard.keyboardShortcut.suggestion'),
        remediationAdvice: t('rules.keyboard.keyboardShortcut.remediation'),
        customIdPrefix: 'accesskey',
      }),
    ),
}

const customComponentSelector = [
  '[role="combobox"]',
  '[role="grid"]',
  '[role="listbox"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="tablist"]',
  '[role="tree"]',
  '[aria-haspopup]',
  '[aria-activedescendant]',
  '[draggable="true"]',
  '[data-carousel]',
  '[data-slider]',
  '[class*="carousel" i]',
  '[class*="slider" i]',
].join(', ')

const instructionPattern =
  /\b(pressione|aperte|utilize|use|tecla|atalho|seta|setas|tab|enter|escape|esc|espaço|space|arraste|deslize|mova|navegue|selecione|expanda|recolha|toque|clique)\b/i

const getNearbyInstructionText = (element: HTMLElement): string => {
  const directText = [
    element.getAttribute('aria-description'),
    element.getAttribute('title'),
    element.getAttribute('data-instructions'),
    getAssociatedDescriptionText(element),
    getAccessibleName(element),
  ]
    .filter(Boolean)
    .join(' ')

  const container =
    element.closest<HTMLElement>('fieldset, section, article, form, [role="group"]') ||
    element.parentElement
  const nearbyText = container ? getVisibleText(container).slice(0, 800) : ''

  return `${directText} ${nearbyText}`.trim()
}

export const customComponentInstructionsRule: Rule = {
  id: 'custom-component-instructions',
  nbrReference: '5.1.16',
  name: t('rules.keyboard.customComponentInstructions.name'),
  description: t('rules.keyboard.customComponentInstructions.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []
    const checkedComponents = new Set<HTMLElement>()

    document.querySelectorAll<HTMLElement>(customComponentSelector).forEach((element) => {
      if (!isElementVisible(element) || checkedComponents.has(element)) return
      checkedComponents.add(element)

      const isNativeControl =
        ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(element.tagName) &&
        !element.hasAttribute('role') &&
        !element.hasAttribute('aria-haspopup') &&
        !element.hasAttribute('aria-activedescendant')

      if (isNativeControl) return

      const instructionText = getNearbyInstructionText(element)
      if (instructionPattern.test(instructionText)) return

      violations.push(
        createViolation(customComponentInstructionsRule, {
          element,
          message: t('rules.keyboard.customComponentInstructions.message'),
          suggestion: t('rules.keyboard.customComponentInstructions.suggestion'),
          remediationAdvice: t('rules.keyboard.customComponentInstructions.remediation'),
          customIdPrefix: 'custom-component-instructions',
        }),
      )
    })

    return violations
  },
}

export const keyboardRules: Rule[] = [
  keyboardAccessibilityRule,
  focusIndicatorRule,
  focusFullyVisibleRule,
  focusPartiallyVisibleRule,
  focusOrderRule,
  focusTrapRule,
  additionalContentPersistentRule,
  additionalContentDismissibleRule,
  keyboardShortcutRule,
  customComponentInstructionsRule,
]
