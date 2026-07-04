import { t } from '@/i18n'
import type { Rule, Violation } from '@/types'
import {
  createViolation,
  getAssociatedDescriptionText,
  getAssociatedLabelText,
  getElementIdAttribute,
  getVisibleText,
  isElementVisible,
} from '@/utils'

const formFieldsSelector =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), select, textarea'

function getVisibleFieldLabelText(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): string {
  if (field.labels?.length) {
    return Array.from(field.labels)
      .map((label) => getVisibleText(label))
      .join(' ')
      .trim()
  }

  const fieldId = getElementIdAttribute(field)
  if (fieldId) {
    const explicitLabel = document.querySelector<HTMLElement>(
      `label[for="${CSS.escape(fieldId)}"]`,
    )
    const explicitLabelText = explicitLabel ? getVisibleText(explicitLabel).trim() : ''
    if (explicitLabelText) return explicitLabelText
  }

  const wrappingLabel = field.closest('label')
  if (wrappingLabel) {
    const wrappingLabelText = getVisibleText(wrappingLabel as HTMLElement).trim()
    if (wrappingLabelText) return wrappingLabelText
  }

  const programmaticLabel = getAssociatedLabelText(field)
  if (programmaticLabel) return programmaticLabel

  const contextualContainer = field.closest<HTMLElement>(
    'fieldset, .ant-form-item, .form-field, .form-group, .field, .input-group, td, th',
  )
  if (!contextualContainer) return ''

  return Array.from(
    contextualContainer.querySelectorAll<HTMLElement>(
      'legend, label, .ant-form-item-label, .form-label, [data-field-label]',
    ),
  )
    .map((element) => getVisibleText(element).trim())
    .filter(Boolean)
    .join(' ')
    .trim()
}

export const fieldLabelRule: Rule = {
  id: 'field-label',
  nbrReference: '5.9.1',
  name: t('rules.forms.fieldLabel.name'),
  description: t('rules.forms.fieldLabel.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(formFieldsSelector)
      .forEach((field) => {
        if (!isElementVisible(field as unknown as HTMLElement)) return

        const visibleLabel = getVisibleFieldLabelText(field)
        if (!visibleLabel.trim()) {
          violations.push(
            createViolation(fieldLabelRule, {
              element: field as unknown as HTMLElement,
              message: t('rules.forms.fieldLabel.message'),
              suggestion: t('rules.forms.fieldLabel.suggestion'),
              remediationAdvice: t('rules.forms.fieldLabel.remediation'),
              customIdPrefix: 'field-label',
            }),
          )
        }
      })

    return violations
  },
}

export const associatedFieldLabelRule: Rule = {
  id: 'field-label-associated',
  nbrReference: '5.9.3',
  name: t('rules.forms.associatedFieldLabel.name'),
  description: t('rules.forms.associatedFieldLabel.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(formFieldsSelector)
      .forEach((field) => {
        if (!isElementVisible(field as unknown as HTMLElement)) return

        const visibleLabel = getVisibleFieldLabelText(field)
        const hasProgrammaticLabel = Boolean(getAssociatedLabelText(field).trim())

        if (visibleLabel && !hasProgrammaticLabel) {
          violations.push(
            createViolation(associatedFieldLabelRule, {
              element: field as unknown as HTMLElement,
              message: t('rules.forms.associatedFieldLabel.message'),
              suggestion: t('rules.forms.associatedFieldLabel.suggestion'),
              remediationAdvice: t('rules.forms.associatedFieldLabel.remediation'),
              customIdPrefix: 'field-label-associated',
            }),
          )
        }
      })

    return violations
  },
}

