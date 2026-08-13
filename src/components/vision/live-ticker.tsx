'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Radio, Trash2 } from 'lucide-react'
import type { LiveTick } from '@/lib/vision/use-live-data'
import { TIER_META } from '@/lib/vision/types'

interface Props {
  ticks: LiveTick[]
  enabled: boolean
  onToggle: () => void
  onClear: () => void
}

const FEED_LABELS: Record<string, string> = {
  'feed-plaza': 'Plaza San Martín',
  'feed-mall': 'Mall Jockey',
  'feed-warehouse': 'Almacén Callao',
  'feed-river': 'Río Rímac',
}

/**
 * LiveTicker — a compact real-time stream of simulated agent detections.
 * Shows the newest detection at the top with a slide-in animation, the feed,
 * class, z-score, and assigned tier. Lets the VP toggle live mode on/off
 * and clear the stream.
 */
export function LiveTicker({ ticks, enabled, onToggle, onClear }: Props) {
  const criticalCount = ticks.filter((t) => t.tier >= 2).length

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className={`grid place-items-center h-6 w-6 rounded-md ${enabled ? 'bg-rose-500/15' : 'bg-slate-700/30'}`}>
            <Radio className={`h-3.5 w-3.5 ${enabled ? 'text-rose-400' : 'text-slate-500'}`} />
          </span>
          Live detection stream
          {enabled && (
            <span className="flex items-center gap-1 text-[9px] font-mono text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" /> live
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          {ticks.length > 0 && (
            <span className="text-[9px] font-mono text-slate-500 mr-1">{criticalCount} anomaly+ / {ticks.length}</span>
          )}
          <button
            onClick={onClear}
            disabled={ticks.length === 0}
            className="grid place-items-center h-7 w-7 rounded-md border border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
            aria-label="Clear live stream"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onToggle}
            className={`rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold transition border ${
              enabled
                ? 'border-rose-500/50 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {enabled ? 'Stop' : 'Start live'}
          </button>
        </div>
      </div>

      {!enabled && ticks.length === 0 ? (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Start live mode to stream simulated 1 Hz detections from the 4 camera feeds —
          the agent will classify each into a tier (nominal → critical) in real time.
        </p>
      ) : (
        <div className="max-h-[260px] overflow-y-auto pr-1 space-y-1">
          <AnimatePresence initial={false}>
            {ticks.map((t) => {
              const tier = TIER_META[t.tier as 0 | 1 | 2 | 3]
              const ago = Math.round((Date.now() - t.ts) / 1000)
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: 12, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/40 px-2.5 py-1.5"
                >
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: tier.color, boxShadow: `0 0 6px ${tier.glow}` }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-200 truncate">{t.className}</span>
                      <span className="text-[9px] font-mono text-slate-500 truncate">{FEED_LABELS[t.feedId] ?? t.feedId}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-mono text-slate-500">z={t.z.toFixed(2)}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[8px] font-mono font-bold"
                      style={{ background: tier.color + '22', color: tier.color }}
                    >
                      {tier.short}
                    </span>
                    <span className="text-[8px] font-mono text-slate-600 w-8 text-right">{ago}s</span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
