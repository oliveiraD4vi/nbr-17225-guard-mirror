import type { Rule, Violation } from '@/types'
import { createViolation, getAccessibleName, getVisibleText, isElementVisible } from '@/utils'

function visibleElements(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isElementVisible)
}

function firstVisible(selector: string): HTMLElement | undefined {
  return visibleElements(selector)[0]
}

function assistedCandidate(
  rule: Rule,
  element: HTMLElement | undefined,
  evidence: string,
  reviewQuestion: string,
): Violation[] {
  if (!element) return []

  return [
    createViolation(rule, {
      element,
      message: `Candidato para revisão: ${rule.name.toLocaleLowerCase('pt-BR')}.`,
      suggestion: reviewQuestion,
      remediationAdvice:
        'Registre a evidência observada e confirme o comportamento com teclado e tecnologia assistiva quando aplicável.',
      evidence: [
        {
          kind:
            rule.auditScope === 'site' || rule.auditScope === 'journey'
              ? 'session'
              : 'author_review',
          summary: evidence,
        },
      ],
      reviewQuestion,
    }),
  ]
}

function getDuplicateLandmark(): HTMLElement | undefined {
  const landmarks = visibleElements(
    'header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"]',
  )
  const keys = new Map<string, HTMLElement>()

  for (const landmark of landmarks) {
    const key = `${landmark.getAttribute('role') || landmark.tagName}:${getAccessibleName(landmark)}`
    if (keys.has(key)) return landmark
    keys.set(key, landmark)
  }
  return undefined
}

function getComplexTableWithoutDescription(): HTMLElement | undefined {
  return visibleElements('table').find((table) => {
    const rows = table.querySelectorAll('tr').length
    const columns = Math.max(
      0,
      ...Array.from(table.querySelectorAll('tr')).map((row) => row.children.length),
    )
    return rows >= 5 && columns >= 4 && !table.hasAttribute('aria-describedby')
  })
}

function getVagueLink(): HTMLElement | undefined {
  return visibleElements('a[href]').find((link) =>
    /^(aqui|clique aqui|saiba mais|mais|ver mais|link)$/i.test(getAccessibleName(link).trim()),
  )
}

function getAdjacentEquivalentLink(): HTMLElement | undefined {
  const links = visibleElements('a[href]') as HTMLAnchorElement[]
  return links.find((link, index) => {
    const next = links[index + 1]
    return Boolean(next && link.href === next.href && link.parentElement === next.parentElement)
  })
}

function getInconsistentControl(): HTMLElement | undefined {
  const controls = visibleElements(
    'button, [role="button"], input[type="button"], input[type="submit"]',
  )
  const names = new Map<string, string>()

  for (const control of controls) {
    const name = getAccessibleName(control).trim().toLocaleLowerCase('pt-BR')
    if (!name) continue
    const action =
      control.getAttribute('data-action') ||
      control.getAttribute('formaction') ||
      control.getAttribute('aria-controls') ||
      control.getAttribute('type') ||
      control.tagName
    const knownAction = names.get(name)
    if (knownAction && knownAction !== action) return control
    names.set(name, action)
  }
  return undefined
}

function getLongSectionWithoutHeading(): HTMLElement | undefined {
  return visibleElements('section, article').find((section) => {
    const text = getVisibleText(section).trim()
    return text.length >= 300 && !section.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]')
  })
}

function getFocusableCandidate(): HTMLElement | undefined {
  return firstVisible(
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex], [contenteditable="true"]',
  )
}

export const focusUsageRecommendationRule: Rule = {
  id: 'focus-usage-recommendation',
  nbrReference: '5.1.5',
  name: 'Uso de foco',
  description: 'Recomenda que o foco seja usado de forma coerente com a tarefa e o contexto.',
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      focusUsageRecommendationRule,
      firstVisible('[autofocus], [tabindex="-1"]'),
      'A página contém foco programático ou elemento retirado da sequência natural.',
      'O foco é movido somente quando isso ajuda a pessoa a continuar a tarefa?',
    ),
}

