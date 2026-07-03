import type { ContrastContext } from '@/types'

export interface InlineStyleSnapshot {
  priority: string
  value: string
}

export function captureInlineStyle(
  style: CSSStyleDeclaration,
  property: string,
): InlineStyleSnapshot {
  return {
    value: style.getPropertyValue(property),
    priority: style.getPropertyPriority(property),
  }
}

export function applyInlinePreviewStyle(
  style: CSSStyleDeclaration,
  property: string,
  value: string,
): void {
  style.setProperty(property, value, 'important')
}

export function restoreInlineStyle(
  style: CSSStyleDeclaration,
  property: string,
  snapshot: InlineStyleSnapshot,
): void {
  if (snapshot.value) {
    style.setProperty(property, snapshot.value, snapshot.priority)
    return
  }
  style.removeProperty(property)
}

export function getContrastPreviewProperties(
  context: ContrastContext,
  graphicForegroundProperty?: string | null,
): { background: string; foreground: string } | null {
  if (context === 'text') return { foreground: 'color', background: 'background-color' }
  if (context === 'component') {
    return { foreground: 'border-color', background: 'background-color' }
  }
  if (context === 'focus') {
    return { foreground: 'outline-color', background: 'background-color' }
  }
  if (!graphicForegroundProperty) return null
  return { foreground: graphicForegroundProperty, background: 'background-color' }
}
