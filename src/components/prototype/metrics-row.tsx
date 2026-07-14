'use client'

import { TrendingUp, Activity, Brain, AlertTriangle, Camera, Clock, Gauge } from 'lucide-react'
import { usePrototypeStore } from '@/lib/store'

export function MetricsRow() {
  const stats = usePrototypeStore((s) => s.stats)
  const personCount = usePrototypeStore((s) => s.personCount)
  const currentTier = usePrototypeStore((s) => s.currentTier)
  const lastDetectionLatencyMs = usePrototypeStore((s) => s.lastDetectionLatencyMs)
  const agentCycleCount = usePrototypeStore((s) => s.agentCycleCount)
  const hits = usePrototypeStore((s) => s.hits)
  const activeCameraId = usePrototypeStore((s) => s.activeCameraId)

  const z = stats?.zScore ?? 0
  const mean = stats?.mean ?? 0
  const stddev = stats?.stddev ?? 0

  const activeHits = hits.filter((h) => !h.acknowledged).length

  const tiles = [
    {
      icon: <Camera className="h-3.5 w-3.5" />,
      label: 'Camera',
      value: activeCameraId.toUpperCase(),
      sub: 'Live',
      tone: 'zinc' as const,
    },
    {
      icon: <TrendingUp className="h-3.5 w-3.5" />,
      label: 'Persons now',
      value: String(personCount),
      sub: `2-min avg: ${mean.toFixed(1)} (σ ${stddev.toFixed(1)})`,
      tone: 'emerald' as const,
    },
    {
      icon: <Gauge className="h-3.5 w-3.5" />,
      label: 'Z-score',
      value: z.toFixed(2),
      sub: z > 3.5 ? 'Critical' : z > 2.5 ? 'Anomaly' : z > 2 ? 'Watch' : 'Nominal',
      tone: z > 3.5 ? ('rose' as const) : z > 2 ? ('amber' as const) : ('emerald' as const),
    },
    {
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      label: 'Active incidents',
      value: String(activeHits),
      sub: `${hits.length} total logged`,
      tone: activeHits > 0 ? ('amber' as const) : ('emerald' as const),
    },
    {
      icon: <Activity className="h-3.5 w-3.5" />,
      label: 'Tier',
      value: String(currentTier),
      sub: currentTier === 3 ? 'Critical' : currentTier === 2 ? 'Anomaly' : currentTier === 1 ? 'Watch' : 'Nominal',
      tone: currentTier >= 3 ? ('rose' as const) : currentTier >= 1 ? ('amber' as const) : ('emerald' as const),
    },
    {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: 'Last latency',
      value: `${lastDetectionLatencyMs.toFixed(0)}ms`,
      sub: `${agentCycleCount} cycles`,
      tone: 'zinc' as const,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
      {tiles.map((t) => (
        <Tile key={t.label} {...t} />
      ))}
    </div>
  )
}

function Tile({ icon, label, value, sub, tone }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone: 'zinc' | 'emerald' | 'amber' | 'rose'
}) {
  const valueColor = {
    zinc: 'text-zinc-950',
    emerald: 'text-emerald-700',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
  }[tone]
  const dotColor = {
    zinc: 'bg-zinc-400',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-600',
  }[tone]
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
          {icon}
          {label}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      </div>
      <div className={`font-mono text-xl font-medium tabular-nums leading-none ${valueColor}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] text-zinc-500 leading-tight">{sub}</div>
    </div>
  )
}
