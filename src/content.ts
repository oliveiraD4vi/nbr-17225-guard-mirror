import { t } from './i18n'
import { getRunnableRules } from './rules'
import type {
  AuditResult,
  ContrastPreviewItem,
  ContrastPreviewResult,
  ManualFindingElementDraft,
  Violation,
  VisionSimulationFilter,
} from './types'
import {
  getAccessibleName,
  getElementSelector,
  getVisibleText,
  isGuardInjectedElement,
  rgbToHex,
} from './utils'
import { MANUAL_FINDING_SELECTION_HOST_ID } from './utils/manual-findings'
import {
  applyInlinePreviewStyle,
  captureInlineStyle,
  getContrastPreviewProperties,
  type InlineStyleSnapshot,
  restoreInlineStyle,
} from './utils/contrast-preview'

const contentScope = globalThis as typeof globalThis & {
  __nbrGuardContentLoaded?: boolean
}

if (contentScope.__nbrGuardContentLoaded) {
  console.log('[Guardião NBR 17225] Content script já carregado')
} else {
  contentScope.__nbrGuardContentLoaded = true

  const VISION_FILTER_HOST_ID = 'nbr-vision-filter-host'
  const VISION_FILTER_IDS = {
    protanopia: 'nbr-protanopia-filter',
    deuteranopia: 'nbr-deuteranopia-filter',
    tritanopia: 'nbr-tritanopia-filter',
  } as const
  const manualSelectionOverlayZIndex = '2147483647'
  let manualSelectionHost: HTMLDivElement | null = null
  let manualSelectionHoverBox: HTMLDivElement | null = null
  let manualSelectionTarget: HTMLElement | null = null
  const contrastPreviewOriginalStyles = new Map<HTMLElement, Map<string, InlineStyleSnapshot>>()

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'contrast-preview-session') return
    port.onDisconnect.addListener(clearContrastPreviews)
  })

  window.addEventListener('pagehide', clearContrastPreviews)

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[Guardião NBR 17225] Mensagem recebida:', request.action)

    switch (request.action) {
      case 'PING':
        sendResponse({ status: 'OK' })
        break

      case 'RUN_AUDIT':
        runAuditInPage(
          Boolean(request.includeRecommendations),
          request.includeHumanReview !== false,
        )
          .then((result) => sendResponse({ result }))
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : t('content.unknownAuditError')
            sendResponse({ error: message })
          })
        return true

      case 'HIGHLIGHT_ALL_VIOLATIONS':
        highlightAllViolations(request.violations)
        sendResponse({ status: 'OK' })
        break

      case 'HIGHLIGHT_VIOLATION':
        highlightViolation(request.violation)
        sendResponse({ status: 'OK' })
        break

      case 'CLEAR_HIGHLIGHTS':
        clearHighlights()
        sendResponse({ status: 'OK' })
        break

      case 'SYNC_CONTRAST_PREVIEWS':
        sendResponse({ status: 'OK', result: syncContrastPreviews(request.previews) })
        break

      case 'CLEAR_CONTRAST_PREVIEWS':
        clearContrastPreviews()
        sendResponse({ status: 'OK' })
        break

      case 'APPLY_VISION_FILTER':
        applyVisionFilter(request.filter)
        sendResponse({ status: 'OK' })
        break

      case 'START_MANUAL_FINDING_SELECTION':
        try {
          startManualFindingSelection()
          sendResponse({ status: 'OK' })
        } catch (error) {
          const message = error instanceof Error ? error.message : t('content.manualSelectionError')
          sendResponse({ error: message })
        }
        break

      case 'CANCEL_MANUAL_FINDING_SELECTION':
        stopManualFindingSelection()
        sendResponse({ status: 'OK' })
        break

      case 'RESOLVE_MANUAL_FINDING_SELECTORS':
        sendResponse({
          status: 'OK',
          resolved: resolveManualFindingSelectors(request.candidates),
        })
        break

      default:
        sendResponse({ status: 'UNKNOWN_ACTION' })
    }

    return true
  })

  function highlightAllViolations(violations: Violation[]) {
    clearHighlights()
    violations.forEach((violation) => renderViolationHighlight(violation))
  }

  async function runAuditInPage(
    includeRecommendations: boolean,
    includeHumanReview: boolean,
  ): Promise<AuditResult> {
    await ensureDocumentReady()
    clearContrastPreviews()
    clearHighlights()
    await waitForAuditStability()

    const violations: Violation[] = []
    const rulesToRun = getRunnableRules(includeRecommendations, includeHumanReview)

    for (const rule of rulesToRun) {
      try {
        const ruleViolations = await rule.check()
        violations.push(...ruleViolations)
      } catch (error) {
        console.error(`[Guardião NBR 17225] Erro na regra ${rule.id}:`, error)
      }
    }

    const dedupedViolations = dedupeViolations(violations).filter(
      (violation) => includeHumanReview || !violation.requiresHumanReview,
    )

    const violationsByRule = dedupedViolations.reduce<Record<string, Violation[]>>(
      (acc, violation) => {
        acc[violation.ruleId] ??= []
        acc[violation.ruleId].push(violation)
        return acc
      },
      {},
    )

    const violationsBySeverity = dedupedViolations.reduce<Record<'error' | 'warning', Violation[]>>(
      (acc, violation) => {
        acc[violation.severity].push(violation)
        return acc
      },
      { error: [], warning: [] },
    )
    const requirementViolations = dedupedViolations.filter(
      (violation) => violation.normativeType === 'Requisito',
    )
    const recommendationViolations = dedupedViolations.filter(
      (violation) => violation.normativeType === 'Recomendação',
    )
    const humanReviewItems = dedupedViolations.filter(
      (violation) => violation.requiresHumanReview,
    ).length
    const automatedFindings = dedupedViolations.length - humanReviewItems

    return {
      violations: dedupedViolations,
      totalViolations: dedupedViolations.length,
      errors: requirementViolations.length,
      warnings: recommendationViolations.length,
      humanReviewItems,
      automatedFindings,
      timestamp: Date.now(),
      url: window.location.href,
      pageTitle: document.title,
      includeRecommendations,
      includeHumanReview,
      violationsByRule,
      violationsBySeverity,
    }
  }

  function dedupeViolations(violations: Violation[]): Violation[] {
    const seen = new Set<string>()

    return violations.filter((violation) => {
      const signature = [
        violation.ruleId,
        violation.elementSelector || '',
        violation.message,
        violation.suggestion,
      ].join('|')

      if (seen.has(signature)) {
        return false
      }

      seen.add(signature)
      return true
    })
  }

  function highlightViolation(violation: Violation) {
    clearHighlights()

    const existingHighlight = document.getElementById(`nbr-highlight-${violation.customId}`)
    if (existingHighlight) return

    renderViolationHighlight(violation, true)

    if (!violation.elementSelector) return

    const element = document.querySelector(violation.elementSelector)
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  function renderViolationHighlight(violation: Violation, startOpen = false) {
    try {
      if (!violation.elementSelector) return

      const element = document.querySelector(violation.elementSelector)
      if (!(element instanceof HTMLElement)) {
        console.warn('[Guardião NBR 17225] Elemento não encontrado:', violation.elementSelector)
        return
      }

      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return

      const verticalPosition = rect.top < 88 ? 'bottom' : 'top'
      const horizontalPosition =
        rect.left < 180 ? 'left' : window.innerWidth - rect.right < 180 ? 'right' : 'center'

      const shadowHost = document.createElement('div')
      shadowHost.id = `nbr-highlight-${violation.customId}`
      shadowHost.style.position = 'absolute'
      shadowHost.style.pointerEvents = 'none'
      shadowHost.style.zIndex = '999999'

      const shadowRoot = shadowHost.attachShadow({ mode: 'open' })
      const style = document.createElement('style')
      style.textContent = `
        :host {
          --highlight-color: ${violation.severity === 'error' ? '#dc2626' : '#d97706'};
          --highlight-soft: ${violation.severity === 'error' ? 'rgba(220, 38, 38, 0.14)' : 'rgba(217, 119, 6, 0.16)'};
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .highlight-box {
          position: absolute;
          inset: 0;
          border: 2px dashed var(--highlight-color);
          border-radius: 6px;
          pointer-events: auto;
          box-sizing: border-box;
          background: var(--highlight-soft);
        }

        .highlight-icon {
          position: absolute;
          top: -12px;
          right: -12px;
          width: 26px;
          height: 26px;
          border: 0;
          background: var(--highlight-color);
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 700;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.18);
          cursor: pointer;
          pointer-events: auto;
        }

        .tooltip {
          position: absolute;
          min-width: 220px;
          max-width: 300px;
          padding: 10px 12px;
          border-radius: 8px;
          background: #0f172a;
          color: white;
          font-size: 12px;
          line-height: 1.45;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.24);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s ease;
          z-index: 1000;
        }

        .tooltip.open {
          opacity: 1;
          visibility: visible;
        }

        .tooltip.position-top {
          bottom: calc(100% + 10px);
        }

        .tooltip.position-bottom {
          top: calc(100% + 10px);
        }

        .tooltip.position-left {
          left: 0;
          transform: translateY(0);
        }

        .tooltip.position-center {
          left: 50%;
          transform: translateX(-50%);
        }

        .tooltip.position-right {
          right: 0;
          transform: translateY(0);
        }

        .tooltip.position-top.position-center.open {
          transform: translateX(-50%) translateY(-2px);
        }

        .tooltip.position-bottom.position-center.open {
          transform: translateX(-50%) translateY(2px);
        }

        .tooltip.position-top.position-left.open,
        .tooltip.position-top.position-right.open {
          transform: translateY(-2px);
        }

        .tooltip.position-bottom.position-left.open,
        .tooltip.position-bottom.position-right.open {
          transform: translateY(2px);
        }

        .tooltip-title {
          display: block;
          margin-bottom: 4px;
          font-weight: 700;
        }

        .tooltip-meta {
          display: block;
          color: rgba(255, 255, 255, 0.72);
        }
      `

      const highlightBox = document.createElement('div')
      highlightBox.className = 'highlight-box'

      const icon = document.createElement('button')
      icon.className = 'highlight-icon'
      icon.type = 'button'
      icon.textContent = violation.severity === 'error' ? '!' : '?'
      icon.setAttribute(
        'aria-label',
        t('content.highlightAriaLabel', { ruleName: violation.ruleName }),
      )

      const tooltip = document.createElement('div')
      tooltip.className = `tooltip position-${verticalPosition} position-${horizontalPosition}`
      tooltip.innerHTML = `
        <span class="tooltip-title">${violation.ruleName}</span>
        <span class="tooltip-meta">${t('content.highlightMeta', {
          reference: violation.nbrReference,
          severity: violation.normativeType,
        })}</span>
      `

      let pinnedOpen = startOpen

      const syncTooltipVisibility = (forceOpen?: boolean) => {
        const isOpen = typeof forceOpen === 'boolean' ? forceOpen : pinnedOpen
        tooltip.classList.toggle('open', isOpen)
      }

      icon.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        pinnedOpen = !pinnedOpen
        syncTooltipVisibility()
      })

      highlightBox.addEventListener('mouseenter', () => {
        syncTooltipVisibility(true)
      })

      highlightBox.addEventListener('mouseleave', () => {
        syncTooltipVisibility(pinnedOpen)
      })

      highlightBox.appendChild(icon)
      highlightBox.appendChild(tooltip)
      shadowRoot.appendChild(style)
      shadowRoot.appendChild(highlightBox)

      shadowHost.style.left = `${window.scrollX + rect.left}px`
      shadowHost.style.top = `${window.scrollY + rect.top}px`
      shadowHost.style.width = `${rect.width}px`
      shadowHost.style.height = `${rect.height}px`

      document.body.appendChild(shadowHost)
      if (startOpen) syncTooltipVisibility(true)
    } catch (error) {
      console.error('[Guardião NBR 17225] Erro ao destacar violação:', error)
    }
  }

  function clearHighlights() {
    const highlights = document.querySelectorAll('[id^="nbr-highlight-"]')
    highlights.forEach((highlight) => highlight.remove())
  }

  function rememberContrastPreviewStyle(element: HTMLElement, property: string) {
    let originalStyles = contrastPreviewOriginalStyles.get(element)
    if (!originalStyles) {
      originalStyles = new Map()
      contrastPreviewOriginalStyles.set(element, originalStyles)
    }
    if (originalStyles.has(property)) return

    originalStyles.set(property, captureInlineStyle(element.style, property))
  }

  function setContrastPreviewStyle(element: HTMLElement, property: string, value: string) {
    rememberContrastPreviewStyle(element, property)
    applyInlinePreviewStyle(element.style, property, value)
  }

  function getGraphicForegroundProperty(element: HTMLElement, expectedHex: string): string | null {
    const style = window.getComputedStyle(element)
    const properties = ['fill', 'stroke', 'color'] as const
    const normalizedExpected = expectedHex.toLowerCase()

    const exactProperty = properties.find((property) => {
      const value = style.getPropertyValue(property)
      if (!value || value === 'none' || value === 'transparent') return false
      return rgbToHex(value).toLowerCase() === normalizedExpected
    })
    if (exactProperty) return exactProperty

    return (
      properties.find((property) => {
        const value = style.getPropertyValue(property)
        return Boolean(value && value !== 'none' && value !== 'transparent')
      }) ?? null
    )
  }

  function applyContrastPreview(element: HTMLElement, preview: ContrastPreviewItem): boolean {
    if (isGuardInjectedElement(element)) return false

    const graphicProperty =
      preview.context === 'graphic'
        ? getGraphicForegroundProperty(element, preview.foregroundHex)
        : undefined
    const properties = getContrastPreviewProperties(preview.context, graphicProperty)
    if (!properties) return false

    setContrastPreviewStyle(element, properties.foreground, preview.foregroundHex)
    setContrastPreviewStyle(element, properties.background, preview.backgroundHex)
    return true
  }

  function syncContrastPreviews(
    previews: ContrastPreviewItem[] | undefined,
  ): ContrastPreviewResult {
    clearContrastPreviews()
    const result: ContrastPreviewResult = { applied: 0, missing: 0, unsupported: 0 }

    for (const preview of previews ?? []) {
      if (!preview?.selector) {
        result.missing += 1
        continue
      }

      let element: HTMLElement | null = null
      try {
        element = document.querySelector<HTMLElement>(preview.selector)
      } catch {
        result.missing += 1
        continue
      }

      if (!element) {
        result.missing += 1
        continue
      }

      if (applyContrastPreview(element, preview)) result.applied += 1
      else result.unsupported += 1
    }

    return result
  }

  function clearContrastPreviews() {
    contrastPreviewOriginalStyles.forEach((properties, element) => {
      properties.forEach((original, property) => {
        restoreInlineStyle(element.style, property, original)
      })
    })
    contrastPreviewOriginalStyles.clear()
  }

  function startManualFindingSelection() {
    if (!document.body) {
      throw new Error(t('content.manualSelectionUnavailable'))
    }

    clearHighlights()
    stopManualFindingSelection()

    const host = document.createElement('div')
    host.id = MANUAL_FINDING_SELECTION_HOST_ID
    host.style.position = 'fixed'
    host.style.inset = '0'
    host.style.zIndex = manualSelectionOverlayZIndex
    host.style.pointerEvents = 'none'

    const shadowRoot = host.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = `
      :host {
        color-scheme: light;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .selection-instruction {
        position: fixed;
        top: 16px;
        left: 50%;
        max-width: min(560px, calc(100vw - 32px));
        transform: translateX(-50%);
        display: grid;
        gap: 4px;
        padding: 12px 16px;
        border-radius: 12px;
        background: #0f172a;
        color: #ffffff;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.28);
        pointer-events: none;
        text-align: center;
      }

      .selection-instruction strong {
        font-size: 14px;
        line-height: 1.35;
      }

      .selection-instruction span {
        color: rgba(255, 255, 255, 0.78);
        font-size: 12px;
        line-height: 1.45;
      }

      .selection-hover {
        position: fixed;
        display: none;
        border: 2px solid #2563eb;
        border-radius: 8px;
        background: rgba(37, 99, 235, 0.12);
        box-shadow:
          0 0 0 9999px rgba(15, 23, 42, 0.18),
          0 12px 30px rgba(37, 99, 235, 0.2);
        box-sizing: border-box;
        pointer-events: none;
      }
    `

    const instruction = document.createElement('div')
    instruction.className = 'selection-instruction'

    const title = document.createElement('strong')
    title.textContent = t('content.manualSelectionTitle')

    const description = document.createElement('span')
    description.textContent = t('content.manualSelectionDescription')

    const hoverBox = document.createElement('div')
    hoverBox.className = 'selection-hover'

    instruction.appendChild(title)
    instruction.appendChild(description)
    shadowRoot.appendChild(style)
    shadowRoot.appendChild(hoverBox)
    shadowRoot.appendChild(instruction)

    document.body.appendChild(host)
    manualSelectionHost = host
    manualSelectionHoverBox = hoverBox

    document.addEventListener('mousemove', handleManualFindingMouseMove, true)
    document.addEventListener('click', handleManualFindingClick, true)
    document.addEventListener('keydown', handleManualFindingKeydown, true)
    window.addEventListener('scroll', handleManualFindingViewportChange, true)
    window.addEventListener('resize', handleManualFindingViewportChange, true)
  }

  function stopManualFindingSelection() {
    document.removeEventListener('mousemove', handleManualFindingMouseMove, true)
    document.removeEventListener('click', handleManualFindingClick, true)
    document.removeEventListener('keydown', handleManualFindingKeydown, true)
    window.removeEventListener('scroll', handleManualFindingViewportChange, true)
    window.removeEventListener('resize', handleManualFindingViewportChange, true)

    manualSelectionHost?.remove()
    manualSelectionHost = null
    manualSelectionHoverBox = null
    manualSelectionTarget = null
  }

  function handleManualFindingMouseMove(event: MouseEvent) {
    const target = getManualFindingSelectableElement(event.target)
    setManualFindingSelectionTarget(target)
  }

  function handleManualFindingClick(event: MouseEvent) {
    const target = manualSelectionTarget ?? getManualFindingSelectableElement(event.target)
    if (!target) return

    event.preventDefault()
    event.stopImmediatePropagation()

    const draft = createManualFindingDraft(target)
    stopManualFindingSelection()

    void chrome.runtime
      .sendMessage({
        action: 'STORE_MANUAL_FINDING_DRAFT',
        draft,
      })
      .catch((error: unknown) => {
        console.error('[Guardião NBR 17225] Erro ao salvar rascunho do achado manual:', error)
      })
  }

  function handleManualFindingKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return

    event.preventDefault()
    event.stopImmediatePropagation()
    stopManualFindingSelection()

    void chrome.runtime.sendMessage({ action: 'CLEAR_MANUAL_FINDING_DRAFT' }).catch(() => undefined)
  }

  function handleManualFindingViewportChange() {
    setManualFindingSelectionTarget(manualSelectionTarget)
  }

  function getManualFindingSelectableElement(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof Element)) return null

    let element: Element | null = target
    while (element && !(element instanceof HTMLElement)) {
      element = element.parentElement
    }

    if (!(element instanceof HTMLElement)) return null
    if (isGuardInjectedElement(element)) return null
    if (element === document.documentElement) return null

    return element
  }

  function setManualFindingSelectionTarget(target: HTMLElement | null) {
    manualSelectionTarget = target

    if (!manualSelectionHoverBox || !target) {
      if (manualSelectionHoverBox) manualSelectionHoverBox.style.display = 'none'
      return
    }

    const rect = target.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) {
      manualSelectionHoverBox.style.display = 'none'
      return
    }

    manualSelectionHoverBox.style.display = 'block'
    manualSelectionHoverBox.style.left = `${rect.left}px`
    manualSelectionHoverBox.style.top = `${rect.top}px`
    manualSelectionHoverBox.style.width = `${rect.width}px`
    manualSelectionHoverBox.style.height = `${rect.height}px`
  }

  function compactManualFindingText(value: string, maxLength: number): string {
    const compacted = value.replace(/\s+/g, ' ').trim()
    if (compacted.length <= maxLength) return compacted
    return `${compacted.slice(0, maxLength - 1).trimEnd()}…`
  }

  function createManualFindingDraft(element: HTMLElement): ManualFindingElementDraft {
    return {
      ...createManualFindingElementSnapshot(element),
      url: window.location.href,
      pageTitle: document.title || undefined,
      selectedAt: Date.now(),
    }
  }

  function createManualFindingElementSnapshot(element: HTMLElement) {
    return {
      selector: getElementSelector(element),
      tagName: element.tagName.toLowerCase(),
      snippet: compactManualFindingText(
        element.outerHTML || `<${element.tagName.toLowerCase()}>`,
        500,
      ),
      accessibleName: compactManualFindingText(getAccessibleName(element), 300) || undefined,
      visibleText: compactManualFindingText(getVisibleText(element), 300) || undefined,
    }
  }

  function resolveManualFindingSelectors(
    candidates: unknown,
  ): Array<ReturnType<typeof createManualFindingElementSnapshot> & { id: string }> {
    if (!Array.isArray(candidates)) return []

    return candidates.flatMap((candidate) => {
      if (!candidate || typeof candidate !== 'object') return []

      const { id, selector } = candidate as { id?: unknown; selector?: unknown }
      if (typeof id !== 'string' || typeof selector !== 'string' || !selector.trim()) return []

      try {
        const element = document.querySelector(selector)
        if (!(element instanceof HTMLElement) || isGuardInjectedElement(element)) return []

        return [{ id, ...createManualFindingElementSnapshot(element) }]
      } catch {
        return []
      }
    })
  }

  function applyVisionFilter(filter: VisionSimulationFilter) {
    try {
      if (!document.body) return

      ensureVisionFilterDefs()

      const target = document.documentElement
      if (!filter || filter.type === 'none') {
        target.style.filter = 'none'
        return
      }

      switch (filter.type) {
        case 'protanopia':
        case 'deuteranopia':
        case 'tritanopia':
          target.style.filter = `url(#${VISION_FILTER_IDS[filter.type]})`
          break
        case 'blur':
          target.style.filter = `blur(${(filter.intensity / 100) * 10}px)`
          break
      }
    } catch (error) {
      console.error('[Guardião NBR 17225] Erro ao aplicar simulador de visão:', error)
    }
  }

  function ensureVisionFilterDefs() {
    if (document.getElementById(VISION_FILTER_HOST_ID)) return

    const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    host.setAttribute('id', VISION_FILTER_HOST_ID)
    host.setAttribute('aria-hidden', 'true')
    host.style.position = 'absolute'
    host.style.width = '0'
    host.style.height = '0'
    host.style.pointerEvents = 'none'

    host.innerHTML = `
      <defs>
        <filter id="${VISION_FILTER_IDS.protanopia}" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" values="0.567 0.433 0 0 0 0.558 0.442 0 0 0 0 0.242 0.758 0 0 0 0 0 1 0" />
        </filter>
        <filter id="${VISION_FILTER_IDS.deuteranopia}" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" values="0.625 0.375 0 0 0 0.7 0.3 0 0 0 0 0.3 0.7 0 0 0 0 0 1 0" />
        </filter>
        <filter id="${VISION_FILTER_IDS.tritanopia}" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" values="0.95 0.05 0 0 0 0 0.433 0.567 0 0 0 0.475 0.525 0 0 0 0 0 1 0" />
        </filter>
      </defs>
    `

    document.body.appendChild(host)
  }

  function ensureDocumentReady(): Promise<void> {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true })
    })
  }

  async function waitForAuditStability(): Promise<void> {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )

    await new Promise<void>((resolve) => {
      let settled = false
      let settleTimer = window.setTimeout(finish, 300)
      const timeoutId = window.setTimeout(finish, 1500)
      const observer = new MutationObserver(() => {
        window.clearTimeout(settleTimer)
        settleTimer = window.setTimeout(finish, 300)
      })

      function finish() {
        if (settled) return
        settled = true
        observer.disconnect()
        window.clearTimeout(settleTimer)
        window.clearTimeout(timeoutId)
        resolve()
      }

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      })
    })
  }

  console.log('[Guardião NBR 17225] Content script carregado')
}