export const relatedFieldsRule: Rule = {
  id: 'related-fields',
  nbrReference: '5.9.6',
  name: t('rules.forms.relatedFields.name'),
  description: t('rules.forms.relatedFields.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []
    const groups = new Map<string, HTMLInputElement[]>()

    document
      .querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]')
      .forEach((field) => {
        if (!field.name) return
        if (!groups.has(field.name)) groups.set(field.name, [])
        groups.get(field.name)?.push(field)
      })

    groups.forEach((fields) => {
      if (fields.length < 2) return
      const first = fields[0]
      if (!first.closest('fieldset, [role="group"], [role="radiogroup"]')) {
        violations.push(
          createViolation(relatedFieldsRule, {
            element: first,
            message: t('rules.forms.relatedFields.message', { name: first.name }),
            suggestion: t('rules.forms.relatedFields.suggestion'),
            remediationAdvice: t('rules.forms.relatedFields.remediation'),
            customIdPrefix: 'field-group',
          }),
        )
      }
    })

    return violations
  },
}

export const requiredFieldsRule: Rule = {
  id: 'required-fields',
  nbrReference: '5.9.7',
  name: t('rules.forms.requiredFields.name'),
  description: t('rules.forms.requiredFields.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(formFieldsSelector)
      .forEach((field) => {
        if (!isElementVisible(field as unknown as HTMLElement)) return

        const label = getAssociatedLabelText(field).toLowerCase()
        const visuallyRequired =
          label.includes('*') || label.includes('obrigatório') || label.includes('obrigatorio')
        const programmaticallyRequired =
          field.hasAttribute('required') || field.getAttribute('aria-required') === 'true'

        if (visuallyRequired && !programmaticallyRequired) {
          violations.push(
            createViolation(requiredFieldsRule, {
              element: field as unknown as HTMLElement,
              message: t('rules.forms.requiredFields.message'),
              suggestion: t('rules.forms.requiredFields.suggestion'),
              remediationAdvice: t('rules.forms.requiredFields.remediation'),
              customIdPrefix: 'required-field',
            }),
          )
        }
      })

    return violations
  },
}

export const dataTypeRule: Rule = {
  id: 'field-data-type',
  nbrReference: '5.9.8',
  name: t('rules.forms.dataType.name'),
  description: t('rules.forms.dataType.description'),
  severity: 'error',
  wcagLevel: 'AA',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLInputElement>('input').forEach((field) => {
      if (!isElementVisible(field)) return
      if (['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio', 'file'].includes(field.type))
        return

      const label =
        `${getAssociatedLabelText(field)} ${field.name} ${getElementIdAttribute(field)} ${field.placeholder}`.toLowerCase()
      const autocomplete = field.getAttribute('autocomplete')?.toLowerCase() || ''
      const inputMode = field.getAttribute('inputmode')?.toLowerCase() || ''
      const expectedType =
        /\b(e-?mail|email)\b/.test(label) || autocomplete === 'email'
          ? 'email'
          : /\b(telefone|phone|celular|whatsapp)\b/.test(label) ||
              autocomplete === 'tel' ||
              inputMode === 'tel'
            ? 'tel'
            : /\b(url|site|website|link)\b/.test(label) || inputMode === 'url'
              ? 'url'
              : ''

      if (expectedType && field.type === 'text') {
        violations.push(
          createViolation(dataTypeRule, {
            element: field,
            message: t('rules.forms.dataType.message', { type: expectedType }),
            suggestion: t('rules.forms.dataType.suggestion', { type: expectedType }),
            remediationAdvice: t('rules.forms.dataType.remediation', { type: expectedType }),
            customIdPrefix: 'field-type',
          }),
        )
      }
    })

    return violations
  },
}

export const accessibleAuthenticationRule: Rule = {
  id: 'accessible-authentication',
  nbrReference: '5.9.18',
  name: t('rules.forms.accessibleAuthentication.name'),
  description: t('rules.forms.accessibleAuthentication.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []
    document
      .querySelectorAll<HTMLElement>(
        '[class*="captcha" i], [id*="captcha" i], [title*="captcha" i], [aria-label*="captcha" i], [src*="captcha" i], [data-sitekey]',
      )
      .forEach((element) => {
        violations.push(
          createViolation(accessibleAuthenticationRule, {
            element,
            message: t('rules.forms.accessibleAuthentication.message'),
            suggestion: t('rules.forms.accessibleAuthentication.suggestion'),
            remediationAdvice: t('rules.forms.accessibleAuthentication.remediation'),
            customIdPrefix: 'captcha',
          }),
        )
      })
    return violations
  },
}

