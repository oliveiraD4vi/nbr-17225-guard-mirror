import type { ManualFindingDraft, Rule, SeverityLevel, Violation, WCAGLevel } from '@/types'
import { getNormativeRuleType } from '@/normative'
import { isFullyAutomatedCategory } from '@/types'
import {
  MANUAL_FINDING_SELECTION_HOST_ID,
  MANUAL_FINDING_SELECTION_ID_PREFIX,
} from '@/utils/manual-findings'

/**
 * Utilitários gerais para a extensão
 */

export const VERIFIER_ID = 'NBR17225GUARD'
export const VERIFIER_NAME = 'Guardião NBR 17225'
const HIGHLIGHT_ID_PREFIX = 'nbr-highlight-'
const VISION_FILTER_HOST_ID = 'nbr-vision-filter-host'
const visuallyHiddenClassPattern =
  /\b(sr-only|screen-reader|screenreader|visually-hidden|hidden-visually|a11y-hidden)\b/i
const nonRenderableTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD'])

function hashString(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36)
}

/**
 * Gera um ID único para violações
 */
export function generateCustomId(prefix = '', seed?: string): string {
  if (seed) {
    return `${prefix || VERIFIER_ID.toLowerCase()}-${hashString(seed)}`
  }

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const getRandomChar = () => chars.charAt(Math.floor(Math.random() * chars.length))

  let result = ''
  for (let i = 0; i < 24; i++) {
    result += getRandomChar()
  }

  const formatted = `${result.slice(0, 4)}-${result.slice(4, 14)}-${result.slice(14, 24)}`
  return `${prefix || VERIFIER_ID.toLowerCase()}-${formatted}`
}

/**
 * Escapa caracteres HTML especiais
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Obtém o seletor CSS de um elemento
 */
export function getElementSelector(element: HTMLElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`

  const names: string[] = []
  while (element.parentElement) {
    if (element.id) {
      names.unshift(`#${CSS.escape(element.id)}`)
      break
    } else {
      if (element === element.ownerDocument.documentElement) {
        names.unshift(element.tagName.toLowerCase())
      } else {
        let index = 1
        let sibling = element.previousElementSibling

        while (sibling) {
          if (sibling.tagName === element.tagName) {
            index += 1
          }
          sibling = sibling.previousElementSibling
        }

        names.unshift(`${element.tagName.toLowerCase()}:nth-of-type(${index})`)
      }
      element = element.parentElement
    }
  }
  return names.join(' > ')
}

export function isGuardInjectedElement(element: Element | null): boolean {
  if (!element) return false
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false

  const ownId = element.id || ''
  if (
    ownId === VISION_FILTER_HOST_ID ||
    ownId === MANUAL_FINDING_SELECTION_HOST_ID ||
    ownId.startsWith(HIGHLIGHT_ID_PREFIX) ||
    ownId.startsWith(MANUAL_FINDING_SELECTION_ID_PREFIX)
  ) {
    return true
  }

  return !!element.closest?.(
    `#${VISION_FILTER_HOST_ID}, #${MANUAL_FINDING_SELECTION_HOST_ID}, [id^="${HIGHLIGHT_ID_PREFIX}"], [id^="${MANUAL_FINDING_SELECTION_ID_PREFIX}"]`,
  )
}

/**
 * Aguarda um elemento estar disponível no DOM
 */
export function waitForElement(selector: string, timeout = 5000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const element = document.querySelector(selector)
    if (element) {
      resolve(element as HTMLElement)
      return
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector)
      if (element) {
        observer.disconnect()
        resolve(element as HTMLElement)
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    setTimeout(() => {
      observer.disconnect()
      resolve(null)
    }, timeout)
  })
}

/**
 * Calcula a razão de contraste WCAG entre duas cores
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const getLuminance = (hex: string) => {
    const rgb = parseInt(hex.slice(1), 16)
    const r = (rgb >> 16) & 255
    const g = (rgb >> 8) & 255
    const b = rgb & 255

    const [rs, gs, bs] = [r, g, b].map((x) => {
      x = x / 255
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
    })

    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const l1 = getLuminance(hex1)
  const l2 = getLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Obtém a cor de fundo efetiva de um elemento
 */
