const hasExtensionApi =
  typeof chrome !== 'undefined' && Boolean(chrome.debugger && chrome.devtools?.inspectedWindow)
const previewMode = new URLSearchParams(window.location.search).has('preview') || !hasExtensionApi
const target = { tabId: hasExtensionApi ? chrome.devtools.inspectedWindow.tabId : 0 }

const previewNodes = [
  {
    nodeId: '1',
    childIds: ['2', '5'],
    role: { value: 'RootWebArea' },
    name: { value: 'Painel de relatórios' },
  },
  {
    nodeId: '2',
    parentId: '1',
    childIds: ['3', '4'],
    role: { value: 'navigation' },
    name: { value: 'Navegação principal' },
  },
  {
    nodeId: '3',
    parentId: '2',
    role: { value: 'link' },
    name: { value: 'Visão geral' },
    backendDOMNodeId: 103,
  },
  {
    nodeId: '4',
    parentId: '2',
    role: { value: 'link' },
    name: { value: 'Relatórios' },
    backendDOMNodeId: 104,
    properties: [{ name: 'focusable', value: { value: true } }],
  },
  {
    nodeId: '5',
    parentId: '1',
    childIds: ['6', '7', '10'],
    role: { value: 'main' },
    name: { value: 'Conteúdo principal' },
  },
  {
    nodeId: '6',
    parentId: '5',
    role: { value: 'heading' },
    name: { value: 'Visão geral' },
    properties: [{ name: 'level', value: { value: 1 } }],
  },
  {
    nodeId: '7',
    parentId: '5',
    childIds: ['8', '9'],
    role: { value: 'region' },
    name: { value: 'Ações rápidas' },
  },
  {
    nodeId: '8',
    parentId: '7',
    role: { value: 'button' },
    name: { value: 'Novo relatório' },
    backendDOMNodeId: 108,
  },
  {
    nodeId: '9',
    parentId: '7',
    role: { value: 'button' },
    name: { value: 'Exportar dados' },
    ignored: true,
    ignoredReasons: [{ name: 'ariaHiddenElement', value: { value: true } }],
    backendDOMNodeId: 109,
  },
  {
    nodeId: '10',
    parentId: '5',
    childIds: ['11', '12'],
    role: { value: 'table' },
    name: { value: 'Lista de relatórios' },
  },
  { nodeId: '11', parentId: '10', role: { value: 'columnheader' }, name: { value: 'Nome' } },
  { nodeId: '12', parentId: '10', role: { value: 'columnheader' }, name: { value: 'Status' } },
]

const elements = {
  announcer: document.querySelector('#announcer'),
  clearLiveButton: document.querySelector('#clear-live-button'),
  connectButton: document.querySelector('#connect-button'),
  connectionStatus: document.querySelector('#connection-status'),
  disconnectButton: document.querySelector('#disconnect-button'),
  domPreview: document.querySelector('#dom-preview code'),
  focusEmpty: document.querySelector('#focus-empty'),
  focusOrder: document.querySelector('#focus-order'),
  focusRefreshButton: document.querySelector('#focus-refresh-button'),
  highlightButton: document.querySelector('#highlight-button'),
  inspectorContent: document.querySelector('#inspector-content'),
  inspectorEmpty: document.querySelector('#inspector-empty'),
  liveEmpty: document.querySelector('#live-empty'),
  liveEvents: document.querySelector('#live-events'),
  propertiesList: document.querySelector('#properties-list'),
  refreshButton: document.querySelector('#refresh-button'),
  relationList: document.querySelector('#relation-list'),
  speakButton: document.querySelector('#speak-button'),
  speechPreview: document.querySelector('#speech-preview'),
  stopButton: document.querySelector('#stop-button'),
  tree: document.querySelector('#tree'),
  treeCount: document.querySelector('#tree-count'),
  treeEmpty: document.querySelector('#tree-empty'),
  treeSearch: document.querySelector('#tree-search'),
}

const state = {
  connected: false,
  expandedNodeIds: new Set(),
  liveEvents: [],
  nodes: [],
  nodesById: new Map(),
  refreshTimer: null,
  selectedNodeId: null,
}