export const contextualHelpRule: Rule = {
  id: 'contextual-help',
  nbrReference: '5.9.13',
  name: t('rules.forms.contextualHelp.name'),
  description: t('rules.forms.contextualHelp.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document
      .querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >(formFieldsSelector)
      .forEach((field) => {
        if (!isElementVisible(field as unknown as HTMLElement)) return
        const inputType = field instanceof HTMLInputElement ? field.type : ''
        const descriptor =
          `${getAssociatedLabelText(field)} ${field.getAttribute('name') || ''} ${field.getAttribute('id') || ''} ${field.getAttribute('placeholder') || ''}`.toLowerCase()
        const hasExplicitConstraint =
          inputType === 'password' ||
          field.hasAttribute('pattern') ||
          field.hasAttribute('minlength') ||
          field.hasAttribute('maxlength')
        const hasSensitivePurpose =
          /\b(cpf|cnpj|senha|password|cartao|cartão|codigo|código)\b/.test(descriptor)
        const isComplexField = hasExplicitConstraint || hasSensitivePurpose
        if (!isComplexField) return

        const associatedHelp = getAssociatedDescriptionText(field as unknown as HTMLElement)
        const nearbyText = getVisibleText(
          (field.closest('label, .field, .form-field, .ant-form-item') as HTMLElement | null) ||
            (field.parentElement as HTMLElement) ||
            (field as unknown as HTMLElement),
        )
        const helperText = `${associatedHelp} ${nearbyText} ${field.getAttribute('title') || ''} ${field.getAttribute('placeholder') || ''}`
        const hasHelp =
          Boolean(associatedHelp.trim()) ||
          /\b(ajuda|dica|formato|exemplo|mínimo|minimo|caracteres|obrigatório|obrigatorio)\b/i.test(
            helperText,
          )

        if (!hasHelp) {
          violations.push(
            createViolation(contextualHelpRule, {
              element: field as unknown as HTMLElement,
              message: t('rules.forms.contextualHelp.message'),
              suggestion: t('rules.forms.contextualHelp.suggestion'),
              remediationAdvice: t('rules.forms.contextualHelp.remediation'),
              customIdPrefix: 'contextual-help',
            }),
          )
        }
      })

    return violations
  },
}

export const submitButtonRule: Rule = {
  id: 'submit-button',
  nbrReference: '5.9.14',
  name: t('rules.forms.submitButton.name'),
  description: t('rules.forms.submitButton.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
      if (!isElementVisible(form)) return
      const hasDataFields = Boolean(form.querySelector(formFieldsSelector))
      if (!hasDataFields) return

      const submitControls = Array.from(
        form.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]'),
      ).filter(isElementVisible)
      const hasClearSubmit = submitControls.some((control) => {
        if (control instanceof HTMLInputElement && control.type === 'submit') return true
        const type = control.getAttribute('type')?.toLowerCase()
        const text = getVisibleText(control).toLowerCase()
        return (
          type === 'submit' ||
          /\b(enviar|salvar|confirmar|concluir|continuar|finalizar)\b/.test(text)
        )
      })

      if (!hasClearSubmit) {
        violations.push(
          createViolation(submitButtonRule, {
            element: form,
            message: t('rules.forms.submitButton.message'),
            suggestion: t('rules.forms.submitButton.suggestion'),
            remediationAdvice: t('rules.forms.submitButton.remediation'),
            customIdPrefix: 'submit-button',
          }),
        )
      }
    })

    return violations
  },
}

export const formRules: Rule[] = [
  fieldLabelRule,
  associatedFieldLabelRule,
  relatedFieldsRule,
  requiredFieldsRule,
  dataTypeRule,
  contextualHelpRule,
  submitButtonRule,
  accessibleAuthenticationRule,
]