export const additionalContentRecommendationRule: Rule = {
  id: 'additional-content-recommendation',
  nbrReference: '5.1.7',
  name: 'Conteúdo adicional',
  description: 'Recomenda que conteúdo exibido por hover ou foco seja previsível e operável.',
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      additionalContentRecommendationRule,
      firstVisible('[aria-describedby], [aria-haspopup], [popover], [title]'),
      'Foi encontrado um controle com conteúdo adicional associado.',
      'O conteúdo adicional pode ser percebido, mantido e dispensado por teclado?',
    ),
}

export const keyboardShortcutsRecommendationRule: Rule = {
  id: 'keyboard-shortcuts-recommendation',
  nbrReference: '5.1.10',
  name: 'Atalhos de teclado',
  description:
    'Recomenda atalhos previsíveis, documentados e sem conflito com tecnologias assistivas.',
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      keyboardShortcutsRecommendationRule,
      firstVisible('[accesskey], [data-shortcut], [aria-keyshortcuts]'),
      'A página declara um atalho de teclado.',
      'O atalho está documentado e pode ser desativado ou remapeado quando necessário?',
    ),
}

export const fullKeyboardAccessibilityRecommendationRule: Rule = {
  id: 'full-keyboard-accessibility-recommendation',
  nbrReference: '5.1.12',
  name: 'Acessibilidade por teclado total',
  description: 'Recomenda que toda funcionalidade seja concluída somente por teclado.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      fullKeyboardAccessibilityRecommendationRule,
      getFocusableCandidate(),
      'A página possui elementos focalizáveis e exige um roteiro completo de teclado.',
      'Todas as tarefas podem ser concluídas com Tab, Shift+Tab, setas, Enter, Espaço e Escape?',
    ),
}

export const simultaneousInputRecommendationRule: Rule = {
  id: 'simultaneous-input-recommendation',
  nbrReference: '5.1.14',
  name: 'Mecanismos de entrada simultâneos',
  description: 'Recomenda preservar o uso combinado de teclado, ponteiro, toque e voz.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      simultaneousInputRecommendationRule,
      firstVisible('canvas, [draggable="true"], [data-gesture], [onpointerdown], [ontouchstart]'),
      'A página contém uma superfície com gesto, arraste ou evento de ponteiro.',
      'É possível alternar mecanismos de entrada durante a mesma tarefa sem perder contexto?',
    ),
}

export const customComponentBehaviorRecommendationRule: Rule = {
  id: 'custom-component-behavior-recommendation',
  nbrReference: '5.1.15',
  name: 'Comportamento de componentes customizados',
  description: 'Recomenda comportamento de teclado compatível com o padrão do componente.',
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      customComponentBehaviorRecommendationRule,
      firstVisible(
        '[role="combobox"], [role="menu"], [role="tablist"], [role="tree"], [role="grid"]',
      ),
      'Foi encontrado um widget ARIA composto.',
      'Os comandos, o foco interno e o fechamento seguem o padrão esperado para esse papel?',
    ),
}

export const sectionHeadingsRecommendationRule: Rule = {
  id: 'section-headings-recommendation',
  nbrReference: '5.3.4',
  name: 'Seções com cabeçalhos',
  description: 'Recomenda cabeçalhos que identifiquem seções extensas de conteúdo.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      sectionHeadingsRecommendationRule,
      getLongSectionWithoutHeading(),
      'Uma seção extensa não contém cabeçalho programaticamente identificável.',
      'A seção precisa de um cabeçalho para ser localizada e compreendida com mais facilidade?',
    ),
}

export const uniqueRegionsRecommendationRule: Rule = {
  id: 'unique-regions-recommendation',
  nbrReference: '5.4.4',
  name: 'Regiões únicas',
  description: 'Recomenda nomes distintos para regiões com a mesma função estrutural.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      uniqueRegionsRecommendationRule,
      getDuplicateLandmark(),
      'Duas regiões expõem a mesma combinação de papel e nome acessível.',
      'As regiões equivalentes precisam de nomes distintos para evitar ambiguidade?',
    ),
}

export const tableTitleRecommendationRule: Rule = {
  id: 'table-title-recommendation',
  nbrReference: '5.6.4',
  name: 'Título de tabela',
  description: 'Recomenda um título visível que identifique o propósito da tabela.',
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      tableTitleRecommendationRule,
      visibleElements('table').find((table) => !table.querySelector('caption')),
      'Uma tabela de dados não contém elemento caption.',
      'A tabela possui um título visível e suficiente, mesmo que esteja associado por outro mecanismo?',
    ),
}

