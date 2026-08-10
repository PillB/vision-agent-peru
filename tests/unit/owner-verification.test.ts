import test from 'node:test'
import assert from 'node:assert/strict'
import { averageDescriptors, euclideanDistance, verifyOwnerDescriptor } from '../../src/lib/owner-verification'

test('owner template averages enrollment samples in the model native descriptor space', () => {
  const template = averageDescriptors([
    new Float32Array([1, 0]),
    new Float32Array([0.8, 0.2]),
    new Float32Array([0.9, 0.1]),
  ])
  assert.ok(template)
  assert.ok(Math.abs(template[0] - 0.9) < 1e-6)
  assert.ok(Math.abs(template[1] - 0.1) < 1e-6)
})

test('one-to-one verification accepts and rejects around the explicit threshold', () => {
  const enrolled = new Float32Array([0, 0])
  assert.equal(verifyOwnerDescriptor(new Float32Array([0.29, 0.4]), enrolled, 0.5).matched, true)
  assert.equal(verifyOwnerDescriptor(new Float32Array([0.4, 0.4]), enrolled, 0.5).matched, false)
})

test('descriptor dimension mismatch fails closed', () => {
  assert.equal(euclideanDistance(new Float32Array([1]), new Float32Array([1, 2])), Number.POSITIVE_INFINITY)
  assert.equal(verifyOwnerDescriptor(new Float32Array([1]), new Float32Array([1, 2])).matched, false)
})
