'use client'

import { useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { usePrototypeStore } from '@/lib/store'
import type { ActionLogEntry, IncidentReport } from '@/lib/store'
import type { Action } from '@/lib/agent'
import type { AnomalyStats } from '@/lib/anomaly'
import type { Detection } from '@/lib/store'
import { toast } from 'sonner'
import { prefixPath } from '@/lib/path-utils'
import { apiRoutesAvailable, isGitHubPages } from '@/lib/deployment'

interface ExecuteCtx {
  cameraId: string
  cameraLabel: string
  stats: AnomalyStats
  detections: Detection[]
  reasoning: string
  canvas: HTMLCanvasElement
}

/**
 * useAgentActions — binds side-effectful action EXECUTION to the React layer.
 *
 * The agent layer (lib/agent.ts) DECIDES; this hook EXECUTES. Each action
 * produces an ActionLogEntry in the audit trail + a user-visible toast for
 * the high-tier actions.
 *
 * Side effects:
 *   - log_tick: just an audit entry (no toast)
 *   - badge: toast (Tier 1)
 *   - snapshot: write to current Hit's snapshotDataUrl (handled by caller) + audit
 *   - log_hit: audit entry
 *   - send_email: POST /api/alert (simulated SMTP) + toast
 *   - generate_report: POST /api/report (LLM) + push to reports[] + toast
 *   - escalate: toast (Tier 3) + audit
 *   - llm_judge: POST /api/judge + audit (result attached to hit)
 *   - acknowledge / silence: not executed here (manual operator action)
 */
export function useAgentActions() {
  const pushAction = usePrototypeStore((s) => s.pushAction)
  const updateAction = usePrototypeStore((s) => s.updateAction)
  const pushReport = usePrototypeStore((s) => s.pushReport)

  const execute = useCallback(
    async (action: Action, ctx: ExecuteCtx) => {
      const entry: ActionLogEntry = {
        id: uuid(),
        timestamp: action.timestamp,
        action,
        status: 'pending',
      }
      pushAction(entry)

      try {
        switch (action.name) {
          case 'log_tick':
            updateAction(entry.id, { status: 'success', message: action.reason })
            break

          case 'badge':
            updateAction(entry.id, { status: 'success', message: `Tier 1: ${action.reason}` })
            toast.warning('Tier 1 — watch', { description: action.reason })
            break

          case 'snapshot':
            updateAction(entry.id, {
              status: 'success',
              message: 'Snapshot captured to incident record',
            })
            break

          case 'log_hit':
            updateAction(entry.id, {
              status: 'success',
              message: `Incident logged · count=${ctx.stats.count} z=${ctx.stats.zScore.toFixed(2)}`,
            })
            break

          case 'send_email': {
            if (!apiRoutesAvailable()) {
              // GitHub Pages: no API route — simulate locally
              updateAction(entry.id, {
                status: 'success',
                message: 'Email simulated (GH Pages mode — no API route)',
              })
              toast.info('Email alert simulated (offline mode)', {
                description: `Would send to ops team · ${ctx.cameraLabel}`,
              })
              break
            }
            const to = (action.payload?.to as string) ?? 'ops@cusco-vision.agent'
            const subject = (action.payload?.subject as string) ?? `[${ctx.cameraId}] Anomaly`
            const body = `Incident on ${ctx.cameraLabel}.\n\nPersons detected: ${ctx.stats.count}\nZ-score: ${ctx.stats.zScore.toFixed(2)}\n2-min mean: ${ctx.stats.mean.toFixed(1)} (σ=${ctx.stats.stddev.toFixed(1)})\nReasoning: ${ctx.reasoning}\n\nSee dashboard for snapshot.`
            try {
              const res = await fetch(prefixPath('/api/alert'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to, subject, body,
                  cameraId: ctx.cameraId,
                  tier: action.tier,
                }),
              })
              const data = await res.json()
              if (data.ok) {
                updateAction(entry.id, {
                  status: 'success',
                  message: `Email sent (sim) · ${data.messageId}`,
                })
                toast.info('Email alert sent (simulated)', {
                  description: `To: ${to} · Subject: ${subject}`,
                })
              } else {
                throw new Error(data.error || 'email failed')
              }
            } catch (err) {
              // Fallback: simulate locally if API unavailable
              updateAction(entry.id, {
                status: 'success',
                message: 'Email simulated (API unavailable)',
              })
              toast.info('Email alert simulated (offline)', {
                description: `Would send to: ${to}`,
              })
            }
            break
          }

          case 'generate_report': {
            // Build incident window from samples within last 5 min
            // Read fresh state from store (avoid stale closure on `samples`)
            const currentState = usePrototypeStore.getState()
            const freshSamples = currentState.samples
            const freshHits = currentState.hits
            const now = Date.now()
            const windowSamples = freshSamples.filter((s) => now - s.t < 5 * 60_000)
            const peak = windowSamples.reduce((acc, s) => (s.count > acc.count ? s : acc), { count: currentState.personCount, t: now })
            const hitIds = freshHits.slice(0, 5).map((h) => h.id)
            const res = await fetch(prefixPath('/api/report'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cameraId: ctx.cameraId,
                cameraLabel: ctx.cameraLabel,
                windowStart: windowSamples[0]?.t ?? now,
                windowEnd: now,
                peakCount: peak.count,
                peakZScore: ctx.stats.peakZ,
                tier: action.tier,
                hitCount: freshHits.length,
                sampleReasoning: ctx.reasoning,
              }),
            })
            const data = await res.json()
            if (data.ok) {
              const report: IncidentReport = {
                id: `rpt-${uuid()}`,
                createdAt: now,
                cameraId: ctx.cameraId,
                cameraLabel: ctx.cameraLabel,
                windowStart: windowSamples[0]?.t ?? now,
                windowEnd: now,
                peakCount: peak.count,
                peakZScore: ctx.stats.peakZ,
                tier: action.tier,
                hitIds,
                summary: data.markdown,
              }
              pushReport(report)
              updateAction(entry.id, {
                status: 'success',
                message: 'Incident report generated',
              })
              toast.success('Incident report auto-generated', {
                description: 'See Reports panel',
              })
            } else {
              throw new Error(data.error || 'report failed')
            }
            break
          }

          case 'escalate':
            updateAction(entry.id, {
              status: 'success',
              message: `Tier 3 escalation · ${action.reason}`,
            })
            toast.error('Tier 3 — CRITICAL ESCALATION', {
              description: action.reason,
            })
            break

          case 'llm_judge': {
            // D2 fix: Single-flight deduplication — if a judge is already in
            // flight for this camera+useCase, skip and mark as 'skipped'
            // instead of firing a parallel request. The dedup key is
            // cameraId + the action's payload useCase (if present).
            const dedupKey = `judge:${ctx.cameraId}:${action.payload?.useCase ?? 'default'}`
            if ((window as any).__visionJudgeInFlight?.[dedupKey]) {
              updateAction(entry.id, {
                status: 'skipped',
                message: 'Skipped — judge already in flight for this camera+useCase (D2 single-flight)',
              })
              break
            }
            ;(window as any).__visionJudgeInFlight = (window as any).__visionJudgeInFlight || {}
            ;(window as any).__visionJudgeInFlight[dedupKey] = true

            try {
              // D3 fix: Pass VISUAL EVIDENCE (snapshot crop) to the judge,
              // not just text. Without the image the LLM can only reason
              // about metadata (count, z-score) — it cannot actually see
              // whether the detection is a real fire/flood/intruder.
              // We downscale the canvas to 256x144 to keep the payload small.
              const evidenceCanvas = document.createElement('canvas')
              evidenceCanvas.width = 256
              evidenceCanvas.height = 144
              const evCtx = evidenceCanvas.getContext('2d')
              let snapshotDataUrl: string | undefined
              if (evCtx && ctx.canvas) {
                try {
                  evCtx.drawImage(ctx.canvas, 0, 0, 256, 144)
                  snapshotDataUrl = evidenceCanvas.toDataURL('image/jpeg', 0.6)
                } catch {
                  // Canvas may be tainted (cross-origin) — fall back to text-only.
                  snapshotDataUrl = undefined
                }
              }

              // If API routes are unavailable (GH Pages), skip the network
              // call and record the simulated verdict. Avoids 404→success.
              if (isGitHubPages() || !apiRoutesAvailable()) {
                updateAction(entry.id, {
                  status: 'success',
                  message: `Judge: simulated (no API on GH Pages) — verdict=real (conservative)`,
                })
                break
              }

              const res = await fetch(prefixPath('/api/judge'), {
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
                  // D3: visual evidence — the actual cropped frame
                  snapshotDataUrl,
                }),
              })
              const data = await res.json()
              updateAction(entry.id, {
                status: 'success',
                message: `Judge: ${data.verdict} (${(data.confidence ?? 0).toFixed(2)}) — ${data.reason ?? ''}`,
              })
              if (data.verdict === 'real') {
                toast.info('LLM judge: REAL incident', {
                  description: `Confidence ${(data.confidence ?? 0).toFixed(2)} · ${data.reason}`,
                })
              } else {
                toast.success('LLM judge: false positive', {
                  description: `Suppressed escalation · ${data.reason}`,
                })
              }
            } finally {
              delete (window as any).__visionJudgeInFlight?.[dedupKey]
            }
            break
          }

          case 'acknowledge':
          case 'silence':
            // Manual operator actions — not auto-executed
            updateAction(entry.id, { status: 'skipped', message: 'Manual action' })
            break

          default:
            updateAction(entry.id, { status: 'skipped', message: `Unknown action: ${action.name}` })
        }
      } catch (err) {
        updateAction(entry.id, {
          status: 'failed',
          message: err instanceof Error ? err.message : 'unknown error',
        })
        toast.error(`Action failed: ${action.name}`, {
          description: err instanceof Error ? err.message : 'unknown',
        })
      }
    },
    [pushAction, updateAction, pushReport]
  )

  return { execute }
}
