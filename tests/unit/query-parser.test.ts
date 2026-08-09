import assert from 'node:assert/strict'
import test from 'node:test'
import { parseQuery } from '../../src/lib/query-parser'

test('observable clothing color is accepted', () => {
  const parsed = parseQuery('person with black jacket and red backpack')
  assert.deepEqual(parsed.rejectedTerms, [])
  assert.equal(parsed.upperColor, 'black')
  assert.equal(parsed.carriedObject, 'backpack')
})

test('race or person-race descriptors are rejected', () => {
  assert.ok(parseQuery('find a black person').rejectedTerms.length > 0)
  assert.ok(parseQuery('buscar por raza').rejectedTerms.length > 0)
})

test('age, perceived gender, body proportion, and gait never become ranking fields', () => {
  const parsed = parseQuery('young woman with unusual gait and body shape')
  assert.ok(parsed.rejectedTerms.length > 0)
  assert.equal('age' in parsed, false)
  assert.equal('gender' in parsed, false)
  assert.equal('gait' in parsed, false)
  assert.equal('bodyProportion' in parsed, false)
})
