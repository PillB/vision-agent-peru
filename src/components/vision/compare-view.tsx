'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { GitCompare, ArrowRight, Check, X, Minus } from 'lucide-react'
import type { UseCase, AgentFlowRun, Tier } from '@/lib/vision/types'
import { TIER_META } from '@/lib/vision/types'
import { USE_CASES, LEVEL_META } from '@/lib/vision/use-cases'
import { generateAgentRun, STAGE_ORDER } from '@/lib/vision/agent-flow'
import { Badge } from '@/components/ui/badge'

interface Props {
  defaultA?: string
  defaultB?: string
}

/**
 * CompareView — side-by-side comparison of two use cases' agent runs.
 * Shows each flow as a condensed vertical trace, highlights where the two
 * paths diverge (different tier, different branch, different outcome).
 */
export function CompareView({ defaultA = 'shoplifting', defaultB = 'fire_smoke' }: Props) {
  const [aId, setAId] = useState(defaultA)
  const [bId, setBId] = useState(defaultB)

  const runA = useMemo(() => generateAgentRun(USE_CASES.find((u) => u.id === aId)!, 1), [aId])
  const runB = useMemo(() => generateAgentRun(USE_CASES.find((u) => u.id === bId)!, 1), [bId])

  const ucA = USE_CASES.find((u) => u.id === aId)!
  const ucB = USE_CASES.find((u) => u.id === bId)!

  return (
    <div className="space-y-4">
      {/* Header / selectors */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitCompare className="h-4 w-4 text-violet-400" />
          <h2 className="text-sm font-semibold">Compare two use cases</h2>
          <span className="text-[10px] text-slate-500 font-mono">contrast agent decision paths side-by-side</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <UseCasePicker label="Use case A" value={aId} onChange={setAId} accent="sky" />
          <UseCasePicker label="Use case B" value={bId} onChange={setBId} accent="violet" />
        </div>
      </div>

      {/* Side-by-side traces */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CompareColumn run={runA} useCase={ucA} accent="sky" label="A" />
        <CompareColumn run={runB} useCase={ucB} accent="violet" label="B" />
      </div>

      {/* Diff summary */}
      <DiffSummary runA={runA} runB={runB} />
    </div>
  )
}

function UseCasePicker({ label, value, onChange, accent }: { label: string; value: string; onChange: (v: string) => void; accent: 'sky' | 'violet' }) {
  const ring = accent === 'sky' ? 'focus:ring-sky-500/50 border-slate-700' : 'focus:ring-violet-500/50 border-slate-700'
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wide text-slate-400 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 ${ring}`}
      >
        {USE_CASES.map((uc) => (
          <option key={uc.id} value={uc.id}>
            {uc.nameEn} ({LEVEL_META[uc.level].label} · T{uc.tier})
          </option>
        ))}
      </select>
    </div>
  )
}

function CompareColumn({ run, useCase, accent, label }: { run: AgentFlowRun; useCase: UseCase; accent: 'sky' | 'violet'; label: string }) {
  const accentColor = accent === 'sky' ? '#38bdf8' : '#a78bfa'
  const lvl = LEVEL_META[useCase.level]

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-6 w-6 rounded-md text-xs font-bold font-mono" style={{ background: accentColor + '22', color: accentColor }}>
            {label}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-100 leading-tight">{useCase.nameEn}</div>
            <div className="text-[10px] font-mono text-slate-500">{useCase.ruleType.replace('_', ' ')} · {lvl.label}</div>
          </div>
        </div>
        <span
          className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
          style={{ background: TIER_META[run.finalTier].color + '22', color: TIER_META[run.finalTier].color }}
        >
          T{run.finalTier}
        </span>
      </div>

      {/* Vertical stage trace */}
      <div className="relative pl-4">
        {/* vertical rail */}
        <div className="absolute left-[7px] top-1 bottom-1 w-px" style={{ background: accentColor + '40' }} />
        <div className="space-y-1.5">
          {STAGE_ORDER.map((stage, i) => {
            const trace = run.trace.find((t) => t.stage === stage)
            if (!trace) {
              return (
                <div key={stage} className="relative flex items-start gap-2 opacity-40">
                  <span className="absolute -left-4 mt-1 grid place-items-center h-3.5 w-3.5 rounded-full bg-slate-800 border border-slate-700">
                    <Minus className="h-2 w-2 text-slate-600" />
                  </span>
                  <div className="flex-1">
                    <div className="text-[10px] font-mono text-slate-500">{String(i + 1).padStart(2, '0')} · {stage.replace(/_/g, ' ')}</div>
                    <div className="text-[9px] text-slate-600 italic">skipped</div>
                  </div>
                </div>
              )
            }
            return (
              <motion.div
                key={stage}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative flex items-start gap-2"
              >
                <span
                  className="absolute -left-4 mt-0.5 grid place-items-center h-3.5 w-3.5 rounded-full border-2"
                  style={{
                    background: statusColor(trace.status) + '22',
                    borderColor: statusColor(trace.status),
                  }}
                >
                  {trace.status === 'pass' ? <Check className="h-2 w-2" style={{ color: statusColor(trace.status) }} /> : <X className="h-2 w-2" style={{ color: statusColor(trace.status) }} />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono text-slate-200 truncate">{String(i + 1).padStart(2, '0')} · {stage.replace(/_/g, ' ')}</span>
                    <span className="text-[8px] font-mono shrink-0" style={{ color: statusColor(trace.status) }}>{trace.status.toUpperCase()}</span>
                  </div>
                  <div className="text-[9px] text-slate-400 leading-snug line-clamp-2">{trace.reasoning}</div>
                  {trace.branch && (
                    <span className="inline-flex items-center gap-0.5 mt-0.5 text-[8px] font-mono" style={{ color: accentColor }}>
                      <ArrowRight className="h-2 w-2" />{trace.branch}
                    </span>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Outcome footer */}
      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">outcome</span>
        <span className="text-[10px] font-mono font-bold" style={{ color: outcomeColor(run.finalOutcome) }}>
          {run.finalOutcome.toUpperCase()}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {run.finalActions.map((a) => (
          <span key={a} className="rounded bg-slate-800 border border-slate-700 px-1.5 py-0.5 text-[8px] font-mono text-slate-300">{a}</span>
        ))}
      </div>
    </div>
  )
}

function DiffSummary({ runA, runB }: { runA: AgentFlowRun; runB: AgentFlowRun }) {
  const diffs = useMemo(() => {
    const out: Array<{ stage: string; a?: string; b?: string; same: boolean }> = []
    for (const stage of STAGE_ORDER) {
      const ta = runA.trace.find((t) => t.stage === stage)
      const tb = runB.trace.find((t) => t.stage === stage)
      const aStr = ta ? `${ta.status}${ta.branch ? '/' + ta.branch : ''}` : 'skip'
      const bStr = tb ? `${tb.status}${tb.branch ? '/' + tb.branch : ''}` : 'skip'
      out.push({ stage, a: aStr, b: bStr, same: aStr === bStr })
    }
    return out
  }, [runA, runB])

  const divergeCount = diffs.filter((d) => !d.same).length
  const tierDiff = runA.finalTier !== runB.finalTier
  const outcomeDiff = runA.finalOutcome !== runB.finalOutcome

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-amber-400" /> Decision diff
        </h3>
        <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-300">
          {divergeCount} stage{divergeCount === 1 ? '' : 's'} diverge
        </Badge>
      </div>

      {/* top-line summary */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <DiffStat label="Final tier" a={`T${runA.finalTier}`} b={`T${runB.finalTier}`} diff={tierDiff} aColor={TIER_META[runA.finalTier].color} bColor={TIER_META[runB.finalTier].color} />
        <DiffStat label="Outcome" a={runA.finalOutcome} b={runB.finalOutcome} diff={outcomeDiff} aColor={outcomeColor(runA.finalOutcome)} bColor={outcomeColor(runB.finalOutcome)} />
        <DiffStat label="Actions" a={`${runA.finalActions.length}`} b={`${runB.finalActions.length}`} diff={runA.finalActions.length !== runB.finalActions.length} />
      </div>

      {/* stage-by-stage diff table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-[10px] font-mono">
          <thead className="bg-slate-950/60 text-slate-500">
            <tr>
              <th className="px-2 py-1.5 text-left">Stage</th>
              <th className="px-2 py-1.5 text-left">A</th>
              <th className="px-2 py-1.5 text-left">B</th>
              <th className="px-2 py-1.5 text-center">match</th>
            </tr>
          </thead>
          <tbody>
            {diffs.map((d) => (
              <tr key={d.stage} className={`border-t border-slate-800 ${d.same ? '' : 'bg-amber-500/5'}`}>
                <td className="px-2 py-1 text-slate-300">{d.stage.replace(/_/g, ' ')}</td>
                <td className="px-2 py-1 text-sky-300">{d.a}</td>
                <td className="px-2 py-1 text-violet-300">{d.b}</td>
                <td className="px-2 py-1 text-center">
                  {d.same ? <Check className="h-3 w-3 text-emerald-400 inline" /> : <X className="h-3 w-3 text-amber-400 inline" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DiffStat({ label, a, b, diff, aColor, bColor }: { label: string; a: string; b: string; diff: boolean; aColor?: string; bColor?: string }) {
  return (
    <div className={`rounded-lg border p-2 ${diff ? 'border-amber-500/40 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'}`}>
      <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className="flex items-center gap-1 text-[11px] font-mono font-bold">
        <span style={{ color: aColor ?? '#38bdf8' }}>{a}</span>
        <span className="text-slate-600">vs</span>
        <span style={{ color: bColor ?? '#a78bfa' }}>{b}</span>
      </div>
    </div>
  )
}

function statusColor(s: string): string {
  switch (s) {
    case 'pass': return '#22c55e'
    case 'fail': return '#ef4444'
    case 'skip': return '#64748b'
    default: return '#64748b'
  }
}
function outcomeColor(o: string): string {
  switch (o) {
    case 'resolved': return '#34d399'
    case 'retry': return '#fbbf24'
    case 'compensate': return '#f87171'
    case 'suppressed': return '#94a3b8'
    default: return '#94a3b8'
  }
}
