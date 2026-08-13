import { t } from '@/i18n'
import type { Rule, Violation } from '@/types'
import { createViolation, getAccessibleName, getVisibleText, isElementVisible } from '@/utils'

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

const isInternalLink = (anchor: HTMLAnchorElement): boolean => {
  const href = anchor.getAttribute('href')?.trim()
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false
  }

  try {
    return new URL(href, window.location.href).origin === window.location.origin
  } catch {
    return false
  }
}

const getNavigableUrl = (anchor: HTMLAnchorElement): URL | null => {
  const href = anchor.getAttribute('href')?.trim()
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null
  }

  try {
    return new URL(href, window.location.href)
  } catch {
    return null
  }
}

const isWebUrl = (url: URL): boolean => url.protocol === 'http:' || url.protocol === 'https:'

const isDocumentUrl = (url: URL): boolean => isWebUrl(url) || url.protocol === 'file:'

const getLinkText = (anchor: HTMLAnchorElement): string =>
  normalizeText(
    `${getAccessibleName(anchor)} ${getVisibleText(anchor)} ${anchor.getAttribute('title') || ''} ${anchor.getAttribute('aria-label') || ''}`,
  )

const getLinkIdentity = (anchor: HTMLAnchorElement): string => {
  const url = getNavigableUrl(anchor)
  return `${url?.origin || ''}${url?.pathname || ''}|${getLinkText(anchor)}`
}

const keepFirstOccurrence = <T extends HTMLElement>(
  elements: T[],
  getKey: (element: T) => string,
): T[] => {
  const seen = new Set<string>()

  return elements.filter((element) => {
    const key = getKey(element)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const fileExtensionPattern = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|xml|json)(?:$|[?#])/i

export const linkSemanticRule: Rule = {
  id: 'link-semantic',
  nbrReference: '5.7.1',
  name: t('rules.navigation.linkSemantic.name'),
  description: t('rules.navigation.linkSemantic.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []

    document.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
      if (!isElementVisible(anchor)) return

      const href = anchor.getAttribute('href')
      const name = getAccessibleName(anchor)

      if (!href || href.trim() === '') {
        violations.push(
          createViolation(linkSemanticRule, {
            element: anchor,
            message: t('rules.navigation.linkSemantic.hrefMessage'),
            suggestion: t('rules.navigation.linkSemantic.hrefSuggestion'),
            remediationAdvice: t('rules.navigation.linkSemantic.hrefRemediation'),
            customIdPrefix: 'link-href',
          }),
        )
      }

      if (!name.trim()) {
        violations.push(
          createViolation(linkSemanticRule, {
            element: anchor,
            message: t('rules.navigation.linkSemantic.nameMessage'),
            suggestion: t('rules.navigation.linkSemantic.nameSuggestion'),
            remediationAdvice: t('rules.navigation.linkSemantic.nameRemediation'),
            customIdPrefix: 'link-name',
          }),
        )
      }
    })

    return violations
  },
}

export const skipLinksRule: Rule = {
  id: 'skip-links',
  nbrReference: '5.7.12',
  name: t('rules.navigation.skipLinks.name'),
  description: t('rules.navigation.skipLinks.description'),
  severity: 'error',
  wcagLevel: 'A',
  category: 'Totalmente Automatizável',
  check: async (): Promise<Violation[]> => {
    const violations: Violation[] = []
    const skipLink = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')).find(
      (link) => {
        const text = getAccessibleName(link).toLowerCase()
        return text.includes('pular') || text.includes('conteúdo') || text.includes('conteudo')
      },
    )

    if (!skipLink) {
      violations.push(
        createViolation(skipLinksRule, {
          element: document.body,
          message: t('rules.navigation.skipLinks.message'),
          suggestion: t('rules.navigation.skipLinks.suggestion'),
          remediationAdvice: t('rules.navigation.skipLinks.remediation'),
          customIdPrefix: 'skip-link',
        }),
      )
    }

    return violations
  },
}

export const locationAlternativesRule: Rule = {
  id: 'location-alternatives',
  nbrReference: '5.7.13',
  name: t('rules.navigation.locationAlternatives.name'),
  description: t('rules.navigation.locationAlternatives.description'),
  severity: 'warning',
  wcagLevel: 'A',
  auditScope: 'site',
  verificationMode: 'assisted',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const internalLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[href]'),
    ).filter((anchor) => isElementVisible(anchor) && isInternalLink(anchor))
    const navigationBlocks = Array.from(
      document.querySelectorAll<HTMLElement>('nav, [role="navigation"]'),
    ).filter(isElementVisible)
    const hasSiteNavigation = navigationBlocks.length > 0 || internalLinks.length >= 8

    if (!hasSiteNavigation) return []

    const bodyText = normalizeText(getVisibleText(document.body).slice(0, 5000))
    const locationText = normalizeText(`${window.location.pathname} ${document.title} ${bodyText}`)
    const processPattern =
      /\b(checkout|pagamento|login|cadastro|formulario|inscricao|resultado|confirmacao|confirmar|etapa|passo|wizard)\b/

    if (processPattern.test(locationText)) return []

    const hasSearch = Array.from(
      document.querySelectorAll<HTMLElement>(
        'input[type="search"], [role="search"], form[role="search"], [aria-label*="buscar" i], [aria-label*="pesquisar" i], [aria-label*="search" i]',
      ),
    ).some((element) => {
      if (!isElementVisible(element)) return false
      const text = normalizeText(
        `${getAccessibleName(element)} ${element.getAttribute('placeholder') || ''}`,
      )
      return /\b(busca|buscar|pesquisa|pesquisar|search)\b/.test(text)
    })

    const hasBreadcrumb = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[aria-label*="breadcrumb" i], [aria-label*="trilha" i], [class*="breadcrumb" i], [data-testid*="breadcrumb" i]',
      ),
    ).some(isElementVisible)

    const hasSitemapOrIndex = internalLinks.some((anchor) => {
      const text = normalizeText(getAccessibleName(anchor))
      return /\b(mapa do site|sitemap|indice|sumario)\b/.test(text)
    })

    if (hasSearch || hasBreadcrumb || hasSitemapOrIndex) return []

    return [
      createViolation(locationAlternativesRule, {
        element: document.body,
        message: t('rules.navigation.locationAlternatives.message'),
        suggestion: t('rules.navigation.locationAlternatives.suggestion'),
        remediationAdvice: t('rules.navigation.locationAlternatives.remediation'),
        customIdPrefix: 'location-alternatives',
      }),
    ]
  },
}

