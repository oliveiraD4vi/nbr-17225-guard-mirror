import { t } from '@/i18n'
import type { Rule, Violation } from '@/types'
import { createViolation, getAccessibleName } from '@/utils'

function createWarnings(
  rule: Rule,
  elements: HTMLElement[],
  messageFactory: (element: HTMLElement) => string,
  suggestion: string,
  remediationAdvice: string,
  customIdPrefix: string,
): Violation[] {
  return elements.map((element) =>
    createViolation(rule, {
      element,
      message: messageFactory(element),
      suggestion,
      remediationAdvice,
      customIdPrefix,
    }),
  )
}

export const regionUsageRule: Rule = {
  id: 'region-usage',
  nbrReference: '5.4.2',
  name: t('rules.structureNavigationControls.regionUsage.name'),
  description: t('rules.structureNavigationControls.regionUsage.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const regions = document.querySelectorAll(
      'header, main, footer, nav, aside, section, article, [role]',
    )
    if (regions.length < 2) {
      return [
        createViolation(regionUsageRule, {
          element: document.body,
          message: t('rules.structureNavigationControls.regionUsage.message'),
          suggestion: t('rules.structureNavigationControls.regionUsage.suggestion'),
          remediationAdvice: t('rules.structureNavigationControls.regionUsage.remediation'),
          customIdPrefix: 'region-usage',
        }),
      ]
    }
    return []
  },
}

export const listUsageRule: Rule = {
  id: 'list-usage',
  nbrReference: '5.5.2',
  name: t('rules.structureNavigationControls.listUsage.name'),
  description: t('rules.structureNavigationControls.listUsage.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const violations: Violation[] = []
    document.querySelectorAll<HTMLElement>('div, section').forEach((container) => {
      const children = Array.from(container.children).filter((child) =>
        ['P', 'DIV', 'SPAN'].includes(child.tagName),
      )
      if (children.length >= 3 && !container.querySelector('ul, ol, dl')) {
        const bulletLike = children.filter((child) =>
          /^(\u2022|[-*]\s+|\d+[.)]\s+)/.test((child.textContent || '').trim()),
        )
        if (bulletLike.length >= 3) {
          violations.push(
            createViolation(listUsageRule, {
              element: container,
              message: t('rules.structureNavigationControls.listUsage.message'),
              suggestion: t('rules.structureNavigationControls.listUsage.suggestion'),
              remediationAdvice: t('rules.structureNavigationControls.listUsage.remediation'),
              customIdPrefix: 'list-usage',
            }),
          )
        }
      }
    })
    return violations
  },
}

export const tableUsageRule: Rule = {
  id: 'table-usage',
  nbrReference: '5.6.2',
  name: t('rules.structureNavigationControls.tableUsage.name'),
  description: t('rules.structureNavigationControls.tableUsage.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const violations: Violation[] = []
    document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
      const hasHeaders = !!table.querySelector('th, caption, thead')
      const hasManyControls =
        table.querySelectorAll('img, a, button').length >
        table.querySelectorAll('td, th').length / 2
      if (!hasHeaders && hasManyControls) {
        violations.push(
          createViolation(tableUsageRule, {
            element: table,
            message: t('rules.structureNavigationControls.tableUsage.message'),
            suggestion: t('rules.structureNavigationControls.tableUsage.suggestion'),
            remediationAdvice: t('rules.structureNavigationControls.tableUsage.remediation'),
            customIdPrefix: 'table-usage',
          }),
        )
      }
    })
    return violations
  },
}

export const linkUsageRule: Rule = {
  id: 'link-usage',
  nbrReference: '5.7.2',
  name: t('rules.structureNavigationControls.linkUsage.name'),
  description: t('rules.structureNavigationControls.linkUsage.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      linkUsageRule,
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).filter((anchor) => {
        const href = anchor.getAttribute('href') || ''
        return href === '#' || href.toLowerCase().startsWith('javascript:')
      }),
      () => t('rules.structureNavigationControls.linkUsage.message'),
      t('rules.structureNavigationControls.linkUsage.suggestion'),
      t('rules.structureNavigationControls.linkUsage.remediation'),
      'link-usage',
    ),
}

export const linkPurposeRule: Rule = {
  id: 'link-purpose',
  nbrReference: '5.7.4',
  name: t('rules.structureNavigationControls.linkPurpose.name'),
  description: t('rules.structureNavigationControls.linkPurpose.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const vagueTexts = ['clique aqui', 'saiba mais', 'mais', 'aqui', 'ver mais', 'leia mais']
    return createWarnings(
      linkPurposeRule,
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter((anchor) =>
        vagueTexts.includes(getAccessibleName(anchor).trim().toLowerCase()),
      ),
      (anchor) =>
        t('rules.structureNavigationControls.linkPurpose.message', {
          name: getAccessibleName(anchor),
        }),
      t('rules.structureNavigationControls.linkPurpose.suggestion'),
      t('rules.structureNavigationControls.linkPurpose.remediation'),
      'link-purpose',
    )
  },
}