function announce(message, assertive = false) {
  elements.announcer.setAttribute('aria-live', assertive ? 'assertive' : 'polite')
  elements.announcer.textContent = ''
  window.requestAnimationFrame(() => {
    elements.announcer.textContent = message
  })
}

function sendCommand(method, params = {}) {
  if (previewMode) return Promise.reject(new Error('Comando indisponível no modo de prévia.'))
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve(result)
    })
  })
}

function attachDebugger() {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, '1.3', () => {
      const error = chrome.runtime.lastError
      if (error) {
        reject(new Error(error.message))
        return
      }
      resolve()
    })
  })
}

function detachDebugger() {
  if (!state.connected) return Promise.resolve()
  if (previewMode) return Promise.resolve()

  return new Promise((resolve) => {
    chrome.debugger.detach(target, () => resolve())
  })
}

function getAxValue(value) {
  if (!value || value.value === undefined || value.value === null) return ''
  if (Array.isArray(value.value)) return value.value.join(', ')
  if (typeof value.value === 'object') return JSON.stringify(value.value)
  return String(value.value)
}

function getProperty(node, propertyName) {
  return node.properties?.find((property) => property.name === propertyName)?.value
}

function getNodeLabel(node) {
  return getAxValue(node.name) || getAxValue(node.value) || '(sem nome)'
}

function setConnectionState(connected, message) {
  state.connected = connected
  elements.connectionStatus.classList.toggle('is-connected', connected)
  elements.connectionStatus.lastChild.textContent = ` ${message}`
  elements.connectButton.disabled = connected
  elements.refreshButton.disabled = !connected
  elements.disconnectButton.disabled = !connected
  elements.focusRefreshButton.disabled = !connected

  if (!connected) {
    elements.highlightButton.disabled = true
    elements.speakButton.disabled = true
    elements.stopButton.disabled = true
  }
}

async function connect() {
  elements.connectButton.disabled = true
  setConnectionState(false, 'Conectando…')

  try {
    if (previewMode) {
      state.connected = true
      buildNodeIndexes(previewNodes)
      setConnectionState(true, 'Prévia local carregada')
      renderTree()
      renderFocusOrder([
        { name: 'Pular para o conteúdo principal', role: 'link' },
        { name: 'Visão geral', role: 'link' },
        { name: 'Relatórios', role: 'link' },
        { name: 'Novo relatório', role: 'button' },
        { name: 'Filtrar', role: 'button' },
      ])
      state.liveEvents = [
        {
          id: 'preview-1',
          message: '3 novos relatórios adicionados à lista.',
          priority: 'polite',
          time: '10:24:31',
        },
        {
          id: 'preview-2',
          message: 'Sessão expirada. Faça login novamente.',
          priority: 'assertive',
          time: '10:23:18',
        },
      ]
      renderLiveEvents()
      await selectNode('4')
      announce('Prévia local do Guardião Lab carregada.')
      return
    }
    await attachDebugger()
    state.connected = true
    await Promise.all([
      sendCommand('Accessibility.enable'),
      sendCommand('DOM.enable'),
      sendCommand('Overlay.enable'),
      sendCommand('Runtime.enable'),
      sendCommand('Page.enable'),
    ])
    setConnectionState(true, 'Conectado a esta aba')
    await Promise.all([refreshTree(), refreshFocusOrder()])
    announce('Guardião Lab conectado. Árvore de acessibilidade carregada.')
  } catch (error) {
    await detachDebugger()
    state.connected = false
    setConnectionState(false, 'Falha na conexão')
    elements.connectButton.disabled = false
    announce(`Não foi possível conectar: ${error.message}`, true)
  }
}

async function disconnect(reason = 'Desconectado') {
  window.speechSynthesis.cancel()
  await detachDebugger()
  state.connected = false
  state.nodes = []
  state.nodesById.clear()
  state.selectedNodeId = null
  renderTree()
  renderInspector(null)
  renderFocusOrder([])
  setConnectionState(false, reason)
  announce(reason)
}

function buildNodeIndexes(nodes) {
  state.nodes = nodes
  state.nodesById = new Map(nodes.map((node) => [node.nodeId, node]))

  nodes.forEach((node) => {
    if (!node.parentId) state.expandedNodeIds.add(node.nodeId)
    if (['banner', 'navigation', 'main'].includes(getAxValue(node.role))) {
      state.expandedNodeIds.add(node.nodeId)
    }
  })
}

