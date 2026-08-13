'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, Clock, Hash, GitBranch, Zap } from 'lucide-react'
import type { AgentFlowRun, FlowNode, StageTrace } from '@/lib/vision/types'
import { TIER_META } from '@/lib/vision/types'
import { FLOW_EDGES, NODE_BY_ID, STAGE_ORDER } from '@/lib/vision/agent-flow'

interface Props {
  node: FlowNode | null
  run: AgentFlowRun | null
  onClose: () => void
}

/**
 * NodeInspector — slide-in drawer showing full detail of a selected flow node:
 * description, stage trace (if any), incoming/outgoing branches, and the
 * simplified agent reasoning at that stage.
 */
export function NodeInspector({ node, run, onClose }: Props) {
  return (
    <AnimatePresence>
      {node && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl overflow-y-auto"
          >
            <NodeInspectorContent node={node} run={run} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function NodeInspectorContent({ node, run, onClose }: Props) {
  const trace = run?.trace.find((t) => stageIdFor(t.stage) === node.id) ?? null
  const incoming = FLOW_EDGES.filter((e) => e.target === node.id)
  const outgoing = FLOW_EDGES.filter((e) => e.source === node.id)
  const stageIndex = STAGE_ORDER.findIndex((s) => stageIdFor(s) === node.id)
  const isTerminal = node.type === 'terminal'

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="grid place-items-center h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/30">
              <span className="text-amber-300 font-bold text-xs font-mono">{node.short}</span>
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
              {isTerminal ? 'Terminal state' : `Stage ${stageIndex + 1} of ${STAGE_ORDER.length}`}
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-50 leading-tight">{node.label}</h2>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
            {node.stage} · {node.type}
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid place-items-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Description */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">What this stage does</div>
        <p className="text-sm text-slate-200 leading-relaxed">{node.description}</p>
      </div>

      {/* Stage trace (if this run visited the stage) */}
      {trace ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Agent reasoning this cycle</div>
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
              style={{
                background: statusBg(trace.status),
                color: statusFg(trace.status),
              }}
            >
              {trace.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-slate-100 leading-relaxed">{trace.reasoning}</p>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <Clock className="h-3 w-3" />
            {new Date(trace.timestamp).toLocaleTimeString()}
            {trace.tier !== undefined && (
              <span className="ml-2 flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: TIER_META[trace.tier].color }}
                />
                Tier {trace.tier}
              </span>
            )}
            {trace.branch && (
              <span className="ml-2 flex items-center gap-1 text-sky-300">
                <GitBranch className="h-3 w-3" />
                → {trace.branch}
              </span>
            )}
          </div>
          <div className="rounded bg-slate-950/60 border border-slate-800 px-2.5 py-1.5 text-[11px] font-mono text-slate-400">
            {trace.detail}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-3.5 text-center">
          <div className="text-[11px] text-slate-500 leading-relaxed">
            {isTerminal
              ? 'Terminal state — reached when the agent ends a branch (resolved, suppressed, escalated, or retrying).'
              : 'This stage was not visited in the current cycle. Run the trace to see the agent\'s reasoning here.'}
          </div>
        </div>
      )}

      {/* Branches */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
        <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
          <GitBranch className="h-3 w-3" /> Decision branches
        </div>
        <div className="space-y-2">
          {outgoing.length === 0 ? (
            <div className="text-[11px] text-slate-500">No outgoing branches — terminal state.</div>
          ) : (
            outgoing.map((e, i) => {
              const tgt = NODE_BY_ID[e.target]
              const isTaken = trace?.branch === e.branch
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                    isTaken ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-700/60 bg-slate-950/40'
                  }`}
                >
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
                    style={{ background: branchBg(e.branch), color: branchFg(e.branch) }}
                  >
                    {e.label.toUpperCase()}
                  </span>
                  <ArrowRight className="h-3 w-3 text-slate-600" />
                  <span className="text-[11px] text-slate-300 flex-1 truncate">{tgt?.label}</span>
                  {isTaken && (
                    <span className="text-[9px] font-mono text-emerald-400 flex items-center gap-0.5">
                      <Zap className="h-3 w-3" /> taken
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Incoming */}
      {incoming.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
            <Hash className="h-3 w-3" /> Incoming from
          </div>
          <div className="space-y-1.5">
            {incoming.map((e, i) => {
              const src = NODE_BY_ID[e.source]
              return (
                <div key={i} className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span className="text-slate-300">{src?.label}</span>
                  <ArrowRight className="h-3 w-3 text-slate-600" />
                  <span style={{ color: branchFg(e.branch) }}>{e.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Use case context */}
      {run && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Active use case</div>
          <div className="text-sm font-semibold text-slate-100">{run.useCaseName}</div>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] font-mono text-slate-500">
            <span>cycle #{run.cycle}</span>
            <span>·</span>
            <span style={{ color: TIER_META[run.finalTier].color }}>Tier {run.finalTier}</span>
            <span>·</span>
            <span className="uppercase" style={{ color: outcomeColor(run.finalOutcome) }}>{run.finalOutcome}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────
const STAGE_ID_BY_STAGE: Record<string, string> = {
  OBSERVE: 'observe',
  VALIDATE_EVIDENCE: 'validate_evidence',
  POLICY: 'policy',
  JUDGE: 'judge',
  VALIDATE_JUDGE: 'validate_judge',
  PROPOSE_ACTION: 'propose_action',
  APPROVAL: 'approval',
  EXECUTE: 'execute',
  VERIFY_OUTCOME: 'verify_outcome',
}
function stageIdFor(stage: string): string {
  return STAGE_ID_BY_STAGE[stage] ?? stage.toLowerCase()
}

function statusBg(s: string): string {
  switch (s) {
    case 'pass': return 'rgba(16,185,129,0.15)'
    case 'fail': return 'rgba(239,68,68,0.15)'
    case 'skip': return 'rgba(100,116,139,0.15)'
    case 'active': return 'rgba(251,191,36,0.15)'
    default: return 'rgba(100,116,139,0.15)'
  }
}
function statusFg(s: string): string {
  switch (s) {
    case 'pass': return '#34d399'
    case 'fail': return '#f87171'
    case 'skip': return '#94a3b8'
    case 'active': return '#fbbf24'
    default: return '#94a3b8'
  }
}
const BRANCH_BG: Record<string, string> = {
  pass: 'rgba(16,185,129,0.15)', fail: 'rgba(239,68,68,0.15)', tier0: 'rgba(16,185,129,0.15)',
  tier1: 'rgba(245,158,11,0.15)', tier2: 'rgba(249,115,22,0.15)', tier3: 'rgba(239,68,68,0.15)',
  approve: 'rgba(16,185,129,0.15)', reject: 'rgba(239,68,68,0.15)', retry: 'rgba(245,158,11,0.15)',
  suppressed: 'rgba(100,116,139,0.15)', resolve: 'rgba(16,185,129,0.15)', compensate: 'rgba(239,68,68,0.15)',
}
const BRANCH_FG: Record<string, string> = {
  pass: '#34d399', fail: '#f87171', tier0: '#34d399', tier1: '#fbbf24', tier2: '#fb923c', tier3: '#f87171',
  approve: '#34d399', reject: '#f87171', retry: '#fbbf24', suppressed: '#94a3b8', resolve: '#34d399', compensate: '#f87171',
}
function branchBg(b: string): string { return BRANCH_BG[b] ?? 'rgba(100,116,139,0.15)' }
function branchFg(b: string): string { return BRANCH_FG[b] ?? '#94a3b8' }
function outcomeColor(o: string): string {
  switch (o) {
    case 'resolved': return '#34d399'
    case 'retry': return '#fbbf24'
    case 'compensate': return '#f87171'
    case 'suppressed': return '#94a3b8'
    default: return '#94a3b8'
  }
}

export { stageIdFor }
