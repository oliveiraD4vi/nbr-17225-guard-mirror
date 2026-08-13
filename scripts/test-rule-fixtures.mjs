import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const fixtures = JSON.parse(
  await fs.readFile(path.resolve('tests/fixtures/rule-fixtures.json'), 'utf8'),
)
const references = new Set(fixtures.map((fixture) => fixture.reference))

assert.equal(references.size, 146)
assert.equal(fixtures.length, 438)

for (const reference of references) {
  const scenarios = fixtures
    .filter((fixture) => fixture.reference === reference)
    .map((fixture) => fixture.scenario)
    .sort()
  assert.deepEqual(scenarios, ['boundary', 'negative', 'positive'])
}

assert.equal(fixtures.filter((fixture) => fixture.expectation === 'pass').length, 146)
assert.equal(fixtures.filter((fixture) => fixture.expectation === 'finding').length, 146)
assert.equal(fixtures.filter((fixture) => fixture.expectation === 'review').length, 146)

console.log('Fixtures verificados: 146 regras com cenários positivo, negativo e limítrofe.')
