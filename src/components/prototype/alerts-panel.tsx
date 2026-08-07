'use client'

import { useState, useMemo } from 'react'
import { AlertTriangle, Check, Bell, BellOff, ChevronDown, ChevronRight, X, Trash2, Activity, FileText } from 'lucide-react'
import { usePrototypeStore, type AlertHit } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

const TIER_LABELS: Record<number, { label: string; color: string; bg: string; dot: string }> = {
  3: { label: 'Critical', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', dot: 'bg-rose-600' },
  2: { label: 'Anomaly', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  1: { label: 'Watch', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  0: { label: 'Nominal', color: 'text-zinc-600', bg: 'bg-zinc-50 border-zinc-200', dot: 'bg-zinc-400' },
}

export function AlertsPanel() {
  const hits = usePrototypeStore((s) => s.hits)
  const reports = usePrototypeStore((s) => s.reports)
  const acknowledgeHit = usePrototypeStore((s) => s.acknowledgeHit)
  const acknowledge = usePrototypeStore((s) => s.acknowledge)

  // Compute alert rate (alerts per hour based on first and last hit timestamps)
  const alertRate = useMemo(() => {
    if (hits.length < 2) return 0
    const first = hits[hits.length - 1].timestamp
    const last = hits[0].timestamp
    const elapsedHours = (last - first) / 3_600_000
    return elapsedHours > 0 ? Math.round(hits.length / elapsedHours) : 0
  }, [hits])

  // Check if a hit has a corresponding report
  const hasReport = (hit: AlertHit) => {
    return reports.some(r => r.hitIds?.includes(hit.id))
  }

  // Group hits by tier for folding
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set([2, 3])) // expand T2+T3 by default

  const grouped = useMemo(() => {
    const groups: Record<number, AlertHit[]> = { 3: [], 2: [], 1: [], 0: [] }
    for (const hit of hits) {
      const tier = hit.tier as number
      if (!groups[tier]) groups[tier] = []
      groups[tier].push(hit)
    }
    return groups
  }, [hits])

  const unackCount = hits.filter(h => !h.acknowledged).length

  const toggleTier = (tier: number) => {
    setExpandedTiers(prev => {
      const next = new Set(prev)
      if (next.has(tier)) next.delete(tier)
      else next.add(tier)
      return next
    })
  }

  const ackAllInTier = (tier: number) => {
    grouped[tier]?.forEach(h => !h.acknowledged && acknowledgeHit(h.id))
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Alerts & incidents</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {unackCount > 0 && (
            <Badge className="text-[10px] h-5 px-1.5 bg-amber-500 text-white animate-pulse">
              {unackCount} new
            </Badge>
          )}
          <Badge variant="outline" className="text-xs font-mono">{hits.length}</Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => acknowledge(5)}
            title="Silence alerts for 5 minutes"
          >
            <BellOff className="h-3 w-3 mr-1" />
            Silence 5m
          </Button>
        </div>
      </div>

      {/* ELI5 hint + alert rate */}
      <div className="mb-2 flex items-center justify-between">
        <div className="rounded-md bg-amber-50 border border-amber-100 px-2.5 py-1 text-[10px] text-zinc-600 leading-relaxed flex-1">
          💡 <strong>¿Qué es esto?</strong> Alertas agrupadas por severidad. Click para expandir/contraer.
        </div>
        {alertRate > 0 && (
          <div className="ml-2 flex items-center gap-1 text-[10px] text-zinc-500">
            <Activity className="h-2.5 w-2.5" />
            <span className="font-mono">{alertRate}/hr</span>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 max-h-[380px] pr-2">
        {hits.length === 0 ? (
          <div className="text-center py-10 text-xs text-zinc-400">
            <Bell className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
            No anomalies detected yet.
            <br />
            <span className="text-zinc-500">Run the analysis to populate this panel.</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Render grouped by tier (3 → 2 → 1 → 0) */}
            {[3, 2, 1, 0].map(tier => {
              const tierHits = grouped[tier] || []
              if (tierHits.length === 0) return null
              const meta = TIER_LABELS[tier] || TIER_LABELS[0]
              const isExpanded = expandedTiers.has(tier)
              const tierUnack = tierHits.filter(h => !h.acknowledged).length

              return (
                <div key={tier} className={`rounded-lg border ${meta.bg} overflow-hidden`}>
                  {/* Tier header — clickable to fold/unfold */}
                  <button
                    onClick={() => toggleTier(tier)}
                    className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-black/5 transition"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded
                        ? <ChevronDown className="h-3 w-3 text-zinc-500" />
                        : <ChevronRight className="h-3 w-3 text-zinc-500" />
                      }
                      <span className={`h-2 w-2 rounded-full ${meta.dot} ${tierUnack > 0 ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs font-semibold ${meta.color}`}>
                        Tier {tier} · {meta.label}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {tierHits.length}
                      </Badge>
                      {tierUnack > 0 && (
                        <span className="text-[9px] text-amber-600 font-medium">
                          ({tierUnack} unack)
                        </span>
                      )}
                    </div>
                    {tierUnack > 0 && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); ackAllInTier(tier) }}
                        className="text-[9px] text-emerald-700 hover:underline cursor-pointer"
                      >
                        Ack all
                      </span>
                    )}
                  </button>

                  {/* Tier body — collapsible */}
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-1.5 max-h-[200px] overflow-y-auto">
                      {tierHits.map(hit => (
                        <CompactHitCard key={hit.id} hit={hit} onAck={() => acknowledgeHit(hit.id)} hasReport={hasReport(hit)} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

/** Compact hit card — smaller than the old one to prevent occlusion */
function CompactHitCard({ hit, onAck, hasReport }: { hit: AlertHit; onAck: () => void; hasReport: boolean }) {
  const meta = TIER_LABELS[hit.tier] || TIER_LABELS[0]
  const lifecycleColors: Record<string, string> = {
    candidate: 'text-amber-600',
    confirmed: 'text-rose-600',
    active: 'text-rose-700 font-semibold',
    recovering: 'text-blue-600',
    resolved: 'text-zinc-400',
  }
  const lifecycleLabel = hit.lifecycle ? hit.lifecycle.toUpperCase() : ''

  return (
    <div className={`rounded-md border p-2 ${hit.acknowledged ? 'bg-white/50 border-zinc-200 opacity-60' : 'bg-white/80 border-zinc-300'}`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] font-mono text-zinc-500">
          {new Date(hit.timestamp).toLocaleTimeString('en-US', { hour12: false })}
        </span>
        <div className="flex items-center gap-1.5">
          {lifecycleLabel && (
            <span className={`text-[8px] font-mono ${lifecycleColors[hit.lifecycle!] || 'text-zinc-500'}`}>
              {lifecycleLabel}
            </span>
          )}
          {!hit.acknowledged ? (
            <button
              onClick={onAck}
              className="text-[9px] text-emerald-700 hover:underline flex items-center gap-0.5"
              title="Acknowledge this alert"
            >
              <Check className="h-2.5 w-2.5" /> Ack
            </button>
          ) : (
            <span className="text-[9px] text-zinc-400">✓</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] mb-1">
        <span className="font-mono text-zinc-950 font-semibold">{hit.count}</span>
        <span className="text-zinc-500">dets</span>
        <span className="text-zinc-300">·</span>
        <span className="font-mono text-zinc-950">{hit.zScore.toFixed(2)}</span>
        <span className="text-zinc-500">z</span>
      </div>
      <div className="text-[9px] text-zinc-500 leading-tight line-clamp-2">{hit.reasoning}</div>
      {/* Evidence chain: show if report exists for this hit */}
      {hasReport && (
        <div className="mt-0.5 flex items-center gap-0.5 text-[8px] text-emerald-600">
          <FileText className="h-2 w-2" />
          <span>Report generated</span>
        </div>
      )}
      {hit.snapshotDataUrl && (
        <details className="mt-1">
          <summary className="text-[9px] text-emerald-700 cursor-pointer hover:underline">
            Snapshot
          </summary>
          <img src={hit.snapshotDataUrl} alt="snapshot" className="mt-1 rounded max-h-20 w-full object-cover" />
        </details>
      )}
    </div>
  )
}