export const newWindowLinkRule: Rule = {
  id: 'new-window-link',
  nbrReference: '5.7.6',
  name: t('rules.navigation.newWindowLink.name'),
  description: t('rules.navigation.newWindowLink.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const candidates = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]'),
    )
      .filter((anchor) => isElementVisible(anchor))
      .filter((anchor) => {
        const url = getNavigableUrl(anchor)
        if (!url || !isWebUrl(url)) return false
        const text = getLinkText(anchor)
        return !/\b(nova guia|nova janela|abre em outra|abre nova|new tab|new window)\b/.test(text)
      })

    return keepFirstOccurrence(candidates, getLinkIdentity).map((anchor) =>
      createViolation(newWindowLinkRule, {
        element: anchor,
        message: t('rules.navigation.newWindowLink.message'),
        suggestion: t('rules.navigation.newWindowLink.suggestion'),
        remediationAdvice: t('rules.navigation.newWindowLink.remediation'),
        customIdPrefix: 'new-window-link',
      }),
    )
  },
}

export const nonHtmlFileLinkRule: Rule = {
  id: 'non-html-file-link',
  nbrReference: '5.7.7',
  name: t('rules.navigation.nonHtmlFileLink.name'),
  description: t('rules.navigation.nonHtmlFileLink.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const candidates = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter((anchor) => isElementVisible(anchor))
      .filter((anchor) => {
        const url = getNavigableUrl(anchor)
        if (!url || !isDocumentUrl(url) || !fileExtensionPattern.test(url.pathname)) return false
        const text = getLinkText(anchor)
        return !/\b(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|csv|arquivo|download)\b/.test(text)
      })

    return keepFirstOccurrence(candidates, getLinkIdentity).map((anchor) =>
      createViolation(nonHtmlFileLinkRule, {
        element: anchor,
        message: t('rules.navigation.nonHtmlFileLink.message'),
        suggestion: t('rules.navigation.nonHtmlFileLink.suggestion'),
        remediationAdvice: t('rules.navigation.nonHtmlFileLink.remediation'),
        customIdPrefix: 'file-link',
      }),
    )
  },
}

export const externalLinkRule: Rule = {
  id: 'external-link',
  nbrReference: '5.7.8',
  name: t('rules.navigation.externalLink.name'),
  description: t('rules.navigation.externalLink.description'),
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  check: async (): Promise<Violation[]> => {
    const candidates = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter((anchor) => isElementVisible(anchor))
      .filter((anchor) => {
        const url = getNavigableUrl(anchor)
        if (!url || !isWebUrl(url) || url.origin === window.location.origin) return false
        const text = getLinkText(anchor)
        const host = normalizeText(url.hostname.replace(/^www\./, ''))
        const textExposesDestination = host.length > 3 && text.includes(host)
        return (
          !textExposesDestination &&
          !/\b(externo|site externo|fora do site|external|fora desta pagina|fora desta página)\b/.test(
            text,
          )
        )
      })

    return keepFirstOccurrence(candidates, getLinkIdentity).map((anchor) =>
      createViolation(externalLinkRule, {
        element: anchor,
        message: t('rules.navigation.externalLink.message', { host: anchor.hostname }),
        suggestion: t('rules.navigation.externalLink.suggestion'),
        remediationAdvice: t('rules.navigation.externalLink.remediation'),
        customIdPrefix: 'external-link',
      }),
    )
  },
}

export const navigationRules: Rule[] = [
  linkSemanticRule,
  newWindowLinkRule,
  nonHtmlFileLinkRule,
  externalLinkRule,
  skipLinksRule,
  locationAlternativesRule,
]
