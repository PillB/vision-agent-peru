import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path: string) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')

test('live prototype and evidence workspace remain independent top-level destinations', async () => {
  const page = await read('src/app/page.tsx')
  assert.match(page, /value="prototype"/)
  assert.match(page, /<Tab2Prototype \/>/)
  assert.match(page, /value="evidence"/)
  assert.match(page, /<EvidenceWorkspace \/>/)
})

test('restored prototype serializes action batches and revalidates use-case actions', async () => {
  const camera = await read('src/components/prototype/camera-view.tsx')
  const actions = await read('src/components/prototype/use-agent-actions.ts')
  assert.doesNotMatch(camera, /Promise\.all\(\s*decision\.actions/)
  assert.match(camera, /executeSequentially\(decision\.actions/)
  assert.match(camera, /allowedActions: useCase\.actions/)
  assert.match(actions, /current use-case allowlist/)
  assert.match(actions, /Suppressed after judge verdict/)
})

test('restored production path uses the pinned detector and exposes no model globals', async () => {
  const loader = await read('src/components/prototype/real-ml-loader.tsx')
  const detector = await read('src/lib/yolos-detector.ts')
  assert.match(loader, /loadYolosDetector/)
  assert.doesNotMatch(loader, /__cocoModel|__tf|window as any/)
  assert.match(detector, /1a00cc14a139ff40bac9aa00c745915cb7b5b751/)
})

test('static deployment cannot report email or escalation as successful', async () => {
  const actions = await read('src/components/prototype/use-agent-actions.ts')
  assert.doesNotMatch(actions, /\/api\/(alert|report)/)
  assert.match(actions, /email requires explicit approval and a configured authenticated service/)
  assert.match(actions, /No external service was called/)
})
