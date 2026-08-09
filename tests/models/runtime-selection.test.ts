import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRuntimePlan } from '../../src/lib/models/runtime-plan'

test('only selected, implemented adapters are scheduled', () => {
  const plan = resolveRuntimePlan(['clip-zero-shot'], 'fire_smoke')
  assert.deepEqual(plan.adapters.map(item => item.id), ['clip-zero-shot'])
  assert.equal(plan.adapters.some(item => item.id === 'coco-ssd'), false)
})

test('pending adapters are unavailable rather than decorative selections', () => {
  const plan = resolveRuntimePlan(['yolov10n'], 'intrusion')
  assert.deepEqual(plan.adapters, [])
  assert.deepEqual(plan.unavailable, ['yolov10n'])
})

test('zero-valued best rank is retained', () => {
  const plan = resolveRuntimePlan(['yolos-tiny', 'pixel-anomaly'], 'intrusion')
  assert.equal(plan.adapters[0]?.rank, 0)
})

test('active detector uses an immutable revision', () => {
  const plan = resolveRuntimePlan(['yolos-tiny'], 'intrusion')
  assert.match(plan.adapters[0]?.revision ?? '', /^[0-9a-f]{40}$/)
})