export const complexTableDescriptionRecommendationRule: Rule = {
  id: 'complex-table-description-recommendation',
  nbrReference: '5.6.6',
  name: 'Descrição para tabelas complexas',
  description: 'Recomenda uma explicação da estrutura e do uso de tabelas complexas.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      complexTableDescriptionRecommendationRule,
      getComplexTableWithoutDescription(),
      'Uma tabela com várias linhas e colunas não possui aria-describedby.',
      'A complexidade da tabela exige uma descrição de estrutura, navegação ou leitura?',
    ),
}

export const standaloneLinkPurposeRecommendationRule: Rule = {
  id: 'standalone-link-purpose-recommendation',
  nbrReference: '5.7.3',
  name: 'Propósito do link sem contexto',
  description: 'Recomenda que o propósito de cada link seja compreensível isoladamente.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      standaloneLinkPurposeRecommendationRule,
      getVagueLink(),
      'Foi encontrado um link cujo nome isolado é genérico.',
      'O nome acessível comunica o destino ou a ação sem depender do parágrafo ao redor?',
    ),
}

export const consistentLinkIdentificationRecommendationRule: Rule = {
  id: 'consistent-link-identification-recommendation',
  nbrReference: '5.7.5',
  name: 'Links com identificação consistente',
  description: 'Recomenda nomes consistentes para links equivalentes no site.',
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'site',
  check: async () =>
    assistedCandidate(
      consistentLinkIdentificationRecommendationRule,
      firstVisible('a[href]'),
      'A sessão de site contém links que devem ser comparados entre páginas equivalentes.',
      'Links com o mesmo destino ou função mantêm uma identificação consistente em toda a sessão?',
    ),
}

export const complementaryLinkTextRecommendationRule: Rule = {
  id: 'complementary-link-text-recommendation',
  nbrReference: '5.7.9',
  name: 'Texto complementar do link',
  description:
    'Recomenda informação complementar quando formato ou comportamento do destino for relevante.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      complementaryLinkTextRecommendationRule,
      visibleElements('a[href]').find(
        (link) => !getAccessibleName(link).trim() || Boolean(link.querySelector('svg, img')),
      ),
      'Um link usa apenas conteúdo gráfico ou não expõe texto visível suficiente.',
      'O link comunica formato, tamanho, abertura ou contexto adicional quando essas informações são necessárias?',
    ),
}

export const adjacentLinksRecommendationRule: Rule = {
  id: 'adjacent-links-recommendation',
  nbrReference: '5.7.10',
  name: 'Links adjacentes',
  description: 'Recomenda evitar links adjacentes redundantes para o mesmo destino.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      adjacentLinksRecommendationRule,
      getAdjacentEquivalentLink(),
      'Dois links adjacentes no mesmo contêiner apontam para o mesmo destino.',
      'Os links podem ser combinados em um único alvo sem prejudicar a compreensão?',
    ),
}

export const skipBlockLinksRecommendationRule: Rule = {
  id: 'skip-block-links-recommendation',
  nbrReference: '5.7.11',
  name: 'Links para contornar blocos de conteúdo',
  description: 'Recomenda mecanismos para chegar diretamente às áreas principais.',
  severity: 'warning',
  wcagLevel: 'A',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () => {
    const links = visibleElements('a[href]')
    const hasMain = Boolean(document.querySelector('main, [role="main"]'))
    const hasSkip = links.some((link) => link.getAttribute('href')?.startsWith('#'))
    return assistedCandidate(
      skipBlockLinksRecommendationRule,
      links.length >= 8 && hasMain && !hasSkip ? links[0] : undefined,
      'A página tem navegação extensa e conteúdo principal, mas nenhum link interno visível foi encontrado.',
      'Existe outro mecanismo de teclado que permite contornar os blocos repetidos?',
    )
  },
}

export const siteLocationRecommendationRule: Rule = {
  id: 'site-location-recommendation',
  nbrReference: '5.7.14',
  name: 'Localização em conjunto de páginas',
  description: 'Recomenda indicar a localização atual de forma consistente no site.',
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'site',
  check: async () =>
    assistedCandidate(
      siteLocationRecommendationRule,
      firstVisible('nav, [role="navigation"]'),
      'A sessão de site contém uma navegação que precisa ser comparada entre páginas.',
      'A pessoa consegue identificar a página ou etapa atual de forma consistente em todo o conjunto?',
    ),
}