export const navigationConsistencyRule: Rule = {
  id: 'navigation-consistency',
  nbrReference: '5.7.15',
  name: t('rules.structureNavigationControls.navigationConsistency.name'),
  description: t('rules.structureNavigationControls.navigationConsistency.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  auditScope: 'site',
  verificationMode: 'assisted',
  category: 'Semi-Automatizável',
  check: async () => {
    const navs = Array.from(document.querySelectorAll<HTMLElement>('nav, [role="navigation"]'))
    if (navs.length < 2) return []
    const signatures = navs.map((nav) =>
      Array.from(nav.querySelectorAll('a[href]'))
        .map((link) => getAccessibleName(link as HTMLElement).trim())
        .filter(Boolean)
        .join('|'),
    )
    return new Set(signatures).size > 1
      ? [
          createViolation(navigationConsistencyRule, {
            element: navs[0],
            message: t('rules.structureNavigationControls.navigationConsistency.message'),
            suggestion: t('rules.structureNavigationControls.navigationConsistency.suggestion'),
            remediationAdvice: t(
              'rules.structureNavigationControls.navigationConsistency.remediation',
            ),
            customIdPrefix: 'nav-consistency',
          }),
        ]
      : []
  },
}

export const helpConsistencyRule: Rule = {
  id: 'help-consistency',
  nbrReference: '5.7.16',
  name: t('rules.structureNavigationControls.helpConsistency.name'),
  description: t('rules.structureNavigationControls.helpConsistency.description'),
  severity: 'warning',
  wcagLevel: 'A',
  auditScope: 'site',
  verificationMode: 'assisted',
  category: 'Semi-Automatizável',
  check: async () => {
    const helpLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>('a[href], button'),
    ).filter((element) => {
      const text = getAccessibleName(element as HTMLElement).toLowerCase()
      return text.includes('ajuda') || text.includes('suporte') || text.includes('faq')
    })
    if (helpLinks.length > 1) {
      const labels = new Set(
        helpLinks.map((el) =>
          getAccessibleName(el as HTMLElement)
            .trim()
            .toLowerCase(),
        ),
      )
      if (labels.size > 1) {
        return [
          createViolation(helpConsistencyRule, {
            element: helpLinks[0] as unknown as HTMLElement,
            message: t('rules.structureNavigationControls.helpConsistency.message'),
            suggestion: t('rules.structureNavigationControls.helpConsistency.suggestion'),
            remediationAdvice: t('rules.structureNavigationControls.helpConsistency.remediation'),
            customIdPrefix: 'help-consistency',
          }),
        ]
      }
    }
    return []
  },
}

export const buttonUsageRule: Rule = {
  id: 'button-usage',
  nbrReference: '5.8.2',
  name: t('rules.structureNavigationControls.buttonUsage.name'),
  description: t('rules.structureNavigationControls.buttonUsage.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      buttonUsageRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('a[onclick], a[href="#"], a[href^="javascript:" i]'),
      ),
      () => t('rules.structureNavigationControls.buttonUsage.message'),
      t('rules.structureNavigationControls.buttonUsage.suggestion'),
      t('rules.structureNavigationControls.buttonUsage.remediation'),
      'button-usage',
    ),
}

export const buttonPurposeRule: Rule = {
  id: 'button-purpose',
  nbrReference: '5.8.3',
  name: t('rules.structureNavigationControls.buttonPurpose.name'),
  description: t('rules.structureNavigationControls.buttonPurpose.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () => {
    const vagueTexts = ['ok', 'ir', 'enviar', 'clique', 'mais']
    return createWarnings(
      buttonPurposeRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, [role="button"], input[type="button"], input[type="submit"]',
        ),
      ).filter((element) => vagueTexts.includes(getAccessibleName(element).trim().toLowerCase())),
      (element) =>
        t('rules.structureNavigationControls.buttonPurpose.message', {
          name: getAccessibleName(element),
        }),
      t('rules.structureNavigationControls.buttonPurpose.suggestion'),
      t('rules.structureNavigationControls.buttonPurpose.remediation'),
      'button-purpose',
    )
  },
}

export const buttonConsistencyRule: Rule = {
  id: 'button-consistency',
  nbrReference: '5.8.5',
  name: t('rules.structureNavigationControls.buttonConsistency.name'),
  description: t('rules.structureNavigationControls.buttonConsistency.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  auditScope: 'site',
  verificationMode: 'assisted',
  category: 'Semi-Automatizável',
  check: async () => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('button, [role="button"], a[href]'),
    )
    const byTarget = new Map<string, Set<string>>()
    buttons.forEach((button) => {
      const target = button.getAttribute('href') || button.getAttribute('data-action') || ''
      const name = getAccessibleName(button).trim()
      if (!target || !name) return
      if (!byTarget.has(target)) byTarget.set(target, new Set())
      byTarget.get(target)?.add(name.toLowerCase())
    })
    const inconsistent = Array.from(byTarget.entries()).find(([, names]) => names.size > 1)
    return inconsistent
      ? [
          createViolation(buttonConsistencyRule, {
            element: document.body,
            message: t('rules.structureNavigationControls.buttonConsistency.message', {
              target: inconsistent[0],
            }),
            suggestion: t('rules.structureNavigationControls.buttonConsistency.suggestion'),
            remediationAdvice: t('rules.structureNavigationControls.buttonConsistency.remediation'),
            customIdPrefix: 'button-consistency',
          }),
        ]
      : []
  },
}

