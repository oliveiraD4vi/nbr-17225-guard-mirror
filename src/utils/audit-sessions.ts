import type {
  AuditResult,
  JourneyAuditSession,
  JourneyAuditStep,
  PageAuditContext,
  SessionReviewCandidate,
  SiteAuditPage,
  SiteAuditSession,
} from '@/types'
import { extensionStorageGet, extensionStorageSet } from '@/utils/extension-storage'

const emptyPageContext: PageAuditContext = {
  navigationSignatures: [],
  helpSignatures: [],
  locationMechanisms: [],
  controlActions: [],
  criticalActions: [],
  formFieldKeys: [],
  hasReviewCue: false,
}

function createSessionId(prefix: 'site' | 'journey'): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function getOrigin(url: string): string {
  try {
    return new URL(url).origin
  } catch {
    return url
  }
}

function toSitePage(result: AuditResult, context: PageAuditContext): SiteAuditPage {
  return {
    url: result.url,
    pageTitle: result.pageTitle,
    auditedAt: result.timestamp,
    context,
  }
}

function getPrimaryNavigationSignature(page: SiteAuditPage): string {
  return (
    [...(page.context?.navigationSignatures ?? [])].sort(
      (left, right) => right.split('|').length - left.split('|').length,
    )[0] ?? ''
  )
}

export function buildSiteReviewCandidates(pages: SiteAuditPage[]): SessionReviewCandidate[] {
  if (pages.length < 2) return []

  const candidates: SessionReviewCandidate[] = []
  const pagesWithoutLocationAlternatives = pages.filter(
    (page) => (page.context?.locationMechanisms.length ?? 0) < 2,
  )
  if (pagesWithoutLocationAlternatives.length > 0) {
    candidates.push({
      ruleId: 'location-alternatives',
      nbrReference: '5.7.13',
      summary: `${pagesWithoutLocationAlternatives.length} página(s) da sessão apresentam menos de duas formas observáveis de localização de conteúdo.`,
      reviewQuestion:
        'As páginas equivalentes oferecem mais de uma forma adequada de localizar conteúdo?',
    })
  }

  const navigationSignatures = new Set(pages.map(getPrimaryNavigationSignature).filter(Boolean))
  if (navigationSignatures.size > 1) {
    candidates.push({
      ruleId: 'navigation-consistency',
      nbrReference: '5.7.15',
      summary: 'A navegação principal observada varia entre páginas da mesma sessão de site.',
      reviewQuestion:
        'A variação observada preserva ordem, identificação e finalidade consistentes?',
    })
  }

  const helpSignatures = new Set(
    pages.map((page) => (page.context?.helpSignatures ?? []).join('|')),
  )
  if (helpSignatures.size > 1) {
    candidates.push({
      ruleId: 'help-consistency',
      nbrReference: '5.7.16',
      summary: 'Os mecanismos de ajuda observados variam entre páginas da mesma sessão de site.',
      reviewQuestion: 'Os mecanismos de ajuda aparecem em ordem e posição consistentes?',
    })
  }

  const namesByAction = new Map<string, Set<string>>()
  const pagesByAction = new Map<string, Set<string>>()
  pages.forEach((page) => {
    ;(page.context?.controlActions ?? []).forEach(({ action, name }) => {
      namesByAction.set(action, namesByAction.get(action) ?? new Set())
      pagesByAction.set(action, pagesByAction.get(action) ?? new Set())
      namesByAction.get(action)?.add(name)
      pagesByAction.get(action)?.add(page.url)
    })
  })
  const inconsistentAction = [...namesByAction.entries()].find(
    ([action, names]) => names.size > 1 && (pagesByAction.get(action)?.size ?? 0) > 1,
  )
  if (inconsistentAction) {
    candidates.push({
      ruleId: 'button-consistency',
      nbrReference: '5.8.5',
      summary: `A ação “${inconsistentAction[0]}” recebeu nomes diferentes em páginas da mesma sessão.`,
      reviewQuestion:
        'Os controles com a mesma funcionalidade são identificados de forma consistente?',
    })
  }

  return candidates
}

