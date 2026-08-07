'use client'

import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { usePrototypeStore } from '@/lib/store'

/**
 * Real-time chart of person count vs 2-min average.
 * Pure SVG — no Recharts dependency, lighter weight for live updates.
 */
export function CountChart() {
  const samples = usePrototypeStore((s) => s.samples)
  const stats = usePrototypeStore((s) => s.stats)

  const { points, avgPoints, bandPath, areaPath, maxCount, anomalyFlags } = useMemo(() => {
    const N = samples.length
    if (N < 2) {
      return { points: '', avgPoints: '', bandPath: '', areaPath: '', maxCount: 30, anomalyFlags: [] as number[] }
    }
    const w = 600
    const h = 160
    const padding = { top: 10, right: 8, bottom: 18, left: 28 }
    const innerW = w - padding.left - padding.right
    const innerH = h - padding.top - padding.bottom

    const counts = samples.map((s) => s.count)
    const maxRaw = Math.max(...counts, 10)
    const maxCount = Math.ceil(maxRaw * 1.2)

    const xStep = innerW / Math.max(N - 1, 1)
    const yScale = (v: number) => padding.top + innerH - (v / maxCount) * innerH

    // Build raw count line
    const points = samples
      .map((s, i) => `${padding.left + i * xStep},${yScale(s.count)}`)
      .join(' ')

    // Build rolling-avg line (same window as anomaly stats: last 120 samples)
    const windowSize = 120
    const avgs: number[] = []
    for (let i = 0; i < N; i++) {
      const start = Math.max(0, i - windowSize + 1)
      const slice = samples.slice(start, i + 1)
      const avg = slice.reduce((a, s) => a + s.count, 0) / slice.length
      avgs.push(avg)
    }
    const avgPoints = avgs
      .map((a, i) => `${padding.left + i * xStep},${yScale(a)}`)
      .join(' ')

    // Build ±1σ band (filled area around the average line)
    const stdDevs: number[] = []
    for (let i = 0; i < N; i++) {
      const start = Math.max(0, i - windowSize + 1)
      const slice = samples.slice(start, i + 1)
      const avg = avgs[i]
      const variance = slice.reduce((a, s) => a + (s.count - avg) ** 2, 0) / slice.length
      stdDevs.push(Math.sqrt(variance))
    }
    const upper = avgs.map((a, i) => a + stdDevs[i])
    const lower = avgs.map((a, i) => Math.max(0, a - stdDevs[i]))
    const upperLine = upper.map((v, i) => `${padding.left + i * xStep},${yScale(v)}`).join(' ')
    const lowerLine = lower
      .map((v, i) => `${padding.left + (N - 1 - i) * xStep},${yScale(v)}`)
      .join(' ')
    const bandPath = `M ${upperLine} L ${lowerLine} Z`

    // Area under the count line
    const last = padding.left + (N - 1) * xStep
    const first = padding.left
    const baseY = padding.top + innerH
    const areaPath = `M ${first},${baseY} L ${points} L ${last},${baseY} Z`

    // Anomaly tick marks (where z-score > threshold)
    const flags: number[] = []
    for (let i = 0; i < N; i++) {
      const start = Math.max(0, i - windowSize + 1)
      const slice = samples.slice(start, i + 1)
      const avg = avgs[i]
      const variance = slice.reduce((a, s) => a + (s.count - avg) ** 2, 0) / slice.length
      const sd = Math.sqrt(variance)
      if (sd > 0 && (samples[i].count - avg) / sd > 2) {
        flags.push(i)
      }
    }

    return { points, avgPoints, bandPath, areaPath, maxCount, anomalyFlags: flags }
  }, [samples])

  const W = 600
  const H = 160
  const padding = { top: 10, right: 8, bottom: 18, left: 28 }
  const innerH = H - padding.top - padding.bottom
  const yTicks = [0, Math.round(maxCount / 2), maxCount]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Person count vs 2-min average</h3>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" />
            Count
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-zinc-300" />
            Avg ± σ
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-amber-500" />
            Anomaly
          </span>
        </div>
      </div>
      {/* ELI5 hint */}
      <div className="mb-2 rounded-md bg-zinc-50 border border-zinc-100 px-2.5 py-1 text-[10px] text-zinc-500 leading-relaxed">
        💡 <strong>¿Cómo leerlo?</strong> Línea verde = detecciones actuales. Banda gris = promedio
        ± desviación de los últimos 2 minutos. Puntos ámbar = anomalías (z-score &gt; 2).
        Si la línea verde sube muy por encima de la banda, el agente activa alertas.
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" preserveAspectRatio="none">
        {/* Grid lines */}
        {yTicks.map((v) => {
          const y = padding.top + innerH - (v / maxCount) * innerH
          return (
            <g key={v}>
              <line x1={padding.left} y1={y} x2={W - padding.right} y2={y} stroke="#f4f4f5" strokeWidth={1} />
              <text x={padding.left - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#a1a1aa" fontFamily="ui-monospace, monospace">
                {v}
              </text>
            </g>
          )
        })}
        {/* ±1σ band */}
        {bandPath && <path d={bandPath} fill="#f4f4f5" opacity={0.6} />}
        {/* Area under count line */}
        {areaPath && <path d={areaPath} fill="#10b981" opacity={0.12} />}
        {/* Average line */}
        {avgPoints && <polyline points={avgPoints} fill="none" stroke="#a1a1aa" strokeWidth={1.5} strokeDasharray="3 2" />}
        {/* Count line */}
        {points && <polyline points={points} fill="none" stroke="#059669" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {/* Anomaly ticks */}
        {anomalyFlags.map((i) => {
          const x = padding.left + i * ((W - padding.left - padding.right) / Math.max(samples.length - 1, 1))
          return <circle key={i} cx={x} cy={padding.top + 4} r={2.5} fill="#f59e0b" />
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
        <span>{samples.length > 0 ? `${samples.length} samples` : 'No data yet'}</span>
        {stats && (
          <span>
            z={stats.zScore.toFixed(2)} · EMA={stats.ema.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}
