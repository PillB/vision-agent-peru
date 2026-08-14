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
  assert.match(camera, /buildAgentCycleSnapshot/)
  assert.doesNotMatch(camera, /agenticResponse\(/)
  assert.match(actions, /cycleId: ctx\.cycleId/)
})

test('agent flow and measured temporal correlation views remain wired to runtime state', async () => {
  const tab = await read('src/components/tab2-prototype.tsx')
  const camera = await read('src/components/prototype/camera-view.tsx')
  const flow = await read('src/components/prototype/agent-decision-flow.tsx')
  assert.match(tab, /<AgentDecisionFlow \/>/)
  assert.match(tab, /windowedNetworks=/)
  assert.match(camera, /getCoOccurrenceNetwork\(30_000, measuredAt\)/)
  assert.match(flow, /entry\.cycleId === snapshot\.cycleId/)
  assert.match(flow, /data-active=/)
  assert.match(flow, /buildDecisionFlowSvg/)
  assert.match(flow, /data-testid="flow-split-comparison"/)
  assert.match(flow, /Contract preview · not executed/)
})

test('primary destinations and graph canvases use explicit responsive containment', async () => {
  const page = await read('src/app/page.tsx')
  const layout = await read('src/app/layout.tsx')
  const styles = await read('src/app/globals.css')
  const overview = await read('src/components/tab1-overview.tsx')
  const brief = await read('src/components/tab3-strategic-brief.tsx')
  const camera = await read('src/components/prototype/camera-view.tsx')
  const flow = await read('src/components/prototype/agent-decision-flow.tsx')
  const correlation = await read('src/components/prototype/co-occurrence-graph.tsx')
  assert.match(page, /data-testid="primary-tab-strip"/)
  assert.match(page, /data-testid="primary-destination-viewport"/)
  assert.match(page, /data-allow-horizontal-scroll="true"/)
  assert.match(layout, /viewportFit: "cover"/)
  assert.match(styles, /safe-area-inset-left/)
  assert.match(styles, /safe-area-inset-right/)
  assert.match(flow, /flow-map-responsive/)
  assert.match(flow, /flow-stage-node/)
  assert.match(flow, /--flow-node-x/)
  assert.match(styles, /left: var\(--flow-node-x\) !important/)
  assert.match(overview, /className="relative flex min-w-0 flex-col items-center gap-2"/)
  assert.match(brief, /className="relative mt-6 hidden h-16 lg:block"/)
  assert.match(camera, /data-testid="camera-trigger"/)
  assert.match(camera, /max-w-\[260px\] min-w-0 overflow-hidden/)
  assert.doesNotMatch(flow, /className="overflow-x-auto bg-zinc-50\/70"/)
  assert.match(correlation, /maxWidth: width/)
  assert.doesNotMatch(correlation, /style=\{\{ width, height \}\}/)
})

test('restored production path uses the pinned detector and exposes no model globals', async () => {
  const loader = await read('src/components/prototype/real-ml-loader.tsx')
  const detector = await read('src/lib/yolos-detector.ts')
  assert.match(loader, /loadObjectDetector/)
  assert.doesNotMatch(loader, /__cocoModel|__tf|window as any/)
  assert.match(detector, /e2f9c7673f0fa61849efe2b56a0d7774779ebb9d/)
})

test('static deployment cannot report email or escalation as successful', async () => {
  const actions = await read('src/components/prototype/use-agent-actions.ts')
  assert.doesNotMatch(actions, /\/api\/(alert|report)/)
  assert.match(actions, /email requires explicit approval and a configured authenticated service/)
  assert.match(actions, /No external service was called/)
})