async function refreshTree() {
  if (!state.connected) return

  if (previewMode) {
    buildNodeIndexes(previewNodes)
    renderTree()
    return
  }

  try {
    const result = await sendCommand('Accessibility.getFullAXTree', { depth: -1 })
    buildNodeIndexes(result.nodes ?? [])
    if (state.selectedNodeId && !state.nodesById.has(state.selectedNodeId)) {
      state.selectedNodeId = null
    }
    renderTree()
    renderInspector(state.selectedNodeId ? state.nodesById.get(state.selectedNodeId) : null)
  } catch (error) {
    announce(`Não foi possível atualizar a árvore: ${error.message}`, true)
  }
}

function getSearchMatches(searchTerm) {
  if (!searchTerm) return null
  const matches = new Set()

  state.nodes.forEach((node) => {
    const searchable = [
      getAxValue(node.role),
      getAxValue(node.name),
      getAxValue(node.description),
      getAxValue(node.value),
    ]
      .join(' ')
      .toLocaleLowerCase('pt-BR')

    if (!searchable.includes(searchTerm)) return
    matches.add(node.nodeId)
    let parentId = node.parentId
    while (parentId) {
      matches.add(parentId)
      parentId = state.nodesById.get(parentId)?.parentId
    }
  })

  return matches
}

function createTreeNode(node, searchMatches) {
  const item = document.createElement('li')
  item.setAttribute('role', 'none')
  const children = (node.childIds ?? [])
    .map((nodeId) => state.nodesById.get(nodeId))
    .filter(Boolean)
    .filter((child) => !searchMatches || searchMatches.has(child.nodeId))
  const isExpanded = Boolean(searchMatches) || state.expandedNodeIds.has(node.nodeId)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = `tree-row${node.ignored ? ' is-ignored' : ''}`
  button.dataset.nodeId = node.nodeId
  button.setAttribute('role', 'treeitem')
  button.setAttribute('aria-level', String(getNodeLevel(node)))
  button.setAttribute('aria-selected', String(state.selectedNodeId === node.nodeId))
  if (children.length) button.setAttribute('aria-expanded', String(isExpanded))

  const toggle = document.createElement('span')
  toggle.className = 'tree-toggle'
  toggle.setAttribute('aria-hidden', 'true')
  toggle.textContent = children.length ? (isExpanded ? '▾' : '▸') : '·'

  const role = document.createElement('span')
  role.className = 'tree-role'
  role.textContent = getAxValue(node.role) || 'nó'

  const name = document.createElement('span')
  name.className = 'tree-name'
  name.textContent = `${getNodeLabel(node)}${node.ignored ? ' — ignorado' : ''}`

  button.append(toggle, role, name)
  button.addEventListener('click', () => {
    if (children.length) {
      if (isExpanded) state.expandedNodeIds.delete(node.nodeId)
      else state.expandedNodeIds.add(node.nodeId)
    }
    selectNode(node.nodeId)
    renderTree()
  })

  item.append(button)
  if (children.length && isExpanded) {
    const childList = document.createElement('ul')
    childList.className = 'tree-children'
    childList.setAttribute('role', 'group')
    children.forEach((child) => childList.append(createTreeNode(child, searchMatches)))
    item.append(childList)
  }

  return item
}

function getNodeLevel(node) {
  let level = 1
  let parentId = node.parentId
  while (parentId) {
    level += 1
    parentId = state.nodesById.get(parentId)?.parentId
  }
  return level
}

function renderTree() {
  elements.tree.replaceChildren()
  const searchTerm = elements.treeSearch.value.trim().toLocaleLowerCase('pt-BR')
  const searchMatches = getSearchMatches(searchTerm)
  const roots = state.nodes.filter(
    (node) => !node.parentId && (!searchMatches || searchMatches.has(node.nodeId)),
  )

  if (!roots.length) {
    elements.treeEmpty.hidden = false
    elements.treeEmpty.textContent = state.nodes.length
      ? 'Nenhum nó corresponde à busca atual.'
      : 'Conecte o Lab à aba inspecionada para carregar a árvore real do Chromium.'
  } else {
    elements.treeEmpty.hidden = true
    const list = document.createElement('ul')
    list.className = 'tree-list'
    list.setAttribute('role', 'none')
    roots.forEach((node) => list.append(createTreeNode(node, searchMatches)))
    elements.tree.append(list)
  }

  const ignoredCount = state.nodes.filter((node) => node.ignored).length
  elements.treeCount.textContent = `${state.nodes.length} nós · ${ignoredCount} ignorados`
}

