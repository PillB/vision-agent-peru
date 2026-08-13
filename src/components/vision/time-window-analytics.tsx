'use client'

import { useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Clock, TrendingUp, Activity, Zap } from 'lucide-react'
import type { EntityNetwork } from '@/lib/vision/types'
import { TIER_META } from '@/lib/vision/types'

type WindowKey = '5m' | '15m' | '60m' | '24h'

const WINDOWS: { key: WindowKey; label: string; ms: number }[] = [
  { key: '5m', label: '5 min', ms: 5 * 60 * 1000 },
  { key: '15m', label: '15 min', ms: 15 * 60 * 1000 },
  { key: '60m', label: '1 hour', ms: 60 * 60 * 1000 },
  { key: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
]

interface Props {
  network: EntityNetwork
}

/**
 * TimeWindowAnalytics — lets the VP pick a time window and see how the
 * correlation network stats shift (detection volume, avg correlation,
 * tier distribution, top-correlated pair in the window).
 *
 * Simulated by reweighting the seeded network data using each entity's
 * `lastSeenMs` (more recent = more weight in shorter windows).
 */
export function TimeWindowAnalytics({ network }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>('15m')
  const win = WINDOWS.find((w) => w.key === windowKey)!
  const now = Date.now()

  const stats = useMemo(() => {
    // Entities "active" in the window = lastSeen within the window
    const activeNodes = network.nodes.filter((n) => now - n.lastSeenMs <= win.ms)
    const activeIds = new Set(activeNodes.map((n) => n.id))
    const activeEdges = network.edges.filter(
      (e) => activeIds.has(e.source) && activeIds.has(e.target),
    )
    // Detection volume in the window (proportional estimate)
    const detections = activeNodes.reduce((s, n) => s + Math.round(n.detectionCount * (win.ms / (60 * 60 * 1000))), 0)
    const avgCorr = activeEdges.length > 0
      ? activeEdges.reduce((s, e) => s + e.correlationScore, 0) / activeEdges.length
      : 0
    const tierCounts = { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number>
    activeNodes.forEach((n) => { tierCounts[n.tier]++ })
    const topPair = activeEdges.length > 0
      ? [...activeEdges].sort((a, b) => b.correlationScore - a.correlationScore)[0]
      : null
    return { activeNodes, activeEdges, detections, avgCorr, tierCounts, topPair }
  }, [network, win.ms, now])

  // Sparkline data — simulate detection volume over the window (12 buckets)
  const sparkline = useMemo(() => {
    const buckets = 12
    const seed = win.ms // deterministic per window
    const pts: number[] = []
    for (let i = 0; i < buckets; i++) {
      // pseudo-random but deterministic, scaled by activeNodes count
      const r = Math.abs(Math.sin(seed + i * 1.7)) * 0.6 + 0.3
      pts.push(Math.round(stats.detections * r / buckets))
    }
    return pts
  }, [win.ms, stats.detections])

  const maxSpark = Math.max(...sparkline, 1)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="grid place-items-center h-6 w-6 rounded-md bg-emerald-500/15">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
          </span>
          Time-windowed analytics
        </h3>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindowKey(w.key)}
              className={`rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold transition ${
                windowKey === w.key
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
        <Kpi label="Active entities" value={stats.activeNodes.length} icon={Activity} accent="#38bdf8" />
        <Kpi label="Correlations" value={stats.activeEdges.length} icon={TrendingUp} accent="#22d3ee" />
        <Kpi label="Avg ρ" value={stats.avgCorr.toFixed(2)} icon={Zap} accent="#34d399" />
        <Kpi label="Est. detections" value={stats.detections.toLocaleString()} icon={Activity} accent="#fbbf24" />
      </div>

      {/* Sparkline */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Detection volume · last {win.label}</span>
          <span className="text-[10px] font-mono text-slate-400">{sparkline.reduce((s, v) => s + v, 0).toLocaleString()} total</span>
        </div>
        <div className="flex items-end gap-1 h-12">
          {sparkline.map((v, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${(v / maxSpark) * 100}%` }}
              transition={{ duration: 0.4, delay: i * 0.03 }}
              className="flex-1 rounded-t bg-gradient-to-t from-emerald-500/40 to-emerald-400 min-h-[2px]"
              style={{ opacity: 0.4 + (v / maxSpark) * 0.6 }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1 text-[8px] font-mono text-slate-600">
          <span>{win.label} ago</span>
          <span>now</span>
        </div>
      </div>

      {/* Tier distribution + top pair */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Tier distribution (active)</div>
          <div className="space-y-1.5">
            {([0, 1, 2, 3] as const).map((t) => {
              const count = stats.tierCounts[t] ?? 0
              const total = stats.activeNodes.length || 1
              const pct = (count / total) * 100
              return (
                <div key={t} className="flex items-center gap-2">
                  <span className="w-12 text-[10px] font-mono font-bold" style={{ color: TIER_META[t].color }}>
                    {TIER_META[t].short}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.4 }}
                      className="h-full rounded-full"
                      style={{ background: TIER_META[t].color }}
                    />
                  </div>
                  <span className="w-6 text-right text-[10px] font-mono text-slate-400">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Top correlated pair (active)</div>
          {stats.topPair ? (
            <div>
              <PairLabel network={network} edge={stats.topPair} />
              <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${stats.topPair.correlationScore * 100}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-slate-500">
                <span>{stats.topPair.encounterCount}× · {stats.topPair.sharedFrames}f</span>
                <span>ρ={stats.topPair.correlationScore.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 italic">No active correlations in this window.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: typeof Clock; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className="h-3 w-3" style={{ color: accent }} />
      </div>
      <div className="text-lg font-bold font-mono" style={{ color: accent }}>{value}</div>
    </div>
  )
}

function PairLabel({ network, edge }: { network: EntityNetwork; edge: { source: string; target: string } }) {
  const a = network.nodes.find((n) => n.id === edge.source)
  const b = network.nodes.find((n) => n.id === edge.target)
  return (
    <div className="text-[11px] font-mono text-slate-200">
      <span className="text-sky-300">{a?.label ?? '?'}</span>
      <span className="text-slate-500"> ↔ </span>
      <span className="text-sky-300">{b?.label ?? '?'}</span>
    </div>
  )
}