export function getEffectiveBackgroundColor(element: HTMLElement): string {
  const parseRgbColor = (color: string) => {
    const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (!match) return null

    return {
      r: Number(match[1]),
      g: Number(match[2]),
      b: Number(match[3]),
      a: match[4] === undefined ? 1 : Number(match[4]),
    }
  }

  const blend = (
    foreground: { r: number; g: number; b: number; a: number },
    background: { r: number; g: number; b: number; a: number },
  ) => {
    const alpha = foreground.a + background.a * (1 - foreground.a)
    if (alpha === 0) return { r: 255, g: 255, b: 255, a: 1 }

    return {
      r: Math.round(
        (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
      ),
      g: Math.round(
        (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
      ),
      b: Math.round(
        (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
      ),
      a: alpha,
    }
  }

  let el: HTMLElement | null = element
  let effectiveColor = { r: 255, g: 255, b: 255, a: 1 }

  while (el) {
    const bgColor = window.getComputedStyle(el).backgroundColor
    const parsedColor = parseRgbColor(bgColor)
    if (parsedColor && parsedColor.a > 0) {
      effectiveColor = blend(parsedColor, effectiveColor)
      if (effectiveColor.a >= 1) break
    }
    el = el.parentElement
  }

  return `rgb(${effectiveColor.r}, ${effectiveColor.g}, ${effectiveColor.b})`
}

/**
 * Converte RGB para HEX
 */
export function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) return '#ffffff'

  const r = parseInt(match[1])
  const g = parseInt(match[2])
  const b = parseInt(match[3])

  return (
    '#' +
    [r, g, b]
      .map((x) => {
        const hex = x.toString(16)
        return hex.length === 1 ? `0${hex}` : hex
      })
      .join('')
  )
}

/**
 * Verifica se um elemento está visível
 */
export function isElementVisible(element: HTMLElement): boolean {
  if (!element) return false
  if (isGuardInjectedElement(element)) return false

  let current: HTMLElement | null = element
  while (current && current !== document.documentElement) {
    if (isGuardInjectedElement(current)) return false
    if (current.hidden || current.getAttribute('aria-hidden') === 'true') return false
    if (nonRenderableTags.has(current.tagName)) return false

    const style = window.getComputedStyle(current)
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      Number.parseFloat(style.opacity || '1') <= 0.01
    ) {
      return false
    }

    current = current.parentElement
  }

  const rect = element.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function isElementPerceptiblyVisible(element: HTMLElement): boolean {
  if (!isElementVisible(element)) return false

  let current: HTMLElement | null = element
  while (current && current !== document.documentElement) {
    const className =
      typeof current.className === 'string'
        ? current.className
        : current.getAttribute('class') || ''
    if (visuallyHiddenClassPattern.test(className)) return false

    const style = window.getComputedStyle(current)
    const rect = current.getBoundingClientRect()
    const clipValue = style.clip || ''
    const clipPathValue = style.clipPath || ''
    const isClipped =
      (!!clipValue && clipValue !== 'auto') ||
      (!!clipPathValue && clipPathValue !== 'none') ||
      (style.overflow === 'hidden' && rect.width <= 2 && rect.height <= 2)

    if (isClipped && rect.width <= 2 && rect.height <= 2) return false

    current = current.parentElement
  }

  const rect = element.getBoundingClientRect()
  if (rect.width <= 1 || rect.height <= 1) return false

  return true
}

/**
 * Obtém o texto visível de um elemento
 */
export function getVisibleText(element: HTMLElement): string {
  if (!element) return ''
  if (isGuardInjectedElement(element)) return ''
  if (element.hidden || element.getAttribute('aria-hidden') === 'true') return ''
  if (nonRenderableTags.has(element.tagName)) return ''

  const style = window.getComputedStyle(element)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return ''
  if (!isElementPerceptiblyVisible(element)) return ''

  let text = ''
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node instanceof HTMLElement) {
        text += getVisibleText(node)
      }
    }
  }

  return text.trim()
}

export function getAccessibleName(element: HTMLElement): string {
  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel?.trim()) return ariaLabel.trim()

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ')
      .trim()
    if (text) return text
  }

  if (element instanceof HTMLInputElement) {
    if (element.labels?.length) {
      const text = Array.from(element.labels)
        .map((label) => getVisibleText(label) || label.textContent?.trim() || '')
        .join(' ')
        .trim()
      if (text) return text
    }

    if (['button', 'submit', 'reset'].includes(element.type) && element.value?.trim()) {
      return element.value.trim()
    }

    if (element.placeholder?.trim()) return element.placeholder.trim()
  }

  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
    if (element.labels?.length) {
      const text = Array.from(element.labels)
        .map((label) => getVisibleText(label) || label.textContent?.trim() || '')
        .join(' ')
        .trim()
      if (text) return text
    }
  }

  const alt = element.getAttribute('alt')
  if (alt?.trim()) return alt.trim()

  const title = element.getAttribute('title')
  if (title?.trim()) return title.trim()

  const visibleText = getVisibleText(element)
  if (visibleText) return visibleText

  if (element.matches('button, a, [role="button"], [role="link"], [role="tab"]')) {
    const textContent = element.textContent?.replace(/\s+/g, ' ').trim()
    if (textContent) return textContent
  }

  return ''
}

export function getAssociatedLabelText(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): string {
  if (element.labels?.length) {
    return Array.from(element.labels)
      .map((label) => getVisibleText(label) || label.textContent?.trim() || '')
      .join(' ')
      .trim()
  }

  const ariaLabel = element.getAttribute('aria-label')
  if (ariaLabel?.trim()) return ariaLabel.trim()

  const labelledBy = element.getAttribute('aria-labelledby')
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ')
      .trim()
  }

  return ''
}