export const contextChangeOnFocusRule: Rule = {
  id: 'context-change-focus',
  nbrReference: '5.8.9',
  name: t('rules.structureNavigationControls.contextChangeOnFocus.name'),
  description: t('rules.structureNavigationControls.contextChangeOnFocus.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      contextChangeOnFocusRule,
      Array.from(document.querySelectorAll<HTMLElement>('[onfocus], [autofocus]')),
      () => t('rules.structureNavigationControls.contextChangeOnFocus.message'),
      t('rules.structureNavigationControls.contextChangeOnFocus.suggestion'),
      t('rules.structureNavigationControls.contextChangeOnFocus.remediation'),
      'context-focus',
    ),
}

export const contextChangeOnInputRule: Rule = {
  id: 'context-change-input',
  nbrReference: '5.8.10',
  name: t('rules.structureNavigationControls.contextChangeOnInput.name'),
  description: t('rules.structureNavigationControls.contextChangeOnInput.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      contextChangeOnInputRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'select[onchange], input[onchange], textarea[onchange]',
        ),
      ),
      () => t('rules.structureNavigationControls.contextChangeOnInput.message'),
      t('rules.structureNavigationControls.contextChangeOnInput.suggestion'),
      t('rules.structureNavigationControls.contextChangeOnInput.remediation'),
      'context-input',
    ),
}

export const singlePointerRule: Rule = {
  id: 'single-pointer',
  nbrReference: '5.8.11',
  name: t('rules.structureNavigationControls.singlePointer.name'),
  description: t('rules.structureNavigationControls.singlePointer.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      singlePointerRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('[onmousedown], [onpointerdown], [ontouchstart]'),
      ),
      () => t('rules.structureNavigationControls.singlePointer.message'),
      t('rules.structureNavigationControls.singlePointer.suggestion'),
      t('rules.structureNavigationControls.singlePointer.remediation'),
      'single-pointer',
    ),
}

export const pointerGestureRule: Rule = {
  id: 'pointer-gesture',
  nbrReference: '5.8.12',
  name: t('rules.structureNavigationControls.pointerGesture.name'),
  description: t('rules.structureNavigationControls.pointerGesture.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      pointerGestureRule,
      Array.from(
        document.querySelectorAll<HTMLElement>(
          '[ontouchstart], [ontouchmove], [ongesturestart], [ongesturechange]',
        ),
      ),
      () => t('rules.structureNavigationControls.pointerGesture.message'),
      t('rules.structureNavigationControls.pointerGesture.suggestion'),
      t('rules.structureNavigationControls.pointerGesture.remediation'),
      'pointer-gesture',
    ),
}

export const dragMovementRule: Rule = {
  id: 'drag-movement',
  nbrReference: '5.8.13',
  name: t('rules.structureNavigationControls.dragMovement.name'),
  description: t('rules.structureNavigationControls.dragMovement.description'),
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      dragMovementRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('[draggable="true"], [ondragstart], [ondrop]'),
      ),
      () => t('rules.structureNavigationControls.dragMovement.message'),
      t('rules.structureNavigationControls.dragMovement.suggestion'),
      t('rules.structureNavigationControls.dragMovement.remediation'),
      'drag-movement',
    ),
}

export const motionOperationRule: Rule = {
  id: 'motion-operation',
  nbrReference: '5.8.14',
  name: t('rules.structureNavigationControls.motionOperation.name'),
  description: t('rules.structureNavigationControls.motionOperation.description'),
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  check: async () =>
    createWarnings(
      motionOperationRule,
      Array.from(
        document.querySelectorAll<HTMLElement>('[data-motion], [data-shake], [data-tilt]'),
      ),
      () => t('rules.structureNavigationControls.motionOperation.message'),
      t('rules.structureNavigationControls.motionOperation.suggestion'),
      t('rules.structureNavigationControls.motionOperation.remediation'),
      'motion-operation',
    ),
}

export const structuralNavigationControlRules: Rule[] = [
  regionUsageRule,
  listUsageRule,
  tableUsageRule,
  linkUsageRule,
  linkPurposeRule,
  navigationConsistencyRule,
  helpConsistencyRule,
  buttonUsageRule,
  buttonPurposeRule,
  buttonConsistencyRule,
  contextChangeOnFocusRule,
  contextChangeOnInputRule,
  singlePointerRule,
  pointerGestureRule,
  dragMovementRule,
  motionOperationRule,
]
