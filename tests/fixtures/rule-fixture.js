const params = new URLSearchParams(window.location.search)
const reference = params.get('reference') || ''
const scenario = params.get('scenario') || 'boundary'
const response = await fetch('./rule-fixtures.json')
const fixtures = await response.json()
const fixture = fixtures.find(
  (candidate) => candidate.reference === reference && candidate.scenario === scenario,
)

if (!fixture) {
  document.querySelector('#fixture-description').textContent = 'Fixture não encontrada.'
  throw new Error(`Fixture não encontrada: ${reference}/${scenario}`)
}

document.title = `${fixture.reference} · ${fixture.scenarioLabel}`
document.documentElement.dataset.fixtureReference = fixture.reference
document.documentElement.dataset.fixtureScenario = fixture.scenario
document.documentElement.dataset.fixtureExpectation = fixture.expectation
document.querySelector('h1').textContent = `${fixture.reference} · ${fixture.name}`
document.querySelector('#fixture-description').textContent = fixture.description

const content = document.querySelector('#fixture-content')

function appendText(tagName, text, attributes = {}) {
  const element = document.createElement(tagName)
  element.textContent = text
  Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value))
  content.append(element)
  return element
}

const section = fixture.reference.split('.').slice(0, 2).join('.')

if (scenario === 'positive') {
  appendText('h2', 'Cenário positivo')
  appendText('p', 'Conteúdo com estrutura, nomes e instruções explícitas para a verificação.')
  appendText('button', 'Salvar alterações')
} else if (scenario === 'negative') {
  appendText('h2', 'Cenário negativo')
  if (section === '5.1') {
    appendText('div', 'Controle customizado sem operação equivalente', { tabindex: '0' })
  } else if (section === '5.2') {
    const image = document.createElement('img')
    image.src =
      'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="gray"/></svg>'
    content.append(image)
  } else if (['5.3', '5.4', '5.5', '5.6'].includes(section)) {
    appendText('div', 'Bloco extenso sem a estrutura semântica esperada. '.repeat(12))
  } else if (section === '5.7') {
    appendText('a', 'Clique aqui', { href: '#destino' })
  } else if (section === '5.8') {
    const button = document.createElement('button')
    button.innerHTML = '<span aria-hidden="true">×</span>'
    content.append(button)
  } else if (section === '5.9') {
    const input = document.createElement('input')
    input.required = true
    content.append(input)
  } else if (['5.14', '5.15'].includes(section)) {
    appendText('video', 'Mídia sem alternativa observável')
  } else if (section === '5.16') {
    appendText('div', 'Sua sessão expira em 30 segundos.', { role: 'timer', 'data-timeout': '30' })
  } else {
    appendText('div', 'Candidato proposital para a regra, sem evidência conclusiva automática.')
  }
} else {
  appendText('h2', 'Cenário limítrofe')
  appendText(
    'p',
    'A marcação contém um sinal técnico parcial. O resultado esperado é revisão humana, sem conclusão automática.',
  )
  appendText('button', 'Continuar', { 'aria-describedby': 'ajuda-limite' })
  appendText('small', 'A ação depende do contexto completo da jornada.', { id: 'ajuda-limite' })
}

window.__GUARDIAO_RULE_FIXTURE__ = fixture
