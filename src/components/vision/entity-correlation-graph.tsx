'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { EntityNetwork, EntityNode, CorrelationEdge, Tier, EntityKind } from '@/lib/vision/types'
import { TIER_META } from '@/lib/vision/types'
import { KIND_META } from '@/lib/vision/entity-network'

interface Props {
  network: EntityNetwork
  /** 0..1 minimum correlation score to show an edge. */
  minCorrelation: number
  /** Feed filter — 'all' or a feedId. */
  feedFilter: string
  /** kind filter — 'all' or an EntityKind. */
  kindFilter: string
  width?: number
  height?: number
}

interface SimNode {
  id: string
  entity: EntityNode
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

/**
 * EntityCorrelationGraph — force-directed SVG network.
 *
 * Nodes = tracked entities (size ∝ detectionCount, color ∝ kind, ring ∝ tier).
 * Edges = correlation (stroke ∝ correlationScore, color = cross-feed vs within).
 * Animated force simulation, hover tooltip, click-to-select, pulsing hazards.
 */
export function EntityCorrelationGraph({
  network,
  minCorrelation,
  feedFilter,
  kindFilter,
  width = 920,
  height = 560,
}: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const simRef = useRef<SimNode[]>([])
  const rafRef = useRef<number>(0)
  const [tick, setTick] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter nodes + edges by the controls
  const { visibleNodes, visibleEdges, nodeMap } = useMemo(() => {
    const nodes = network.nodes.filter((n) => {
      if (feedFilter !== 'all' && n.feedId !== feedFilter) return false
      if (kindFilter !== 'all' && n.kind !== kindFilter) return false
      return true
    })
    const nodeIds = new Set(nodes.map((n) => n.id))
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const edges = network.edges.filter((e) => {
      if (e.correlationScore < minCorrelation) return false
      return nodeIds.has(e.source) && nodeIds.has(e.target)
    })
    return { visibleNodes: nodes, visibleEdges: edges, nodeMap }
  }, [network, minCorrelation, feedFilter, kindFilter])

  // Initialize sim positions (circle layout)
  useEffect(() => {
    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(width, height) * 0.32
    simRef.current = visibleNodes.map((n, i) => {
      const angle = (i / Math.max(1, visibleNodes.length)) * Math.PI * 2
      return {
        id: n.id,
        entity: n,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        r: Math.max(7, Math.min(22, 6 + n.detectionCount * 0.22)),
      }
    })
    setTick((t) => t + 1)
  }, [visibleNodes, width, height])

  // Force simulation loop
  useEffect(() => {
    if (simRef.current.length === 0) return
    const cx = width / 2
    const cy = height / 2
    let frame = 0
    const repulsion = 1400
    const attraction = 0.018
    const centerGravity = 0.0015
    const damping = 0.86

    const step = () => {
      const nodes = simRef.current
      // repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]
          const b = nodes[j]
          let dx = a.x - b.x
          let dy = a.y - b.y
          let dist = Math.sqrt(dx * dx + dy * dy) || 1
          if (dist < 1) dist = 1
          const force = repulsion / (dist * dist)
          const fx = (dx / dist) * force * 0.01
          const fy = (dy / dist) * force * 0.01
          a.vx += fx
          a.vy += fy
          b.vx -= fx
          b.vy -= fy
        }
      }
      // attraction along edges
      for (const e of visibleEdges) {
        const a = nodes.find((n) => n.id === e.source)
        const b = nodes.find((n) => n.id === e.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = attraction * dist * e.correlationScore
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }
      // center gravity + damping + bounds
      for (const n of nodes) {
        n.vx += (cx - n.x) * centerGravity
        n.vy += (cy - n.y) * centerGravity
        n.vx *= damping
        n.vy *= damping
        n.x += n.vx
        n.y += n.vy
        n.x = Math.max(28, Math.min(width - 28, n.x))
        n.y = Math.max(28, Math.min(height - 28, n.y))
      }
      frame++
      if (frame % 2 === 0) setTick((t) => t + 1)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [visibleEdges, width, height])

  // Focus neighborhood on hover/select
  const focusId = hoverId ?? selectedId
  const focusNeighbors = useMemo(() => {
    if (!focusId) return new Set<string>()
    const set = new Set<string>([focusId])
    for (const e of visibleEdges) {
      if (e.source === focusId) set.add(e.target)
      if (e.target === focusId) set.add(e.source)
    }
    return set
  }, [focusId, visibleEdges])

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  const hoveredNode = focusId ? nodeMap.get(focusId) ?? null : null
  const hoveredEdges = focusId
    ? visibleEdges.filter((e) => e.source === focusId || e.target === focusId)
    : []

  const simNodes = simRef.current

  return (
    <div className="relative" ref={containerRef}>
      <svg
        width={width}
        height={height}
        className="block w-full"
        viewBox={`0 0 ${width} ${height}`}
        style={{ background: 'radial-gradient(circle at 50% 45%, #0f172a 0%, #020617 70%)' }}
      >
        {/* subtle grid */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
          </pattern>
          <radialGradient id="hazardGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(239,68,68,0.5)" />
            <stop offset="100%" stopColor="rgba(239,68,68,0)" />
          </radialGradient>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />

        {/* edges */}
        <g>
          {visibleEdges.map((e, idx) => {
            const a = simNodes.find((n) => n.id === e.source)
            const b = simNodes.find((n) => n.id === e.target)
            if (!a || !b) return null
            const isFocus = focusId && (e.source === focusId || e.target === focusId)
            const dim = focusId && !isFocus
            const stroke = e.crossFeed ? '#a855f7' : '#38bdf8'
            const opacity = dim ? 0.06 : isFocus ? 0.95 : 0.18 + e.correlationScore * 0.45
            const sw = Math.max(0.6, e.correlationScore * 4.5)
            // bezier curve
            const mx = (a.x + b.x) / 2
            const my = (a.y + b.y) / 2
            const dx = b.x - a.x
            const dy = b.y - a.y
            const bend = e.crossFeed ? 0.35 : 0.12
            const cx = mx - dy * bend
            const cy = my + dx * bend
            return (
              <g key={`${e.source}-${e.target}-${idx}`}>
                <path
                  d={`M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`}
                  fill="none"
                  stroke={stroke}
                  strokeOpacity={opacity}
                  strokeWidth={sw}
                  strokeDasharray={e.crossFeed ? '5 4' : undefined}
                />
                {isFocus && (
                  <text
                    x={mx}
                    y={my - 4}
                    textAnchor="middle"
                    fill="#e2e8f0"
                    fontSize="10"
                    fontFamily="monospace"
                    className="pointer-events-none"
                  >
                    ρ={e.correlationScore.toFixed(2)}
                  </text>
                )}
              </g>
            )
          })}
        </g>

        {/* nodes */}
        <g>
          {simNodes.map((n) => {
            const kindColor = KIND_META[n.entity.kind].color
            const tier = n.entity.tier
            const tierColor = TIER_META[tier].color
            const isFocus = focusId === n.id
            const isNeighbor = focusNeighbors.has(n.id)
            const dim = focusId && !isNeighbor
            const isHazard = n.entity.kind === 'hazard'
            return (
              <g
                key={n.id}
                transform={`translate(${n.x} ${n.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => handleNodeClick(n.id)}
                opacity={dim ? 0.25 : 1}
              >
                {isHazard && (
                  <motion.circle
                    r={n.r + 14}
                    fill="url(#hazardGlow)"
                    animate={{ scale: [1, 1.18, 1], opacity: [0.6, 0.25, 0.6] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ transformOrigin: 'center' }}
                  />
                )}
                {isFocus && (
                  <circle r={n.r + 8} fill="none" stroke={kindColor} strokeOpacity={0.6} strokeWidth={2} />
                )}
                {/* tier ring */}
                <circle
                  r={n.r + 3}
                  fill="none"
                  stroke={tierColor}
                  strokeWidth={tier > 0 ? 2.5 : 1}
                  strokeOpacity={tier > 0 ? 0.95 : 0.4}
                  strokeDasharray={tier === 3 ? '4 3' : undefined}
                />
                <circle r={n.r} fill={kindColor} fillOpacity={0.92} stroke="#0f172a" strokeWidth={1.5} />
                {/* kind glyph (initial) */}
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize={n.r * 0.85}
                  fontWeight={700}
                  className="pointer-events-none select-none"
                  fontFamily="sans-serif"
                >
                  {n.entity.className[0].toUpperCase()}
                </text>
                {/* label */}
                <text
                  y={n.r + 14}
                  textAnchor="middle"
                  fill={isFocus ? '#fbbf24' : '#cbd5e1'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  className="pointer-events-none select-none"
                >
                  {n.entity.label}
                </text>
                <text
                  y={n.r + 24}
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="8"
                  fontFamily="monospace"
                  className="pointer-events-none select-none"
                >
                  ×{n.entity.detectionCount} · z={n.entity.anomalyZ.toFixed(1)}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* hover/detail popover */}
      <AnimatePresence>
        {hoveredNode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.12 }}
            className="absolute top-3 right-3 w-60 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur p-3 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: KIND_META[hoveredNode.kind].color }}
              />
              <span className="text-sm font-semibold text-slate-100">{hoveredNode.label}</span>
              <span
                className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
                style={{
                  background: TIER_META[hoveredNode.tier].color + '22',
                  color: TIER_META[hoveredNode.tier].color,
                }}
              >
                {TIER_META[hoveredNode.tier].short}
              </span>
            </div>
            <div className="space-y-1 text-[11px] text-slate-300 font-mono">
              <Row k="class" v={hoveredNode.className} />
              <Row k="feed" v={hoveredNode.feedId.replace('feed-', '')} />
              <Row k="detections" v={String(hoveredNode.detectionCount)} />
              <Row k="z-score" v={hoveredNode.anomalyZ.toFixed(2)} />
              <Row k="confidence" v={(hoveredNode.confidence * 100).toFixed(0) + '%'} />
              <Row k="reappears" v={String(hoveredNode.reappearanceCount)} />
              <Row k="duration" v={(hoveredNode.totalDurationMs / 1000).toFixed(1) + 's'} />
            </div>
            {hoveredEdges.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700">
                <div className="text-[9px] uppercase tracking-wide text-slate-500 mb-1">Top correlations</div>
                <div className="space-y-0.5">
                  {hoveredEdges
                    .slice()
                    .sort((a, b) => b.correlationScore - a.correlationScore)
                    .slice(0, 3)
                    .map((e, i) => {
                      const otherId = e.source === hoveredNode.id ? e.target : e.source
                      const other = nodeMap.get(otherId)
                      return (
                        <div key={i} className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-slate-300 truncate">{other?.label ?? otherId}</span>
                          <span className="text-sky-300 font-semibold">{e.correlationScore.toFixed(2)}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-slate-300">
        <span className="font-semibold text-slate-200 uppercase tracking-wide text-[10px]">Entity kinds</span>
        {(Object.keys(KIND_META) as EntityKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: KIND_META[k].color }} />
            {KIND_META[k].label}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-sky-400" /> within-feed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 border-t border-dashed border-purple-400" /> cross-feed
          </span>
        </span>
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-200">{v}</span>
    </div>
  )
}
