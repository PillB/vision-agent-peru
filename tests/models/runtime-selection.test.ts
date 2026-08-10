import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveRuntimePlan } from '../../src/lib/models/runtime-plan'
import { ALL_MODELS, USE_CASE_MODELS } from '../../src/lib/models/registry'

test('only selected, implemented adapters are scheduled', () => {
  const plan = resolveRuntimePlan(['clip-zero-shot'], 'fire_smoke')
  assert.deepEqual(plan.adapters.map(item => item.id), ['clip-zero-shot'])
  assert.equal(plan.adapters.some(item => item.id === 'coco-ssd'), false)
})

test('pinned YOLOv10 adapter is scheduled when selected', () => {
  const plan = resolveRuntimePlan(['yolov10n'], 'intrusion')
  assert.deepEqual(plan.adapters.map(item => item.id), ['yolov10n'])
  assert.deepEqual(plan.unavailable, [])
  assert.match(plan.adapters[0]?.revision ?? '', /^[0-9a-f]{40}$/)
})

test('COCO-SSD adapter is scheduled when explicitly selected', () => {
  const plan = resolveRuntimePlan(['coco-ssd'], 'intrusion')
  assert.deepEqual(plan.adapters.map(item => item.id), ['coco-ssd'])
  assert.deepEqual(plan.unavailable, [])
})

test('pinned pose adapter is scheduled for slip-hazard geometry', () => {
  const plan = resolveRuntimePlan(['yolov8n-pose'], 'slip_hazard')
  assert.deepEqual(plan.adapters.map(item => item.id), ['yolov8n-pose'])
  assert.deepEqual(plan.unavailable, [])
  assert.match(plan.adapters[0]?.revision ?? '', /^[0-9a-f]{40}$/)
})

test('zero-valued best rank is retained', () => {
  const plan = resolveRuntimePlan(['yolos-tiny', 'pixel-anomaly'], 'intrusion')
  assert.equal(plan.adapters[0]?.rank, 0)
})

test('active detector uses an immutable revision', () => {
  const plan = resolveRuntimePlan(['yolos-tiny'], 'intrusion')
  assert.match(plan.adapters[0]?.revision ?? '', /^[0-9a-f]{40}$/)
})

test('every model advertised to a use case has an executable runtime adapter', () => {
  const advertisedIds = new Set(Object.values(USE_CASE_MODELS).flat())
  const advertised = ALL_MODELS.filter(model => advertisedIds.has(model.id))
  assert.ok(advertised.length > 0)
  for (const model of advertised) {
    assert.equal(model.adapterImplemented, true, `${model.id} adapter`)
    assert.equal(model.browserReady, true, `${model.id} browser runtime`)
    assert.ok(model.revision && !model.revision.includes('unverified'), `${model.id} revision`)
  }
})
