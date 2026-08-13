'use client'

import { useCallback, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { toast } from 'sonner'
import type { Action } from '@/lib/agent'
import type { AnomalyStats } from '@/lib/anomaly'
import { apiRoutesAvailable } from '@/lib/deployment'
import { orderActionsSequentially } from '@/lib/incident-state-machine'
import { prefixPath } from '@/lib/path-utils'
import { usePrototypeStore, type ActionLogEntry, type Detection, type IncidentReport } from '@/lib/store'

interface ExecuteCtx {
  cycleId: string
  cameraId: string
  cameraLabel: string
  stats: AnomalyStats
  detections: Detection[]
  reasoning: string
  canvas: HTMLCanvasElement
  allowedActions: string[]
}

type JudgeVerdict = 'real' | 'false_positive' | 'inconclusive'

interface ExecutionResult {
  status: 'success' | 'failed' | 'skipped'
  judgeVerdict?: JudgeVerdict
}

const judgeFlights = new Set<string>()
const JUDGE_GATED_ACTIONS = new Set(['generate_report', 'send_email', 'escalate'])

function localReport(action: Action, ctx: ExecuteCtx): IncidentReport {
  const state = usePrototypeStore.getState()
  const now = Date.now()
  const windowSamples = state.samples.filter(sample => now - sample.t < 5 * 60_000)
  const peak = windowSamples.reduce(
    (current, sample) => sample.count > current.count ? sample : current,
    { count: state.personCount, t: now },
  )
  const windowStart = windowSamples[0]?.t ?? now
  const summary = [
    '# Local deterministic incident draft',
    '',
    `Camera: ${ctx.cameraLabel} (${ctx.cameraId})`,
    `Window: ${new Date(windowStart).toISOString()} – ${new Date(now).toISOString()}`,
    `Peak detections: ${peak.count}`,
    `Peak z-score: ${ctx.stats.peakZ.toFixed(2)}`,
    `Tier: ${action.tier}`,
    `Reasoning: ${ctx.reasoning}`,
    '',
    'Generated locally from browser telemetry. No external service was called. Human review is required.',
  ].join('\n')
  return {
    id: `rpt-${uuid()}`,
    createdAt: now,
    cameraId: ctx.cameraId,
    cameraLabel: ctx.cameraLabel,
    windowStart,
    windowEnd: now,
    peakCount: peak.count,
    peakZScore: ctx.stats.peakZ,
    tier: action.tier,
    hitIds: state.hits.slice(0, 5).map(hit => hit.id),
    summary,
  }
}

/**
 * Executes the restored prototype's actions through one serialized queue.
 * The use-case allowlist is revalidated immediately before every action.
 * Judge-dependent actions never run before a valid, non-false-positive
 * verdict, and Pages never converts a missing API route into success.
 */
export function useAgentActions() {
  const pushAction = usePrototypeStore(state => state.pushAction)
  const updateAction = usePrototypeStore(state => state.updateAction)
  const pushReport = usePrototypeStore(state => state.pushReport)
  const queueRef = useRef<Promise<void>>(Promise.resolve())

  const execute = useCallback(async (action: Action, ctx: ExecuteCtx): Promise<ExecutionResult> => {
    const entry: ActionLogEntry = {
      id: uuid(),
      timestamp: action.timestamp,
      action,
      status: 'pending',
      cycleId: ctx.cycleId,
    }
    pushAction(entry)

    if (action.name !== 'log_tick' && !ctx.allowedActions.includes(action.name)) {
      updateAction(entry.id, { status: 'skipped', message: 'Blocked: action is not in the current use-case allowlist' })
      return { status: 'skipped' }
    }

    try {
      switch (action.name) {
        case 'log_tick':
          updateAction(entry.id, { status: 'success', message: action.reason })
          return { status: 'success' }
        case 'badge':
          updateAction(entry.id, { status: 'success', message: `Tier 1: ${action.reason}` })
          toast.warning('Tier 1 — watch', { description: action.reason })
          return { status: 'success' }
        case 'snapshot':
          updateAction(entry.id, { status: 'success', message: 'Snapshot captured to the local incident record' })
          return { status: 'success' }
        case 'log_hit':
          updateAction(entry.id, {
            status: 'success',
            message: `Incident logged locally · count=${ctx.stats.count} z=${ctx.stats.zScore.toFixed(2)}`,
          })
          return { status: 'success' }
        case 'generate_report': {
          const report = localReport(action, ctx)
          pushReport(report)
          updateAction(entry.id, { status: 'success', message: 'Local deterministic incident draft generated' })
          toast.success('Local incident draft generated', { description: 'No external service was called.' })
          return { status: 'success' }
        }
        case 'send_email':
          updateAction(entry.id, {
            status: 'skipped',
            message: 'Unavailable: email requires explicit approval and a configured authenticated service',
          })
          toast.info('Email unavailable', { description: 'Approval and an authenticated service are required.' })
          return { status: 'skipped' }
        case 'escalate':
          updateAction(entry.id, {
            status: 'skipped',
            message: 'Unavailable: external escalation requires explicit approval and a configured authenticated service',
          })
          toast.info('External escalation unavailable', { description: 'No dispatch or message was sent.' })
          return { status: 'skipped' }
        case 'llm_judge': {
          if (!apiRoutesAvailable()) {
            updateAction(entry.id, { status: 'skipped', message: 'Judge unavailable on this static deployment; no request was sent' })
            return { status: 'skipped', judgeVerdict: 'inconclusive' }
          }

          const key = `${ctx.cameraId}:${action.payload?.useCase ?? 'default'}`
          if (judgeFlights.has(key)) {
            updateAction(entry.id, { status: 'skipped', message: 'Judge request deduplicated while the prior request is in flight' })
            return { status: 'skipped', judgeVerdict: 'inconclusive' }
          }

          const evidenceCanvas = document.createElement('canvas')
          evidenceCanvas.width = 256
          evidenceCanvas.height = 144
          const evidenceContext = evidenceCanvas.getContext('2d')
          if (!evidenceContext || !ctx.canvas?.width || !ctx.canvas?.height) {
            updateAction(entry.id, { status: 'skipped', message: 'Judge blocked: reviewable visual evidence is unavailable' })
            return { status: 'skipped', judgeVerdict: 'inconclusive' }
          }
          evidenceContext.drawImage(ctx.canvas, 0, 0, 256, 144)
          const snapshotDataUrl = evidenceCanvas.toDataURL('image/jpeg', 0.6)

          judgeFlights.add(key)
          try {
            const response = await fetch(prefixPath('/api/judge'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cameraId: ctx.cameraId,
                cameraLabel: ctx.cameraLabel,
                count: ctx.stats.count,
                zScore: ctx.stats.peakZ,
                mean: ctx.stats.mean,
                stddev: ctx.stats.stddev,
                detections: ctx.detections.slice(0, 10),
                reasoning: ctx.reasoning,
                snapshotDataUrl,
              }),
            })
            if (!response.ok) throw new Error(`Judge request failed (${response.status})`)
            const data: unknown = await response.json()
            if (!data || typeof data !== 'object') throw new Error('Judge returned malformed output')
            const candidate = data as { verdict?: unknown; confidence?: unknown; reason?: unknown }
            if (!['real', 'false_positive', 'inconclusive'].includes(String(candidate.verdict))
              || typeof candidate.confidence !== 'number'
              || candidate.confidence < 0
              || candidate.confidence > 1
              || typeof candidate.reason !== 'string'
              || candidate.reason.trim().length === 0) {
              throw new Error('Judge returned invalid verdict, confidence, or reason')
            }
            const verdict = candidate.verdict as JudgeVerdict
            updateAction(entry.id, {
              status: 'success',
              message: `Judge: ${verdict} (${candidate.confidence.toFixed(2)}) — ${candidate.reason}`,
            })
            if (verdict === 'false_positive') {
              toast.success('Judge marked a false positive', { description: 'Report and escalation were suppressed.' })
            }
            return { status: 'success', judgeVerdict: verdict }
          } finally {
            judgeFlights.delete(key)
          }
        }
        case 'acknowledge':
        case 'silence':
          updateAction(entry.id, { status: 'skipped', message: 'Manual operator action' })
          return { status: 'skipped' }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error'
      updateAction(entry.id, { status: 'failed', message })
      toast.error(`Action failed: ${action.name}`, { description: message })
      return { status: 'failed', judgeVerdict: action.name === 'llm_judge' ? 'inconclusive' : undefined }
    }
  }, [pushAction, pushReport, updateAction])

  const executeSequentially = useCallback((actions: Action[], ctx: ExecuteCtx): Promise<void> => {
    const run = async () => {
      const byName = new Map(actions.map(action => [action.name, action]))
      const ordered = [
        ...actions.filter(action => action.name === 'log_tick'),
        ...orderActionsSequentially(actions.map(action => action.name))
          .map(name => byName.get(name))
          .filter((action): action is Action => Boolean(action)),
      ]
      let judgeVerdict: JudgeVerdict | undefined
      for (const action of ordered) {
        if (judgeVerdict && judgeVerdict !== 'real' && JUDGE_GATED_ACTIONS.has(action.name)) {
          const entry: ActionLogEntry = {
            id: uuid(), timestamp: action.timestamp, action, status: 'skipped',
            message: `Suppressed after judge verdict: ${judgeVerdict}`,
            cycleId: ctx.cycleId,
          }
          pushAction(entry)
          continue
        }
        const result = await execute(action, ctx)
        if (action.name === 'llm_judge') judgeVerdict = result.judgeVerdict ?? 'inconclusive'
      }
    }

    const queued = queueRef.current.then(run, run)
    queueRef.current = queued.then(() => undefined, () => undefined)
    return queued
  }, [execute, pushAction])

  return { execute, executeSequentially }
}