async function selectNode(nodeId) {
  state.selectedNodeId = nodeId
  const node = state.nodesById.get(nodeId)
  await renderInspector(node)
  renderTree()
}

function renderDefinitionList(container, entries) {
  container.replaceChildren()
  entries.forEach(([term, value]) => {
    const dt = document.createElement('dt')
    const dd = document.createElement('dd')
    dt.textContent = term
    dd.textContent = value || '—'
    container.append(dt, dd)
  })
}

function getStateSummary(node) {
  return (node.properties ?? [])
    .filter(
      (property) => !['labelledby', 'describedby', 'controls', 'owns'].includes(property.name),
    )
    .map((property) => `${property.name}: ${getAxValue(property.value)}`)
    .join(', ')
}

function getIgnoredReasons(node) {
  return (node.ignoredReasons ?? [])
    .map((reason) => `${reason.name}: ${getAxValue(reason.value)}`)
    .join(', ')
}

async function getDomPreview(node) {
  if (!node?.backendDOMNodeId) return { html: '—', parent: '—' }

  if (previewMode) {
    return {
      html: '<a href="/relatorios" aria-current="page">Relatórios</a>',
      parent: 'navigation “Navegação principal”',
    }
  }

  try {
    const described = await sendCommand('DOM.describeNode', {
      backendNodeId: node.backendDOMNodeId,
      depth: 0,
    })
    const outer = await sendCommand('DOM.getOuterHTML', {
      backendNodeId: node.backendDOMNodeId,
    })
    return {
      html: (outer.outerHTML || `<${described.node?.localName || 'elemento'}>`).slice(0, 1200),
      parent: described.node?.parentId ? `DOM node ${described.node.parentId}` : '—',
    }
  } catch {
    return { html: 'Elemento não disponível no DOM atual.', parent: '—' }
  }
}

async function renderInspector(node) {
  if (!node) {
    elements.inspectorEmpty.hidden = false
    elements.inspectorContent.hidden = true
    elements.highlightButton.disabled = true
    elements.speakButton.disabled = true
    elements.stopButton.disabled = true
    elements.speechPreview.textContent = 'Selecione um nó para preparar a prévia.'
    return
  }

  elements.inspectorEmpty.hidden = true
  elements.inspectorContent.hidden = false
  elements.highlightButton.disabled = !node.backendDOMNodeId
  elements.speakButton.disabled = false
  const dom = await getDomPreview(node)
  elements.domPreview.textContent = dom.html

  renderDefinitionList(elements.propertiesList, [
    ['Nome', getAxValue(node.name)],
    ['Papel', getAxValue(node.role)],
    ['Descrição', getAxValue(node.description)],
    ['Valor', getAxValue(node.value)],
    ['Estados', getStateSummary(node)],
    ['Motivos de nó ignorado', getIgnoredReasons(node)],
  ])

  const focusIndex = [...elements.focusOrder.children].findIndex(
    (item) => item.dataset.backendNodeId === String(node.backendDOMNodeId),
  )
  renderDefinitionList(elements.relationList, [
    [
      'Nó pai acessível',
      node.parentId ? getNodeLabel(state.nodesById.get(node.parentId) ?? {}) : '—',
    ],
    ['Posição entre irmãos', getSiblingPosition(node)],
    ['Índice na ordem de foco', focusIndex >= 0 ? `${focusIndex + 1}` : 'Não focalizável'],
    ['Relação no DOM', dom.parent],
    ['ID do nó no backend', node.backendDOMNodeId ? String(node.backendDOMNodeId) : '—'],
  ])

  elements.speechPreview.textContent = buildSpeechText(node)
}

function getSiblingPosition(node) {
  if (!node.parentId) return 'Nó raiz'
  const siblings = state.nodesById.get(node.parentId)?.childIds ?? []
  const index = siblings.indexOf(node.nodeId)
  return index >= 0 ? `${index + 1} de ${siblings.length}` : '—'
}

