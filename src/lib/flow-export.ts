import type { StageName, StageTrace } from './agentic-response'
import { AGENT_STAGE_ORDER } from './decision-flow'

export const DECISION_STAGE_META: Record<StageName, { label: string; eyebrow: string }> = {
  OBSERVE: { label: 'Observe', eyebrow: 'Perceive' },
  VALIDATE_EVIDENCE: { label: 'Validate evidence', eyebrow: 'Quality gate' },
  POLICY: { label: 'Apply policy', eyebrow: 'Deterministic' },
  JUDGE: { label: 'Advisory judge', eyebrow: 'Optional branch' },
  VALIDATE_JUDGE: { label: 'Validate verdict', eyebrow: 'Fail closed' },
  PROPOSE_ACTION: { label: 'Create tasks', eyebrow: 'Authorized only' },
  APPROVAL: { label: 'Approval gate', eyebrow: 'Human control' },
  EXECUTE: { label: 'Execute', eyebrow: 'Serialized queue' },
  VERIFY_OUTCOME: { label: 'Verify outcome', eyebrow: 'Close the loop' },
}

export const DECISION_NODE_LAYOUT: Record<StageName, { x: number; y: number }> = {
  OBSERVE: { x: 26, y: 96 }, VALIDATE_EVIDENCE: { x: 214, y: 96 }, POLICY: { x: 402, y: 96 },
  JUDGE: { x: 596, y: 32 }, VALIDATE_JUDGE: { x: 784, y: 32 },
  PROPOSE_ACTION: { x: 596, y: 216 }, APPROVAL: { x: 784, y: 216 },
  EXECUTE: { x: 596, y: 388 }, VERIFY_OUTCOME: { x: 784, y: 388 },
}

export const DECISION_FLOW_EDGES: Array<{ from: StageName; to: StageName; path: string; branch?: 'requested' | 'skipped' }> = [
  { from: 'OBSERVE', to: 'VALIDATE_EVIDENCE', path: 'M176 130 H214' },
  { from: 'VALIDATE_EVIDENCE', to: 'POLICY', path: 'M364 130 H402' },
  { from: 'POLICY', to: 'JUDGE', path: 'M552 130 C570 130 570 66 596 66', branch: 'requested' },
  { from: 'JUDGE', to: 'VALIDATE_JUDGE', path: 'M746 66 H784', branch: 'requested' },
  { from: 'VALIDATE_JUDGE', to: 'PROPOSE_ACTION', path: 'M859 100 V160 C859 184 766 184 746 216', branch: 'requested' },
  { from: 'POLICY', to: 'PROPOSE_ACTION', path: 'M477 164 V188 C477 228 560 250 596 250', branch: 'skipped' },
  { from: 'PROPOSE_ACTION', to: 'APPROVAL', path: 'M746 250 H784' },
  { from: 'APPROVAL', to: 'EXECUTE', path: 'M859 284 V330 C859 354 764 388 746 422' },
  { from: 'EXECUTE', to: 'VERIFY_OUTCOME', path: 'M746 422 H784' },
]

export interface DecisionFlowExportStage {
  stage: StageName
  status: StageTrace['status'] | 'idle'
  detail?: string
}

export interface DecisionFlowExportInput {
  title: string
  cycleLabel: string
  judgeBranch: 'requested' | 'skipped'
  activeStage?: StageName
  stages: DecisionFlowExportStage[]
  tasks: string[]
}

