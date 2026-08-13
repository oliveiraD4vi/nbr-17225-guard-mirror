import fs from 'node:fs/promises'
import path from 'node:path'

const catalogSource = await fs.readFile(path.resolve('scripts/verify-rules.mjs'), 'utf8')
const catalog = [
  ...catalogSource.matchAll(/\[\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',?\s*\]/g),
].map(([, reference, name, wcagLevel, automation]) => ({ reference, name, wcagLevel, automation }))
const scenarios = [
  {
    scenario: 'positive',
    scenarioLabel: 'Cenário positivo',
    expectation: 'pass',
    description: 'A marcação oferece um exemplo positivo para a regra e não deve gerar candidato.',
  },
  {
    scenario: 'negative',
    scenarioLabel: 'Cenário negativo',
    expectation: 'finding',
    description: 'A marcação oferece um sinal negativo observável para a regra.',
  },
  {
    scenario: 'boundary',
    scenarioLabel: 'Cenário limítrofe',
    expectation: 'review',
    description: 'A marcação é ambígua e deve preservar a necessidade de julgamento humano.',
  },
]

const fixtures = catalog.flatMap((rule) =>
  scenarios.map((scenario) => ({
    ...rule,
    ...scenario,
    url: `rule.html?reference=${rule.reference}&scenario=${scenario.scenario}`,
  })),
)

await fs.writeFile(
  path.resolve('tests/fixtures/rule-fixtures.json'),
  `${JSON.stringify(fixtures, null, 2)}\n`,
  'utf8',
)

console.log(`Catálogo de fixtures gerado: ${catalog.length} regras e ${fixtures.length} cenários.`)