async function highlightSelectedNode() {
  const node = state.nodesById.get(state.selectedNodeId)
  if (!node?.backendDOMNodeId) return

  if (previewMode) {
    announce('Na extensão instalada, o elemento correspondente será destacado na página.')
    return
  }

  try {
    await sendCommand('Overlay.highlightNode', {
      backendNodeId: node.backendDOMNodeId,
      highlightConfig: {
        showInfo: true,
        showStyles: false,
        contentColor: { r: 0, g: 127, b: 137, a: 0.2 },
        borderColor: { r: 0, g: 98, b: 107, a: 1 },
      },
    })
    window.setTimeout(() => {
      if (state.connected) void sendCommand('Overlay.hideHighlight').catch(() => {})
    }, 1800)
    announce('Elemento correspondente destacado temporariamente na página.')
  } catch (error) {
    announce(`Não foi possível destacar o elemento: ${error.message}`, true)
  }
}

async function refreshFocusOrder() {
  if (!state.connected) return

  if (previewMode) {
    renderFocusOrder([
      { name: 'Pular para o conteúdo principal', role: 'link' },
      { name: 'Visão geral', role: 'link' },
      { name: 'Relatórios', role: 'link' },
      { name: 'Novo relatório', role: 'button' },
      { name: 'Filtrar', role: 'button' },
    ])
    return
  }

  const expression = `(() => {
    const selector = [
      'a[href]', 'button', 'input:not([type="hidden"])', 'select', 'textarea', 'summary',
      '[tabindex]', '[contenteditable="true"]'
    ].join(',');
    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const name = (element) => element.getAttribute('aria-label') || element.innerText?.trim() || element.value || element.title || element.tagName.toLowerCase();
    return [...document.querySelectorAll(selector)]
      .filter((element) => !element.disabled && isVisible(element) && Number(element.getAttribute('tabindex') || 0) >= 0)
      .map((element) => ({
        name: name(element).slice(0, 160),
        role: element.getAttribute('role') || element.tagName.toLowerCase(),
        backendHint: element.id || ''
      }));
  })()`

  try {
    const result = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      silent: true,
    })
    renderFocusOrder(result.result?.value ?? [])
  } catch (error) {
    announce(`Não foi possível calcular a ordem de foco: ${error.message}`, true)
  }
}

function renderFocusOrder(items) {
  elements.focusOrder.replaceChildren()
  elements.focusEmpty.hidden = items.length > 0

  items.forEach((item, index) => {
    const li = document.createElement('li')
    const number = document.createElement('span')
    const name = document.createElement('span')
    const role = document.createElement('span')
    number.className = 'focus-index'
    number.textContent = String(index + 1)
    name.textContent = item.name || '(sem nome)'
    role.className = 'focus-role'
    role.textContent = item.role
    li.append(number, name, role)
    elements.focusOrder.append(li)
  })
}

function recordLiveRegionUpdates(nodes) {
  nodes.forEach((node) => {
    const live = getAxValue(getProperty(node, 'live'))
    if (!live || live === 'off') return
    const message = getNodeLabel(node)
    if (!message || message === '(sem nome)') return
    state.liveEvents.unshift({
      id: `${Date.now()}-${node.nodeId}`,
      message,
      priority: live,
      time: new Date().toLocaleTimeString('pt-BR'),
    })
  })
  state.liveEvents = state.liveEvents.slice(0, 30)
  renderLiveEvents()
}

function renderLiveEvents() {
  elements.liveEvents.replaceChildren()
  elements.liveEmpty.hidden = state.liveEvents.length > 0

  state.liveEvents.forEach((event) => {
    const li = document.createElement('li')
    const time = document.createElement('time')
    const message = document.createElement('span')
    const priority = document.createElement('span')
    time.className = 'live-time'
    time.textContent = event.time
    message.textContent = event.message
    priority.className = `live-priority${event.priority === 'assertive' ? ' is-assertive' : ''}`
    priority.textContent = event.priority
    li.append(time, message, priority)
    elements.liveEvents.append(li)
  })
}

