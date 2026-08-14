'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CoOccurrenceNetwork, SubjectTrack } from '@/lib/subject-reid'

interface Props {
  network: CoOccurrenceNetwork | null
  windowedNetworks?: Partial<Record<30000 | 120000 | 600000, CoOccurrenceNetwork>>
  width?: number
  height?: number
}

/**
 * CoOccurrenceGraph — force-directed network visualization.
 *
 * Nodes = tracked subjects (sized by detection count)
 * Edges = co-occurrence relationships (thickness = familiarity score)
 * Colors = subject classes (person=blue, car=green, etc.)
 *
 * Shows which subjects frequently share the screen, their proximity,
 * and their familiarity score. This is NOT identity — appearance
 * similarity does not establish identity (Solarize section 2).
 */
export function CoOccurrenceGraph({ network, windowedNetworks, width = 400, height = 300 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const positionsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number }>>(new Map())
  const [windowMs, setWindowMs] = useState<number | 'session'>('session')
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null)

  const filteredNetwork = useMemo<CoOccurrenceNetwork | null>(() => {
    if (!network) return null
    if (windowMs === 'session') return network
    const measuredWindow = windowedNetworks?.[windowMs]
    if (measuredWindow) return measuredWindow
    const latest = Math.max(
      ...network.nodes.map(node => node.lastSeen),
      ...network.edges.map(edge => edge.lastSeen),
      0,
    )
    const cutoff = latest - windowMs
    const edges = network.edges.filter(edge => edge.lastSeen >= cutoff)
    const visibleIds = new Set(edges.flatMap(edge => [edge.source, edge.target]))
    const nodes = network.nodes.filter(node => node.lastSeen >= cutoff || visibleIds.has(node.trackId))
    return { ...network, nodes, edges, totalSubjects: nodes.length }
  }, [network, windowedNetworks, windowMs])

  const selectedTrack = filteredNetwork?.nodes.find(node => node.trackId === selectedTrackId) ?? null
  const selectedEdges = filteredNetwork?.edges.filter(edge => edge.source === selectedTrackId || edge.target === selectedTrackId) ?? []

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !filteredNetwork) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = width
    canvas.height = height

    // Keep the canvas legible in crowded scenes. The complete network remains
    // available in `network` and the ranked edge table below; the visualization
    // prioritizes the most-observed subjects and strongest relationships.
    const nodes = [...filteredNetwork.nodes]
      .sort((a, b) => b.detectionCount - a.detectionCount)
      .slice(0, 12)
    if (nodes.length === 0) return
    const visibleNodeIds = new Set(nodes.map(node => node.trackId))
    const degree = new Map<string, number>()
    const edges = filteredNetwork.edges.filter(edge => {
      if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) return false
      if ((degree.get(edge.source) ?? 0) >= 3 || (degree.get(edge.target) ?? 0) >= 3) return false
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
      return true
    }).slice(0, 18)

    positionsRef.current.clear()
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      const radius = Math.min(width, height) * 0.35
      positionsRef.current.set(node.trackId, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      })
    })

    const colors: Record<string, string> = {
      person: '#3b82f6',
      car: '#10b981',
      truck: '#10b981',
      bus: '#f59e0b',
      motorcycle: '#ef4444',
      bicycle: '#8b5cf6',
      backpack: '#ec4899',
      fire: '#ef4444',
      flood: '#3b82f6',
      default: '#6b7280',
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      // Apply forces (simplified force-directed layout)
      const positions = positionsRef.current
      const repulsion = 800
      const attraction = 0.02

      // Repulsion between all nodes
      for (const [idA, posA] of positions) {
        for (const [idB, posB] of positions) {
          if (idA === idB) continue
          const dx = posA.x - posB.x
          const dy = posA.y - posB.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = repulsion / (dist * dist)
          posA.vx += (dx / dist) * force * 0.01
          posA.vy += (dy / dist) * force * 0.01
        }
      }

      // Attraction along edges
      for (const edge of edges) {
        const posA = positions.get(edge.source)
        const posB = positions.get(edge.target)
        if (!posA || !posB) continue
        const dx = posB.x - posA.x
        const dy = posB.y - posA.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = attraction * dist * edge.familiarityScore
        posA.vx += (dx / dist) * force
        posA.vy += (dy / dist) * force
        posB.vx -= (dx / dist) * force
        posB.vy -= (dy / dist) * force
      }

      // Center gravity
      for (const pos of positions.values()) {
        pos.vx += (width / 2 - pos.x) * 0.001
        pos.vy += (height / 2 - pos.y) * 0.001
      }

      // Update positions with damping
      for (const pos of positions.values()) {
        pos.vx *= 0.9
        pos.vy *= 0.9
        pos.x += pos.vx
        pos.y += pos.vy
        // Keep within bounds
        pos.x = Math.max(20, Math.min(width - 20, pos.x))
        pos.y = Math.max(20, Math.min(height - 20, pos.y))
      }

      // Draw edges
      for (const [edgeIndex, edge] of edges.entries()) {
        const posA = positions.get(edge.source)
        const posB = positions.get(edge.target)
        if (!posA || !posB) continue

        const opacity = Math.max(0.1, edge.familiarityScore)
        const lineWidth = Math.max(0.5, edge.familiarityScore * 4)

        ctx.strokeStyle = `rgba(100, 116, 139, ${opacity})`
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.moveTo(posA.x, posA.y)
        ctx.lineTo(posB.x, posB.y)
        ctx.stroke()

        // Draw familiarity score on edge
        if (edgeIndex < 5 && edge.familiarityScore > 0.3) {
          const midX = (posA.x + posB.x) / 2
          const midY = (posA.y + posB.y) / 2
          ctx.fillStyle = `rgba(30, 41, 59, ${opacity})`
          ctx.font = '8px monospace'
          ctx.textAlign = 'center'
          ctx.fillText(edge.familiarityScore.toFixed(2), midX, midY)
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const pos = positions.get(node.trackId)
        if (!pos) continue

        const radius = Math.max(4, Math.min(15, 3 + node.detectionCount * 0.2))
        const color = colors[node.lastClass] || colors.default

        // Node circle
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2)
        ctx.fill()

        // Node border
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Track ID label
        ctx.fillStyle = '#1e293b'
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(node.trackId, pos.x, pos.y - radius - 4)

        // Appearance sessions and observed duration.
        ctx.fillStyle = node.reappearanceCount > 0 ? '#b45309' : '#64748b'
        ctx.font = '8px monospace'
        ctx.fillText(
          `×${node.reappearanceCount + 1} · ${(node.totalDurationMs / 1000).toFixed(1)}s`,
          pos.x,
          pos.y + radius + 10,
        )
      }

      animRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [filteredNetwork, width, height])

  if (!network || network.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center text-xs text-zinc-400" style={{ width, height }}>
        No subjects tracked yet
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="co-occurrence-graph">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-2">
        <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Analysis window</div>
        <div className="flex gap-1" role="group" aria-label="Correlation time window">
          {([['session', 'Session'], [30_000, '30s'], [120_000, '2m'], [600_000, '10m']] as const).map(([value, label]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => setWindowMs(value)}
              aria-pressed={windowMs === value}
              className={`rounded px-2 py-1 text-[9px] font-medium ${windowMs === value ? 'bg-emerald-600 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50">
        <canvas ref={canvasRef} className="block" style={{ width, height }} />
      </div>
      <div className="flex items-center justify-between text-[9px] text-zinc-500 px-1">
        <span>
          {filteredNetwork?.totalSubjects ?? 0} local tracks · {filteredNetwork?.edges.length ?? 0} measured links
          {(filteredNetwork?.totalSubjects ?? 0) > 12 ? ' · top 12 shown' : ''}
        </span>
        <span>{filteredNetwork?.totalFrames ?? network.totalFrames} frames in selected calculation</span>
      </div>
      {(filteredNetwork?.nodes.length ?? 0) > 0 && (
        <div className="rounded-md border border-zinc-200 bg-white p-2">
          <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Inspect local track</div>
          <div className="flex flex-wrap gap-1">
            {filteredNetwork!.nodes.slice(0, 20).map(node => (
              <button
                type="button"
                key={node.trackId}
                aria-pressed={selectedTrackId === node.trackId}
                onClick={() => setSelectedTrackId(current => current === node.trackId ? null : node.trackId)}
                className={`rounded border px-2 py-1 font-mono text-[9px] ${selectedTrackId === node.trackId ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
              >
                {node.trackId} · {node.lastClass}
              </button>
            ))}
          </div>
          {selectedTrack && (
            <div className="mt-2 grid gap-2 rounded bg-zinc-50 p-2 text-[9px] text-zinc-600 sm:grid-cols-4" data-testid="entity-node-inspector">
              <div><span className="block text-zinc-400">Observations</span><strong className="text-zinc-900">{selectedTrack.detectionCount}</strong></div>
              <div><span className="block text-zinc-400">Observed duration</span><strong className="text-zinc-900">{(selectedTrack.totalDurationMs / 1000).toFixed(1)}s</strong></div>
              <div><span className="block text-zinc-400">Appearance sessions</span><strong className="text-zinc-900">{selectedTrack.reappearanceCount + 1}</strong></div>
              <div><span className="block text-zinc-400">Measured links</span><strong className="text-zinc-900">{selectedEdges.length}</strong></div>
            </div>
          )}
        </div>
      )}
      {(filteredNetwork?.edges.length ?? 0) > 0 && (
        <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
          <table className="w-full text-[9px] text-zinc-600">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-1.5 py-1 text-left">Pair</th>
                <th className="px-1.5 py-1 text-right">Together</th>
                <th className="px-1.5 py-1 text-right">Duration</th>
                <th className="px-1.5 py-1 text-right">Proximity</th>
                <th className="px-1.5 py-1 text-right">Weight</th>
              </tr>
            </thead>
            <tbody>
              {filteredNetwork!.edges.slice(0, 8).map(edge => (
                <tr key={`${edge.source}-${edge.target}`} className={`border-t border-zinc-100 ${selectedTrackId && (edge.source === selectedTrackId || edge.target === selectedTrackId) ? 'bg-emerald-50' : ''}`}>
                  <td className="px-1.5 py-1 font-mono">{edge.source}–{edge.target}</td>
                  <td className="px-1.5 py-1 text-right">{edge.encounterCount}× · {edge.sharedFrames} frames</td>
                  <td className="px-1.5 py-1 text-right">{(edge.sharedDurationMs / 1000).toFixed(1)}s</td>
                  <td className="px-1.5 py-1 text-right">{edge.proximityScore.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-right font-semibold text-zinc-800">{edge.familiarityScore.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