export const pageControlConsistencyRecommendationRule: Rule = {
  id: 'page-control-consistency-recommendation',
  nbrReference: '5.8.4',
  name: 'Identificação consistente na página',
  description: 'Recomenda identificação coerente para controles com a mesma função.',
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      pageControlConsistencyRecommendationRule,
      getInconsistentControl(),
      'Controles com o mesmo nome acessível expõem indícios de ações diferentes.',
      'Os controles realmente têm funções diferentes e, nesse caso, precisam de nomes distintos?',
    ),
}

export const predictableContextChangeRecommendationRule: Rule = {
  id: 'predictable-context-change-recommendation',
  nbrReference: '5.8.8',
  name: 'Mudança de contexto previsível',
  description: 'Recomenda avisar mudanças de contexto antes que ocorram.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      predictableContextChangeRecommendationRule,
      firstVisible('[onfocus], select[onchange], input[onchange], [data-redirect]'),
      'Foi encontrado um controle com indício de ação automática no foco ou na entrada.',
      'A mudança é anunciada ou iniciada somente depois de uma ação explícita da pessoa?',
    ),
}

export const controlFeedbackRecommendationRule: Rule = {
  id: 'control-feedback-recommendation',
  nbrReference: '5.8.15',
  name: 'Controles com retorno',
  description: 'Recomenda retorno perceptível após o acionamento de um controle.',
  severity: 'warning',
  wcagLevel: 'AA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      controlFeedbackRecommendationRule,
      firstVisible('button, [role="button"], input[type="submit"]'),
      'A página possui controles acionáveis cujo retorno precisa ser observado em uso.',
      'Cada acionamento produz retorno visual e programático suficiente, inclusive em carregamento e erro?',
    ),
}

export const errorPreventionRecommendationRule: Rule = {
  id: 'error-prevention-recommendation',
  nbrReference: '5.9.11',
  name: 'Prevenção de erro',
  description: 'Recomenda revisar, confirmar ou desfazer dados antes da conclusão.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'journey',
  check: async () =>
    assistedCandidate(
      errorPreventionRecommendationRule,
      firstVisible('form input, form select, form textarea'),
      'A jornada contém um formulário com dados fornecidos pela pessoa.',
      'Antes da conclusão, os dados podem ser revisados, corrigidos, confirmados ou desfeitos?',
    ),
}

export const enhancedAuthenticationRecommendationRule: Rule = {
  id: 'enhanced-authentication-recommendation',
  nbrReference: '5.9.17',
  name: 'Autenticação acessível aprimorada',
  description: 'Recomenda alternativas que reduzam dependência de memória ou transcrição.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'journey',
  check: async () =>
    assistedCandidate(
      enhancedAuthenticationRecommendationRule,
      firstVisible('input[type="password"], input[autocomplete="one-time-code"]'),
      'A jornada contém autenticação por senha ou código de uso único.',
      'Há alternativa sem teste cognitivo e o gerenciador de senhas e a colagem permanecem disponíveis?',
    ),
}

export const focusIndicatorAreaRecommendationRule: Rule = {
  id: 'focus-indicator-area-recommendation',
  nbrReference: '5.10.5',
  name: 'Área do indicador de foco visível',
  description: 'Recomenda indicador de foco com área e espessura suficientes.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      focusIndicatorAreaRecommendationRule,
      getFocusableCandidate(),
      'A página possui controles cujo indicador deve ser medido no estado de foco.',
      'A área visível do indicador tem espessura, perímetro e contraste suficientes em todos os controles?',
    ),
}

export const definitionsRecommendationRule: Rule = {
  id: 'definitions-recommendation',
  nbrReference: '5.12.10',
  name: 'Definições de significado',
  description: 'Recomenda explicar termos incomuns, técnicos ou ambíguos.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      definitionsRecommendationRule,
      firstVisible('dfn, abbr, code, var'),
      'O conteúdo usa marcação associada a termo, abreviação ou expressão técnica.',
      'Os termos incomuns ou ambíguos têm definição disponível no mesmo contexto ou em glossário?',
    ),
}