function buildSpeechText(node) {
  const parts = [getAxValue(node.name), getAxValue(node.role), getAxValue(node.value)]
  const checked = getAxValue(getProperty(node, 'checked'))
  const expanded = getAxValue(getProperty(node, 'expanded'))
  if (checked) parts.push(`marcado: ${checked}`)
  if (expanded) parts.push(`expandido: ${expanded}`)
  return parts.filter(Boolean).join(', ') || 'Nó sem conteúdo para leitura.'
}

function speakSelectedNode() {
  const node = state.nodesById.get(state.selectedNodeId)
  if (!node) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(buildSpeechText(node))
  utterance.lang = 'pt-BR'
  utterance.rate = 1
  utterance.addEventListener('start', () => {
    elements.stopButton.disabled = false
    announce('Prévia de leitura iniciada.')
  })
  utterance.addEventListener('end', () => {
    elements.stopButton.disabled = true
    announce('Prévia de leitura concluída.')
  })
  window.speechSynthesis.speak(utterance)
}

function handleTreeKeyboard(event) {
  const buttons = [...elements.tree.querySelectorAll('[role="treeitem"]')]
  const currentIndex = buttons.indexOf(document.activeElement)
  if (currentIndex < 0) return
  const current = buttons[currentIndex]

  if (event.key === 'ArrowDown' && buttons[currentIndex + 1]) {
    event.preventDefault()
    buttons[currentIndex + 1].focus()
  } else if (event.key === 'ArrowUp' && buttons[currentIndex - 1]) {
    event.preventDefault()
    buttons[currentIndex - 1].focus()
  } else if (event.key === 'Home') {
    event.preventDefault()
    buttons[0]?.focus()
  } else if (event.key === 'End') {
    event.preventDefault()
    buttons.at(-1)?.focus()
  } else if (event.key === 'ArrowRight' && current.getAttribute('aria-expanded') === 'false') {
    event.preventDefault()
    current.click()
  } else if (event.key === 'ArrowLeft' && current.getAttribute('aria-expanded') === 'true') {
    event.preventDefault()
    current.click()
  }
}

function scheduleRefresh(nodes = []) {
  recordLiveRegionUpdates(nodes)
  window.clearTimeout(state.refreshTimer)
  state.refreshTimer = window.setTimeout(() => {
    void refreshTree()
  }, 180)
}

if (hasExtensionApi) {
  chrome.debugger.onEvent.addListener((source, method, params) => {
    if (source.tabId !== target.tabId || !state.connected) return
    if (method === 'Accessibility.nodesUpdated') scheduleRefresh(params.nodes ?? [])
    if (method === 'Accessibility.loadComplete') scheduleRefresh(params.root ? [params.root] : [])
    if (method === 'Page.frameNavigated' && !params.frame?.parentId) {
      void disconnect('Página navegada; conexão encerrada por segurança')
    }
  })

  chrome.debugger.onDetach.addListener((source) => {
    if (source.tabId !== target.tabId) return
    state.connected = false
    setConnectionState(false, 'Conexão encerrada')
  })

  chrome.devtools.network.onNavigated.addListener(() => {
    void disconnect('Página navegada; conexão encerrada por segurança')
  })
}

elements.connectButton.addEventListener('click', () => void connect())
elements.disconnectButton.addEventListener('click', () => void disconnect())
elements.refreshButton.addEventListener('click', () => void refreshTree())
elements.focusRefreshButton.addEventListener('click', () => void refreshFocusOrder())
elements.highlightButton.addEventListener('click', () => void highlightSelectedNode())
elements.treeSearch.addEventListener('input', renderTree)
elements.tree.addEventListener('keydown', handleTreeKeyboard)
elements.clearLiveButton.addEventListener('click', () => {
  state.liveEvents = []
  renderLiveEvents()
  announce('Registros de regiões vivas limpos.')
})
elements.speakButton.addEventListener('click', speakSelectedNode)
elements.stopButton.addEventListener('click', () => {
  window.speechSynthesis.cancel()
  elements.stopButton.disabled = true
  announce('Prévia de leitura interrompida.')
})

window.addEventListener('pagehide', () => {
  window.speechSynthesis.cancel()
  void detachDebugger()
})

renderTree()
renderLiveEvents()
renderFocusOrder([])
renderInspector(null)