export async function recordSiteAuditPage(
  result: AuditResult,
  context: PageAuditContext,
): Promise<SiteAuditSession> {
  const origin = getOrigin(result.url)
  const storage = await extensionStorageGet(['siteAuditSessionsByOrigin'])
  const sessions =
    (storage.siteAuditSessionsByOrigin as Record<string, SiteAuditSession> | undefined) ?? {}
  const current = sessions[origin]
  const now = Date.now()
  const pages = new Map<string, SiteAuditPage>()

  current?.pages.forEach((page) =>
    pages.set(page.url, { ...page, context: page.context ?? emptyPageContext }),
  )
  pages.set(result.url, toSitePage(result, context))
  const sortedPages = [...pages.values()].sort((left, right) => left.auditedAt - right.auditedAt)

  const session: SiteAuditSession = {
    id: current?.id ?? createSessionId('site'),
    origin,
    startedAt: current?.startedAt ?? now,
    updatedAt: now,
    pages: sortedPages,
    reviewCandidates: buildSiteReviewCandidates(sortedPages),
  }

  await extensionStorageSet({
    siteAuditSessionsByOrigin: {
      ...sessions,
      [origin]: session,
    },
  })

  return session
}

function toJourneyStep(result: AuditResult, context: PageAuditContext): JourneyAuditStep {
  return {
    id: `step-${crypto.randomUUID()}`,
    url: result.url,
    pageTitle: result.pageTitle,
    label: result.pageTitle?.trim() || `Etapa em ${result.url}`,
    recordedAt: result.timestamp,
    evidenceSelectors: [
      ...new Set(result.violations.map((item) => item.elementSelector).filter(Boolean)),
    ].slice(0, 20) as string[],
    context,
  }
}

export function buildJourneyReviewCandidates(steps: JourneyAuditStep[]): SessionReviewCandidate[] {
  const candidates: SessionReviewCandidate[] = []
  const criticalStep = steps.find(
    (step) => (step.context?.criticalActions.length ?? 0) > 0 && !step.context?.hasReviewCue,
  )
  if (criticalStep) {
    candidates.push({
      ruleId: 'critical-form-prevention',
      nbrReference: '5.9.12',
      summary: `A etapa “${criticalStep.label}” contém ação crítica sem indício observado de revisão, confirmação ou reversão.`,
      reviewQuestion:
        'A jornada permite revisar, confirmar ou reverter a operação antes da conclusão?',
    })
  }

  const stepsByField = new Map<string, Set<string>>()
  steps.forEach((step) => {
    ;(step.context?.formFieldKeys ?? []).forEach((key) => {
      stepsByField.set(key, stepsByField.get(key) ?? new Set())
      stepsByField.get(key)?.add(step.id)
    })
  })
  const repeatedField = [...stepsByField.entries()].find(([, stepIds]) => stepIds.size > 1)
  if (repeatedField) {
    candidates.push({
      ruleId: 'data-reentry',
      nbrReference: '5.9.15',
      summary: `O campo “${repeatedField[0]}” foi observado em mais de uma etapa da jornada.`,
      reviewQuestion:
        'A repetição exige redigitação desnecessária de informação já fornecida pelo usuário?',
    })
  }

  return candidates
}

export async function recordJourneyAuditStep(
  result: AuditResult,
  context: PageAuditContext,
): Promise<JourneyAuditSession> {
  const storage = await extensionStorageGet(['journeyAuditSession'])
  const current = storage.journeyAuditSession as JourneyAuditSession | undefined
  const resultOrigin = getOrigin(result.url)
  const currentOrigin = current?.steps[0] ? getOrigin(current.steps[0].url) : resultOrigin
  const now = Date.now()
  const shouldStartNewSession = !current || currentOrigin !== resultOrigin
  const steps = shouldStartNewSession
    ? [toJourneyStep(result, context)]
    : [
        ...current.steps.map((step) => ({
          ...step,
          context: step.context ?? emptyPageContext,
        })),
        toJourneyStep(result, context),
      ]
  const session: JourneyAuditSession = {
    id: shouldStartNewSession ? createSessionId('journey') : current.id,
    name: shouldStartNewSession
      ? `Jornada iniciada em ${result.pageTitle?.trim() || resultOrigin}`
      : current.name,
    startedAt: shouldStartNewSession ? now : current.startedAt,
    updatedAt: now,
    steps,
    reviewCandidates: buildJourneyReviewCandidates(steps),
  }

  await extensionStorageSet({ journeyAuditSession: session })
  return session
}

export async function clearAuditSession(scope: 'site' | 'journey', url?: string): Promise<void> {
  if (scope === 'journey') {
    await extensionStorageSet({ journeyAuditSession: undefined })
    return
  }

  if (!url) return
  const storage = await extensionStorageGet(['siteAuditSessionsByOrigin'])
  const sessions = {
    ...((storage.siteAuditSessionsByOrigin as Record<string, SiteAuditSession> | undefined) ?? {}),
  }
  delete sessions[getOrigin(url)]
  await extensionStorageSet({ siteAuditSessionsByOrigin: sessions })
}