export const readingLevelRecommendationRule: Rule = {
  id: 'reading-level-recommendation',
  nbrReference: '5.12.12',
  name: 'Nível de linguagem',
  description: 'Recomenda linguagem compatível com o público e apoio para conteúdo complexo.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () => {
    const main = firstVisible('main, [role="main"], article')
    return assistedCandidate(
      readingLevelRecommendationRule,
      main && getVisibleText(main).length >= 1200 ? main : undefined,
      'O conteúdo principal é extenso e requer avaliação editorial de linguagem.',
      'A linguagem é adequada ao público ou existe uma versão, resumo ou apoio mais simples?',
    )
  },
}

export const pronunciationRecommendationRule: Rule = {
  id: 'pronunciation-recommendation',
  nbrReference: '5.12.13',
  name: 'Pronúncia identificada',
  description:
    'Recomenda identificar pronúncia quando ela for necessária para compreender o conteúdo.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      pronunciationRecommendationRule,
      visibleElements('abbr, span, p').find((element) =>
        /\b[A-ZÁÉÍÓÚÇ]{3,}\b/.test(getVisibleText(element)),
      ),
      'Foi encontrada uma sequência em letras maiúsculas que pode exigir pronúncia específica.',
      'A pronúncia é necessária para evitar ambiguidade e, nesse caso, está explicada?',
    ),
}

export const extendedAudioDescriptionRecommendationRule: Rule = {
  id: 'extended-audio-description-recommendation',
  nbrReference: '5.14.5',
  name: 'Audiodescrição estendida para vídeo',
  description:
    'Recomenda audiodescrição estendida quando as pausas do vídeo não forem suficientes.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      extendedAudioDescriptionRecommendationRule,
      firstVisible('video'),
      'A página contém vídeo que precisa ser examinado em reprodução.',
      'A audiodescrição comum é suficiente ou o conteúdo exige pausas e descrição estendida?',
    ),
}

export const signLanguageRecommendationRule: Rule = {
  id: 'sign-language-recommendation',
  nbrReference: '5.14.6',
  name: 'Janela de Libras para conteúdo em áudio',
  description: 'Recomenda alternativa em Libras para conteúdo sonoro relevante.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      signLanguageRecommendationRule,
      firstVisible('audio, video'),
      'A página contém mídia com possível informação sonora.',
      'O conteúdo sonoro relevante oferece uma alternativa adequada em Libras quando prevista para o público?',
    ),
}

export const cleanAudioRecommendationRule: Rule = {
  id: 'clean-audio-recommendation',
  nbrReference: '5.14.8',
  name: 'Áudio sem ruído',
  description: 'Recomenda fala distinguível de ruído de fundo e efeitos sonoros.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      cleanAudioRecommendationRule,
      firstVisible('audio, video'),
      'A página contém áudio cuja relação entre fala e ruído precisa ser ouvida.',
      'A fala permanece compreensível e distinguível do ruído de fundo em toda a mídia?',
    ),
}

export const liveAudioTranscriptRecommendationRule: Rule = {
  id: 'live-audio-transcript-recommendation',
  nbrReference: '5.14.10',
  name: 'Transcrição para áudio ao vivo',
  description: 'Recomenda transcrição textual para conteúdo de áudio ao vivo.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      liveAudioTranscriptRecommendationRule,
      firstVisible('[data-live], [aria-label*="ao vivo" i], audio, video'),
      'A página contém mídia que pode representar uma transmissão ao vivo.',
      'Quando o áudio é ao vivo, uma transcrição equivalente é disponibilizada com atraso aceitável?',
    ),
}

export const interactionAnimationRecommendationRule: Rule = {
  id: 'interaction-animation-recommendation',
  nbrReference: '5.15.2',
  name: 'Animações acionadas por interação',
  description: 'Recomenda permitir desativar animações acionadas por interação.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Semi-Automatizável',
  verificationMode: 'assisted',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      interactionAnimationRecommendationRule,
      firstVisible('[class*="animat" i], [data-animation], [style*="animation" i]'),
      'Foi encontrado um elemento com indício de animação declarada.',
      'A animação acionada por interação pode ser desativada e respeita prefers-reduced-motion?',
    ),
}