export function createViolation(
  rule: Pick<
    Rule,
    'id' | 'name' | 'nbrReference' | 'severity' | 'wcagLevel' | 'description' | 'category'
  >,
  options: {
    element?: HTMLElement
    message: string
    suggestion: string
    remediationAdvice: string
    snippet?: string
    description?: string
    severity?: SeverityLevel
    wcagLevel?: WCAGLevel
    customIdPrefix?: string
    contrastDetails?: Violation['contrastDetails']
    requiresHumanReview?: boolean
  },
): Violation {
  const element = options.element
  const selector = element ? getElementSelector(element) : undefined
  const requiresHumanReview =
    options.requiresHumanReview ?? !isFullyAutomatedCategory(rule.category)
  const stableSeed = [
    rule.id,
    selector || '',
    options.message,
    options.suggestion,
    options.description || rule.description,
  ].join('|')

  return {
    id: generateCustomId(rule.id, stableSeed),
    ruleId: rule.id,
    ruleName: rule.name,
    nbrReference: rule.nbrReference,
    description: options.description || rule.description,
    severity: options.severity || rule.severity,
    wcagLevel: options.wcagLevel || rule.wcagLevel,
    automationCategory: rule.category,
    normativeType: getNormativeRuleType(rule.nbrReference),
    requiresHumanReview,
    humanReviewStatus: requiresHumanReview ? 'pending' : 'not_applicable',
    findingOrigin: 'automatic',
    findingStatus: 'open',
    message: options.message,
    snippet: options.snippet || element?.outerHTML.substring(0, 200) || '<document>',
    suggestion: options.suggestion,
    remediationAdvice: options.remediationAdvice,
    elementSelector: selector,
    elementTagName: element ? element.tagName.toLowerCase() : undefined,
    elementAccessibleName: element ? getAccessibleName(element) || undefined : undefined,
    elementVisibleText: element ? getVisibleText(element) || undefined : undefined,
    contrastDetails: options.contrastDetails,
    customId: generateCustomId(options.customIdPrefix || rule.id, stableSeed),
  }
}

export function createManualViolation(
  rule: Pick<
    Rule,
    'id' | 'name' | 'nbrReference' | 'severity' | 'wcagLevel' | 'description' | 'category'
  >,
  options: {
    draft: ManualFindingDraft
    message: string
    suggestion: string
    remediationAdvice: string
    severity?: SeverityLevel
    userNote?: string
    createdAt?: number
  },
): Violation {
  const createdAt = options.createdAt ?? Date.now()
  const message = options.message.trim()
  const suggestion = options.suggestion.trim()
  const remediationAdvice = options.remediationAdvice.trim()
  const userNote = options.userNote?.trim() || undefined
  const stableSeed = [
    'manual',
    rule.id,
    options.draft.selector,
    message,
    options.draft.selectedAt,
  ].join('|')

  return {
    id: generateCustomId(`manual-${rule.id}`, stableSeed),
    ruleId: rule.id,
    ruleName: rule.name,
    nbrReference: rule.nbrReference,
    description: rule.description,
    severity: options.severity || rule.severity,
    wcagLevel: rule.wcagLevel,
    automationCategory: rule.category,
    normativeType: getNormativeRuleType(rule.nbrReference),
    requiresHumanReview: !isFullyAutomatedCategory(rule.category),
    humanReviewStatus: 'confirmed',
    findingOrigin: 'manual',
    findingStatus: 'confirmed',
    findingStatusUpdatedAt: createdAt,
    message,
    snippet: options.draft.snippet,
    suggestion,
    remediationAdvice,
    elementSelector: options.draft.selector,
    elementTagName: options.draft.tagName,
    elementAccessibleName: options.draft.accessibleName,
    elementVisibleText: options.draft.visibleText,
    userNote,
    noteUpdatedAt: userNote ? createdAt : undefined,
    customId: generateCustomId(`manual-${rule.id}`, stableSeed),
  }
}

export function getFocusableElements(root: ParentNode = document): HTMLElement[] {
  const selector = [
    'a[href]',
    'button',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    'summary',
    'iframe',
    '[tabindex]',
    '[contenteditable="true"]',
    '[role="button"]',
    '[role="link"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[role="tab"]',
  ].join(', ')

  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) => {
    if (!isElementVisible(element)) return false
    const tabIndex = element.getAttribute('tabindex')
    return tabIndex === null || Number(tabIndex) >= 0
  })
}

export function isElementFullyInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= window.innerHeight &&
    rect.right <= window.innerWidth
  )
}

export function isElementPartiallyInViewport(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  )
}

export function getElementLanguage(element: HTMLElement): string {
  return (
    element.getAttribute('lang') ||
    element.closest<HTMLElement>('[lang]')?.getAttribute('lang') ||
    ''
  )
}

export function getAssociatedDescriptionText(element: HTMLElement): string {
  const describedBy = element.getAttribute('aria-describedby')
  if (!describedBy) return ''

  return describedBy
    .split(/\s+/)
    .map((id) => document.getElementById(id)?.textContent?.trim() || '')
    .filter(Boolean)
    .join(' ')
    .trim()
}
