import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRuntimePlan } from '../../src/lib/models/runtime-plan'

test('only selected, implemented adapters are scheduled', () => {
  const plan = resolveRuntimePlan(['clip-zero-shot'], 'fire_smoke')
  assert.deepEqual(plan.adapters.map(item => item.id), ['clip-zero-shot'])
  assert.equal(plan.adapters.some(item => item.id === 'coco-ssd'), false)
})

test('pending adapters are unavailable rather than decorative selections', () => {
  const plan = resolveRuntimePlan(['yolos-tiny'], 'intrusion')
  assert.deepEqual(plan.adapters, [])
  assert.deepEqual(plan.unavailable, ['yolos-tiny'])
})

test('zero-valued best rank is retained', () => {
  const plan = resolveRuntimePlan(['coco-ssd', 'pixel-anomaly'], 'intrusion')
  assert.equal(plan.adapters[0]?.rank, 0)
})