export const intermittentFlashRecommendationRule: Rule = {
  id: 'intermittent-flash-recommendation',
  nbrReference: '5.15.3',
  name: 'Flash intermitente',
  description: 'Recomenda evitar flashes intermitentes mesmo abaixo do limite técnico.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'page',
  check: async () =>
    assistedCandidate(
      intermittentFlashRecommendationRule,
      firstVisible('[class*="flash" i], [class*="blink" i], [style*="animation" i], video'),
      'A página contém animação ou vídeo que precisa de inspeção temporal e visual.',
      'O conteúdo evita flashes intermitentes e mudanças luminosas que possam provocar desconforto?',
    ),
}

export const interruptionsRecommendationRule: Rule = {
  id: 'interruptions-recommendation',
  nbrReference: '5.16.4',
  name: 'Interrupções',
  description: 'Recomenda adiar ou suprimir interrupções, exceto quando essenciais.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'journey',
  check: async () =>
    assistedCandidate(
      interruptionsRecommendationRule,
      firstVisible('[role="alertdialog"], [role="dialog"], [aria-live="assertive"]'),
      'A jornada contém diálogo ou anúncio assertivo que pode interromper a tarefa.',
      'A interrupção é essencial ou pode ser adiada, suprimida ou consultada depois?',
    ),
}

export const reauthenticationRecommendationRule: Rule = {
  id: 'reauthentication-recommendation',
  nbrReference: '5.16.5',
  name: 'Reautenticação',
  description: 'Recomenda preservar dados e contexto depois de nova autenticação.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'journey',
  check: async () =>
    assistedCandidate(
      reauthenticationRecommendationRule,
      firstVisible('input[type="password"], [data-session-expired], [role="alert"]'),
      'A jornada contém autenticação ou sinal de sessão expirada.',
      'Depois da reautenticação, os dados preenchidos e a etapa da tarefa são preservados?',
    ),
}

export const inactivityRecommendationRule: Rule = {
  id: 'inactivity-recommendation',
  nbrReference: '5.16.6',
  name: 'Tempo de inatividade',
  description: 'Recomenda informar e permitir ajustar perda de dados por inatividade.',
  severity: 'warning',
  wcagLevel: 'AAA',
  category: 'Não Automatizável',
  verificationMode: 'manual',
  auditScope: 'journey',
  check: async () =>
    assistedCandidate(
      inactivityRecommendationRule,
      firstVisible(
        'meta[http-equiv="refresh" i], [data-timeout], [data-session-timeout], [role="timer"]',
      ),
      'A jornada contém um sinal de limite de sessão, atualização ou temporizador.',
      'A pessoa é avisada e consegue preservar os dados antes que a inatividade encerre a sessão?',
    ),
}

export const remainingRecommendationRules: Rule[] = [
  focusUsageRecommendationRule,
  additionalContentRecommendationRule,
  keyboardShortcutsRecommendationRule,
  fullKeyboardAccessibilityRecommendationRule,
  simultaneousInputRecommendationRule,
  customComponentBehaviorRecommendationRule,
  sectionHeadingsRecommendationRule,
  uniqueRegionsRecommendationRule,
  tableTitleRecommendationRule,
  complexTableDescriptionRecommendationRule,
  standaloneLinkPurposeRecommendationRule,
  consistentLinkIdentificationRecommendationRule,
  complementaryLinkTextRecommendationRule,
  adjacentLinksRecommendationRule,
  skipBlockLinksRecommendationRule,
  siteLocationRecommendationRule,
  pageControlConsistencyRecommendationRule,
  predictableContextChangeRecommendationRule,
  controlFeedbackRecommendationRule,
  errorPreventionRecommendationRule,
  enhancedAuthenticationRecommendationRule,
  focusIndicatorAreaRecommendationRule,
  definitionsRecommendationRule,
  readingLevelRecommendationRule,
  pronunciationRecommendationRule,
  extendedAudioDescriptionRecommendationRule,
  signLanguageRecommendationRule,
  cleanAudioRecommendationRule,
  liveAudioTranscriptRecommendationRule,
  interactionAnimationRecommendationRule,
  intermittentFlashRecommendationRule,
  interruptionsRecommendationRule,
  reauthenticationRecommendationRule,
  inactivityRecommendationRule,
]