const COLORS: Record<DecisionFlowExportStage['status'], { fill: string; stroke: string; text: string }> = {
  idle: { fill: '#ffffff', stroke: '#d4d4d8', text: '#52525b' },
  pass: { fill: '#ecfdf5', stroke: '#34d399', text: '#065f46' },
  pending: { fill: '#fffbeb', stroke: '#fbbf24', text: '#92400e' },
  fail: { fill: '#fff1f2', stroke: '#fb7185', text: '#9f1239' },
  skip: { fill: '#f4f4f5', stroke: '#d4d4d8', text: '#71717a' },
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function truncate(value: string, max = 72) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

export function buildDecisionFlowSvg(input: DecisionFlowExportInput) {
  const byStage = new Map(input.stages.map(stage => [stage.stage, stage]))
  const branchStages = new Set<StageName>(['JUDGE', 'VALIDATE_JUDGE'])
  const edgeMarkup = DECISION_FLOW_EDGES.map(edge => {
    const visible = !edge.branch || edge.branch === input.judgeBranch
    const active = visible && edge.to === input.activeStage
    return `<path d="${edge.path}" fill="none" stroke="${active ? '#10b981' : '#a1a1aa'}" stroke-width="${active ? 3 : 1.5}" opacity="${visible ? 1 : 0.16}" marker-end="url(#arrow)"${active ? ' stroke-dasharray="8 6"' : ''}/>`
  }).join('')
  const nodes = AGENT_STAGE_ORDER.map(stage => {
    const position = DECISION_NODE_LAYOUT[stage]
    const supplied = byStage.get(stage)
    const implicitSkip = input.judgeBranch === 'skipped' && branchStages.has(stage)
    const status = supplied?.status ?? (implicitSkip ? 'skip' : 'idle')
    const colors = COLORS[status]
    const active = input.activeStage === stage
    const detail = truncate(supplied?.detail ?? (implicitSkip ? 'Not part of this configured path' : 'Awaiting runtime evidence'))
    return `<g data-active="${active}" data-stage="${stage}" transform="translate(${position.x} ${position.y})">
      ${active ? '<rect x="-5" y="-5" width="160" height="78" rx="14" fill="#10b981" opacity="0.14"/>' : ''}
      <rect width="150" height="68" rx="10" fill="${colors.fill}" stroke="${active ? '#10b981' : colors.stroke}" stroke-width="${active ? 2.5 : 1.5}"/>
      <circle cx="132" cy="14" r="5" fill="${status === 'pass' ? '#10b981' : status === 'fail' ? '#f43f5e' : status === 'pending' ? '#f59e0b' : '#a1a1aa'}"/>
      <text x="12" y="17" fill="#71717a" font-size="8" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.1">${escapeXml(DECISION_STAGE_META[stage].eyebrow.toUpperCase())}</text>
      <text x="12" y="37" fill="${colors.text}" font-size="12" font-family="Arial, sans-serif" font-weight="700">${escapeXml(DECISION_STAGE_META[stage].label)}</text>
      <text x="12" y="54" fill="#71717a" font-size="8" font-family="monospace">${stage}</text>
      <title>${escapeXml(detail)}</title>
    </g>`
  }).join('')
  const tasks = input.tasks.slice(0, 8).map((task, index) => {
    const x = 28 + (index % 4) * 230
    const y = 542 + Math.floor(index / 4) * 28
    return `<g transform="translate(${x} ${y})"><rect width="214" height="22" rx="6" fill="#f4f4f5" stroke="#d4d4d8"/><text x="9" y="15" fill="#52525b" font-size="9" font-family="monospace">${escapeXml(truncate(task, 28))}</text></g>`
  }).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620" viewBox="0 0 1000 620" role="img" aria-label="Vision Agent decision flow">
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#71717a"/></marker><pattern id="grid" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#d4d4d8" opacity="0.55"/></pattern></defs>
    <rect width="1000" height="620" fill="#fafafa"/><rect width="1000" height="76" fill="#18181b"/><rect y="76" width="1000" height="424" fill="url(#grid)"/>
    <text x="26" y="27" fill="#6ee7b7" font-size="10" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.8">VISION AGENT · AUTHORITATIVE EXECUTION MAP</text>
    <text x="26" y="53" fill="#ffffff" font-size="20" font-family="Georgia, serif">${escapeXml(input.title)}</text>
    <text x="970" y="31" text-anchor="end" fill="#d4d4d8" font-size="10" font-family="monospace">${escapeXml(input.cycleLabel)}</text>
    <text x="970" y="51" text-anchor="end" fill="#a7f3d0" font-size="10" font-family="monospace">judge · ${input.judgeBranch}</text>
    <g transform="translate(14 76)">${edgeMarkup}${nodes}</g>
    <text x="28" y="523" fill="#71717a" font-size="9" font-family="Arial, sans-serif" font-weight="700" letter-spacing="1.2">CURRENT DECISION TASKS</text>${tasks}
    <text x="970" y="608" text-anchor="end" fill="#71717a" font-size="8" font-family="Arial, sans-serif">Evidence, policy, gates and outcomes — no private chain-of-thought</text>
  </svg>`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function renderDecisionFlowPng(svg: string, scale = 2) {
  const source = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(source)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = 1000 * scale
    canvas.height = 620 * scale
    const context = canvas.getContext('2d')
    if (!context) throw new Error('PNG export is unavailable because the canvas context could not be created.')
    context.scale(scale, scale)
    context.drawImage(image, 0, 0, 1000, 620)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
