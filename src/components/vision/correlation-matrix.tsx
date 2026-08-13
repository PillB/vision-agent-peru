'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { EntityNetwork } from '@/lib/vision/types'
import { KIND_META } from '@/lib/vision/entity-network'

interface Props {
  network: EntityNetwork
}

/**
 * CorrelationMatrix — per-feed heatmap of entity-vs-entity correlation scores.
 * Lets the VP scan, at a glance, which entity pairs are most correlated
 * within each feed. Cells colored by correlation score (cool→hot).
 */
export function CorrelationMatrix({ network }: Props) {
  const [activeFeed, setActiveFeed] = useState(network.feeds[0]?.feedId ?? '')
  const feed = network.feeds.find((f) => f.feedId === activeFeed) ?? network.feeds[0]
  const entities = useMemo(
    () => network.nodes.filter((n) => n.feedId === feed?.feedId),
    [network, feed],
  )
  const edges = useMemo(
    () => network.edges.filter((e) => entities.some((n) => n.id === e.source) && entities.some((n) => n.id === e.target)),
    [network, entities],
  )

  // Build a lookup of pair → correlation score
  const scoreMap = useMemo(() => {
    const m = new Map<string, number>()
    edges.forEach((e) => {
      m.set(`${e.source}|${e.target}`, e.correlationScore)
      m.set(`${e.target}|${e.source}`, e.correlationScore)
    })
    return m
  }, [edges])

  const [hoverCell, setHoverCell] = useState<{ i: number; j: number } | null>(null)

  if (!feed || entities.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-500">
        No entities in this feed.
      </div>
    )
  }

  const cellSize = 26
  const labelW = 70
  const gridSize = entities.length * cellSize

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="grid place-items-center h-6 w-6 rounded-md bg-sky-500/15">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
          </span>
          Per-feed correlation matrix
        </h3>
        <div className="flex items-center gap-1 flex-wrap">
          {network.feeds.map((f) => (
            <button
              key={f.feedId}
              onClick={() => setActiveFeed(f.feedId)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-mono transition ${
                activeFeed === f.feedId
                  ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700/50 hover:bg-slate-800'
              }`}
            >
              {f.label.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 mb-2 font-mono">
        {feed.label} · {feed.cameraId} · {entities.length} entities · {edges.length} correlations
      </div>

      <div className="overflow-x-auto">
        <svg width={labelW + gridSize + 4} height={labelW + gridSize + 4} className="block">
          {/* Column labels */}
          {entities.map((e, j) => (
            <g key={`col-${e.id}`} transform={`translate(${labelW + j * cellSize + cellSize / 2} ${labelW - 6})`}>
              <text
                textAnchor="end"
                transform="rotate(-45)"
                fill={KIND_META[e.kind].color}
                fontSize="8"
                fontFamily="monospace"
                className="select-none"
              >
                {e.label}
              </text>
            </g>
          ))}
          {/* Row labels */}
          {entities.map((e, i) => (
            <text
              key={`row-${e.id}`}
              x={labelW - 6}
              y={labelW + i * cellSize + cellSize / 2 + 3}
              textAnchor="end"
              fill={KIND_META[e.kind].color}
              fontSize="8"
              fontFamily="monospace"
              className="select-none"
            >
              {e.label}
            </text>
          ))}
          {/* Cells */}
          {entities.map((rowE, i) =>
            entities.map((colE, j) => {
              const score = i === j ? 1 : scoreMap.get(`${rowE.id}|${colE.id}`) ?? 0
              const isHover = hoverCell?.i === i && hoverCell?.j === j
              const fill = heatColor(score, i === j)
              return (
                <g key={`cell-${i}-${j}`}>
                  <rect
                    x={labelW + j * cellSize}
                    y={labelW + i * cellSize}
                    width={cellSize - 1}
                    height={cellSize - 1}
                    fill={fill}
                    stroke={isHover ? '#fbbf24' : 'rgba(15,23,42,0.6)'}
                    strokeWidth={isHover ? 1.5 : 0.5}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoverCell({ i, j })}
                    onMouseLeave={() => setHoverCell(null)}
                  />
                  {score > 0.05 && !isHover && (
                    <text
                      x={labelW + j * cellSize + cellSize / 2}
                      y={labelW + i * cellSize + cellSize / 2 + 3}
                      textAnchor="middle"
                      fill={score > 0.55 ? '#0f172a' : '#cbd5e1'}
                      fontSize="7.5"
                      fontFamily="monospace"
                      fontWeight={600}
                      className="select-none pointer-events-none"
                    >
                      {i === j ? '·' : score.toFixed(2)}
                    </text>
                  )}
                </g>
              )
            }),
          )}
        </svg>
      </div>

      {/* Hover detail */}
      {hoverCell && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-2.5 py-1.5 text-[10px] font-mono text-slate-300"
        >
          {hoverCell.i === hoverCell.j ? (
            <span>{entities[hoverCell.i].label} (self)</span>
          ) : (
            <span>
              <span className="text-sky-300">{entities[hoverCell.i].label}</span>
              {' ↔ '}
              <span className="text-sky-300">{entities[hoverCell.j].label}</span>
              {' = '}
              <span className="text-amber-300 font-bold">
                {(scoreMap.get(`${entities[hoverCell.i].id}|${entities[hoverCell.j].id}`) ?? 0).toFixed(2)}
              </span>
            </span>
          )}
        </motion.div>
      )}

      {/* Heat legend */}
      <div className="mt-3 flex items-center gap-2 text-[9px] font-mono text-slate-500">
        <span>0.0</span>
        <div className="h-2 w-32 rounded-full" style={{ background: 'linear-gradient(to right, rgba(56,189,248,0.1), rgba(56,189,248,0.5), rgba(245,158,11,0.7), rgba(239,68,68,0.9))' }} />
        <span>1.0</span>
        <span className="ml-2">correlation ρ</span>
      </div>
    </div>
  )
}

function heatColor(score: number, diagonal: boolean): string {
  if (diagonal) return 'rgba(148,163,184,0.18)'
  if (score === 0) return 'rgba(15,23,42,0.4)'
  // cool blue → amber → hot red
  if (score < 0.3) return `rgba(56,189,248,${0.15 + score * 0.8})`
  if (score < 0.6) return `rgba(245,158,11,${0.3 + (score - 0.3) * 1.0})`
  return `rgba(239,68,68,${0.5 + (score - 0.6) * 1.2})`
}
