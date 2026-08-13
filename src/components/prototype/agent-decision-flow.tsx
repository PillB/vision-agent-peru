'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, GitBranch, HeartPulse, PauseCircle, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { USE_CASES } from '@/lib/use-cases'
import { AGENT_STAGE_ORDER } from '@/lib/decision-flow'
import type { StageName, StageTrace } from '@/lib/agentic-response'
import { usePrototypeStore } from '@/lib/store'

const STAGE_META: Record<StageName, { label: string; eyebrow: string }> = {
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

const NODE_LAYOUT: Record<StageName, { x: number; y: number }> = {
  OBSERVE: { x: 26, y: 96 }, VALIDATE_EVIDENCE: { x: 214, y: 96 }, POLICY: { x: 402, y: 96 },
  JUDGE: { x: 596, y: 32 }, VALIDATE_JUDGE: { x: 784, y: 32 },
  PROPOSE_ACTION: { x: 596, y: 216 }, APPROVAL: { x: 784, y: 216 },
  EXECUTE: { x: 596, y: 388 }, VERIFY_OUTCOME: { x: 784, y: 388 },
}

const FLOW_EDGES: Array<{ from: StageName; to: StageName; path: string; branch?: 'requested' | 'skipped' }> = [
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

function statusClasses(status: StageTrace['status'] | 'idle', active: boolean) {
  if (active) return 'border-emerald-500 bg-emerald-50 shadow-[0_0_0_4px_rgba(16,185,129,0.12),0_12px_35px_rgba(16,185,129,0.18)]'
  if (status === 'fail') return 'border-rose-400 bg-rose-50'
  if (status === 'pass') return 'border-emerald-200 bg-white'
  if (status === 'pending') return 'border-amber-300 bg-amber-50/70'
  if (status === 'skip') return 'border-zinc-200 bg-zinc-50 opacity-65'
  return 'border-zinc-200 bg-white'
}

function StatusIcon({ status }: { status: StageTrace['status'] | 'idle' }) {
  if (status === 'pass') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  if (status === 'fail') return <XCircle className="h-3.5 w-3.5 text-rose-600" />
  if (status === 'pending') return <Clock3 className="h-3.5 w-3.5 text-amber-600" />
  if (status === 'skip') return <PauseCircle className="h-3.5 w-3.5 text-zinc-400" />
  return <span className="h-2 w-2 rounded-full bg-zinc-300" />
}

export function AgentDecisionFlow() {
  const snapshot = usePrototypeStore(state => state.agentCycleSnapshot)
  const actionLog = usePrototypeStore(state => state.actionLog)
  const activeUseCaseId = usePrototypeStore(state => state.activeUseCaseId)
  const agentCycleCount = usePrototypeStore(state => state.agentCycleCount)
  const isRunning = usePrototypeStore(state => state.isRunning)
  const fps = usePrototypeStore(state => state.fps)
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [selectedStage, setSelectedStage] = useState<StageName>('OBSERVE')
  const [comparisonId, setComparisonId] = useState('fire_smoke')
  const [heartbeatAge, setHeartbeatAge] = useState(0)
  const [replayNonce, setReplayNonce] = useState(0)

  const activeUseCase = USE_CASES.find(useCase => useCase.id === activeUseCaseId) ?? USE_CASES[0]
  const comparisonUseCase = USE_CASES.find(useCase => useCase.id === comparisonId) ?? USE_CASES[0]
  const executionByAction = useMemo(() => {
    const entries = snapshot ? actionLog.filter(entry => entry.cycleId === snapshot.cycleId) : []
    return new Map(entries.map(entry => [entry.action.name, entry]))
  }, [actionLog, snapshot])
  const traceByStage = useMemo(() => {
    const map = new Map((snapshot?.trace ?? []).map(stage => [stage.stage, { ...stage }]))
    if (!snapshot) return map
    const entries = actionLog.filter(entry => entry.cycleId === snapshot.cycleId)
    const judgeEntry = entries.find(entry => entry.action.name === 'llm_judge')
    if (judgeEntry) {
      const judgeStatus: StageTrace['status'] = judgeEntry.status === 'success' ? 'pass' : judgeEntry.status === 'pending' ? 'pending' : 'fail'
      map.set('JUDGE', { ...map.get('JUDGE')!, status: judgeStatus, detail: judgeEntry.message ?? 'Advisory judge is running.' })
      map.set('VALIDATE_JUDGE', { ...map.get('VALIDATE_JUDGE')!, status: judgeStatus, detail: judgeEntry.message ?? 'Validating advisory verdict.' })
    }
    const externalNames = new Set(['send_email', 'escalate'])
    const approvalEntries = entries.filter(entry => externalNames.has(entry.action.name))
    if (snapshot.requiresApproval && approvalEntries.length > 0) {
      const blocked = approvalEntries.every(entry => entry.status === 'skipped' || entry.status === 'failed')
      map.set('APPROVAL', { ...map.get('APPROVAL')!, status: blocked ? 'fail' : 'pending', detail: blocked ? 'External action blocked: approval or service is unavailable.' : 'Awaiting external-action approval.' })
    }
    if (entries.length > 0) {
      const complete = entries.length >= snapshot.proposedActions.length && entries.every(entry => entry.status !== 'pending')
      const failed = entries.some(entry => entry.status === 'failed')
      const succeeded = entries.some(entry => entry.status === 'success')
      const executionStatus: StageTrace['status'] = !complete ? 'pending' : failed ? 'fail' : succeeded ? 'pass' : 'skip'
      map.set('EXECUTE', { ...map.get('EXECUTE')!, status: executionStatus, detail: `${entries.length}/${snapshot.proposedActions.length} task audit entries · ${entries.filter(entry => entry.status === 'success').length} succeeded · ${entries.filter(entry => entry.status === 'skipped').length} blocked/skipped` })
      map.set('VERIFY_OUTCOME', { ...map.get('VERIFY_OUTCOME')!, status: complete ? executionStatus : 'pending', detail: complete ? 'Final status reconciled from cycle-linked action audit entries.' : 'Waiting for the serialized action queue to complete.' })
    }
    return map
  }, [actionLog, snapshot])
  const playbackStages = useMemo(
    () => snapshot ? snapshot.trace.filter(stage => traceByStage.get(stage.stage)?.status !== 'skip').map(stage => stage.stage) : [],
    [snapshot, traceByStage],
  )

  useEffect(() => {
    if (!snapshot) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setPlaybackIndex(reducedMotion ? Math.max(0, playbackStages.length - 1) : 0)
    if (reducedMotion) return
    const timer = window.setInterval(() => setPlaybackIndex(current => {
      if (current >= playbackStages.length - 1) {
        window.clearInterval(timer)
        return current
      }
      return current + 1
    }), 650)
    return () => window.clearInterval(timer)
  }, [snapshot, playbackStages.length, replayNonce])

  useEffect(() => {
    if (snapshot && playbackStages.length > 0) setSelectedStage(playbackStages[Math.min(playbackIndex, playbackStages.length - 1)])
  }, [playbackIndex, playbackStages, snapshot])

  useEffect(() => {
    const update = () => setHeartbeatAge(snapshot ? Math.max(0, Date.now() - snapshot.startedAt) : 0)
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [snapshot])

  const selectedTrace = traceByStage.get(selectedStage)
  const proposedActions = snapshot?.proposedActions ?? []
  const judgeBranch = snapshot?.judgeBranch ?? (activeUseCase.actions.includes('llm_judge') ? 'requested' : 'skipped')
  const visited = new Set(playbackStages.slice(0, snapshot ? playbackIndex + 1 : 0))
  const activeStage = snapshot ? playbackStages[Math.min(playbackIndex, playbackStages.length - 1)] : undefined

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm" data-testid="agent-decision-flow">
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-gradient-to-r from-zinc-950 via-zinc-900 to-emerald-950 px-4 py-4 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300"><GitBranch className="h-3.5 w-3.5" /> Agent execution map</div>
          <h3 className="mt-1 font-serif text-xl">Decision flow · {activeUseCase.name}</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-300">Replay of the authoritative decision record and its real action audit states. It exposes evidence, policy, gates and outcomes—not private chain-of-thought.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <button type="button" onClick={() => setReplayNonce(value => value + 1)} disabled={!snapshot} className="inline-flex items-center rounded-md border border-white/15 bg-white/10 px-2 py-1 text-zinc-100 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"><RotateCcw className="mr-1 h-3 w-3" />Replay cycle</button>
          <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/10"><HeartPulse className={`mr-1 h-3 w-3 ${isRunning ? 'animate-pulse' : ''}`} />{isRunning ? `Live · ${fps} fps` : 'Paused'}</Badge>
          <Badge className="border-white/15 bg-white/10 text-zinc-100 hover:bg-white/10">Cycle #{snapshot?.cycleNumber ?? agentCycleCount}</Badge>
          <Badge className="border-white/15 bg-white/10 text-zinc-100 hover:bg-white/10">{snapshot ? `${Math.round(heartbeatAge / 1000)}s since heartbeat` : 'Awaiting first cycle'}</Badge>
        </div>
      </div>

      <div className="overflow-x-auto bg-zinc-50/70">
        <div className="relative h-[500px] min-w-[970px] bg-[radial-gradient(circle_at_1px_1px,rgba(113,113,122,0.18)_1px,transparent_0)] bg-[size:18px_18px]" data-playback-step={playbackIndex}>
          <svg aria-hidden="true" className="absolute inset-0 h-full w-[970px]" viewBox="0 0 970 500">
            <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
            {FLOW_EDGES.map(edge => {
              const branchVisible = !edge.branch || edge.branch === judgeBranch
              const edgeActive = branchVisible && visited.has(edge.from) && visited.has(edge.to)
              return <path key={`${edge.from}-${edge.to}`} d={edge.path} fill="none" markerEnd="url(#flow-arrow)" className={`${branchVisible ? '' : 'opacity-15'} ${edgeActive ? 'text-emerald-500 [stroke-dasharray:8_6] motion-safe:animate-[dash_1s_linear_infinite]' : 'text-zinc-300'}`} stroke="currentColor" strokeWidth={edgeActive ? 2.5 : 1.5} />
            })}
            <text x="558" y="55" className="fill-zinc-500 text-[9px]">judge needed</text><text x="486" y="210" className="fill-zinc-500 text-[9px]">judge skipped</text>
          </svg>

          {AGENT_STAGE_ORDER.map((stage, index) => {
            const position = NODE_LAYOUT[stage]
            const trace = traceByStage.get(stage)
            const status = trace?.status ?? 'idle'
            const active = Boolean(snapshot && activeStage === stage)
            return <button key={stage} type="button" data-testid={`flow-node-${stage.toLowerCase()}`} data-status={status} data-active={active ? 'true' : 'false'} onClick={() => setSelectedStage(stage)} className={`absolute h-[68px] w-[150px] rounded-lg border p-2 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${statusClasses(status, active)}`} style={{ left: position.x, top: position.y }}>
              <div className="flex items-center justify-between gap-2"><span className="text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{STAGE_META[stage].eyebrow}</span><StatusIcon status={status} /></div>
              <div className="mt-1 text-[11px] font-semibold text-zinc-900">{STAGE_META[stage].label}</div><div className="mt-0.5 truncate font-mono text-[8px] text-zinc-500">{stage}</div>
            </button>
          })}

          <div className="absolute left-[36px] top-[222px] w-[500px] rounded-xl border border-zinc-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-2"><div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Selected node inspector</div><Badge variant="outline" className="text-[9px]">{selectedTrace?.status ?? 'awaiting data'}</Badge></div>
            <div className="mt-1 text-sm font-semibold text-zinc-950">{STAGE_META[selectedStage].label}</div>
            <p className="mt-1 min-h-10 text-[10px] leading-relaxed text-zinc-600">{selectedTrace?.detail ?? 'Start analysis to populate this node with measured evidence and gate state.'}</p>
            {selectedTrace?.result && <div className="mt-2 flex flex-wrap gap-1">{Object.entries(selectedTrace.result).slice(0, 4).map(([key, value]) => <span key={key} className="rounded bg-zinc-100 px-1.5 py-1 font-mono text-[8px] text-zinc-600">{key}={Array.isArray(value) ? value.join('|') : String(value)}</span>)}</div>}
          </div>

          <div className="absolute left-[36px] top-[386px] flex max-w-[500px] flex-wrap gap-1.5" aria-label="Current decision tasks">
            {(proposedActions.length > 0 ? proposedActions : activeUseCase.actions.map(name => ({ name }))).slice(0, 7).map((action, index) => {
              const name = action.name
              const execution = Array.from(executionByAction.entries()).find(([actionName]) => actionName === name)?.[1]
              const taskClass = execution?.status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : execution?.status === 'failed' ? 'border-rose-200 bg-rose-50 text-rose-800' : execution?.status === 'skipped' ? 'border-zinc-200 bg-zinc-100 text-zinc-500 line-through' : execution?.status === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-zinc-200 bg-white text-zinc-500'
              return <span key={`${name}-${index}`} className={`rounded-md border px-2 py-1 font-mono text-[9px] ${taskClass}`}>{name} · {execution?.status ?? (snapshot ? 'queued' : 'configured')}</span>
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-zinc-200 p-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Current policy summary</div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-700">{snapshot?.reasoning ?? activeUseCase.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]"><Badge variant="outline">rule · {activeUseCase.ruleType}</Badge><Badge variant="outline">level · {snapshot?.capabilityLevel ?? activeUseCase.level}</Badge><Badge variant="outline">tier · {snapshot?.tier ?? 0}</Badge><Badge variant="outline">judge · {judgeBranch}</Badge><Badge variant="outline">approval · {snapshot?.requiresApproval ? 'required' : 'not reached'}</Badge></div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-3" data-testid="use-case-comparison">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Compare decision contracts</div><label className="sr-only" htmlFor="flow-compare-use-case">Compare with use case</label><select id="flow-compare-use-case" value={comparisonId} onChange={event => setComparisonId(event.target.value)} className="max-w-[210px] rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] text-zinc-700">{USE_CASES.map(useCase => <option key={useCase.id} value={useCase.id}>{useCase.name}</option>)}</select></div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-[9px]">{[activeUseCase, comparisonUseCase].map((useCase, index) => <div key={`${useCase.id}-${index}`} className="rounded-md bg-zinc-50 p-2"><div className="truncate font-semibold text-zinc-900">{useCase.name}</div><div className="mt-1 text-zinc-500">{useCase.ruleType} · {useCase.level}</div><div className="mt-1 text-zinc-600">{useCase.actions.length} tasks · {useCase.actions.includes('llm_judge') ? 'judge branch' : 'no judge'}</div></div>)}</div>
        </div>
      </div>
    </section>
  )
}
