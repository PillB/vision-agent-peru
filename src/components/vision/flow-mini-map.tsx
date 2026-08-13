'use client'

import { useMemo } from 'react'

interface Props {
  /** Full flow SVG width (unscaled). */
  flowWidth: number
  /** Full flow SVG height (unscaled). */
  flowHeight: number
  /** Current zoom (scale). */
  zoom: number
  /** Current pan offset in px. */
  pan: { x: number; y: number }
  /** Viewport (container) size in px. */
  viewport: { width: number; height: number }
  /** Click-to-pan: jumps the viewport to the clicked location. */
  onJump: (pan: { x: number; y: number }) => void
  /** Mini-map width (height auto-derived). */
  width?: number
}

/**
 * FlowMiniMap — a tiny overview of the full agent decision flow that shows
 * where the current viewport is when the canvas is zoomed/panned. Clicking
 * the mini-map jumps the viewport to that location.
 *
 * Only meaningful when zoomed in or panned; the parent hides it otherwise.
 */
export function FlowMiniMap({ flowWidth, flowHeight, zoom, pan, viewport, onJump, width = 140 }: Props) {
  const scale = width / flowWidth
  const miniHeight = flowHeight * scale

  // The visible viewport in flow-SVG coordinates:
  //   visible width  = viewport.width  / zoom
  //   visible height = viewport.height / zoom
  //   top-left in SVG coords = -pan / zoom
  const visW = viewport.width / zoom
  const visH = viewport.height / zoom
  const visX = -pan.x / zoom
  const visY = -pan.y / zoom

  // Clamp the viewport rect to the flow bounds (for display).
  const rectX = Math.max(0, visX) * scale
  const rectY = Math.max(0, visY) * scale
  const rectW = Math.min(flowWidth, visX + visW) * scale - rectX
  const rectH = Math.min(flowHeight, visY + visH) * scale - rectY

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const u = (e.clientX - r.left) / r.width // 0..1
    const v = (e.clientY - r.top) / r.height // 0..1
    // Target SVG coord = u * flowWidth, v * flowHeight.
    // We want that point centered in the viewport:
    //   pan.x = -(targetX * zoom) + viewport.width / 2
    const targetX = u * flowWidth
    const targetY = v * flowHeight
    onJump({ x: -targetX * zoom + viewport.width / 2, y: -targetY * zoom + viewport.height / 2 })
  }

  return (
    <div className="absolute bottom-2 right-2 z-10 rounded-lg border border-slate-700 bg-slate-950/85 p-1.5 backdrop-blur shadow-lg">
      <div className="text-[8px] uppercase tracking-wider text-slate-500 font-mono mb-0.5 px-0.5">mini-map</div>
      <svg
        width={width}
        height={miniHeight}
        className="block rounded cursor-pointer"
        style={{ background: '#020617' }}
        onClick={handleClick}
        role="button"
        aria-label="Flow mini-map — click to jump"
      >
        {/* flow outline */}
        <rect x={0} y={0} width={width} height={miniHeight} fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth={1} />
        {/* simplified node positions (3 rows) — just dots to suggest structure */}
        {Array.from({ length: 9 }).map((_, i) => {
          const gx = (24 + i * 176) * scale
          const gy = 150 * scale
          return <circle key={`bb-${i}`} cx={gx} cy={gy} r={2} fill="rgba(56,189,248,0.5)" />
        })}
        {/* judge row */}
        <circle cx={(24 + 3 * 176) * scale} cy={(150 - 114) * scale} r={2} fill="rgba(217,70,239,0.5)" />
        <circle cx={(24 + 3 * 176) * scale} cy={(150 + 114) * scale} r={2} fill="rgba(56,189,248,0.5)" />
        {/* terminals */}
        <circle cx={(24 + 8 * 176) * scale} cy={150 * scale} r={2} fill="rgba(34,197,94,0.5)" />
        <circle cx={(24 + 4 * 176) * scale} cy={(150 + 228) * scale} r={2} fill="rgba(148,163,184,0.5)" />
        <circle cx={24 * scale} cy={(150 + 228) * scale} r={2} fill="rgba(245,158,11,0.5)" />
        {/* viewport rectangle */}
        <rect
          x={rectX}
          y={rectY}
          width={Math.max(4, rectW)}
          height={Math.max(4, rectH)}
          fill="rgba(251,191,36,0.15)"
          stroke="#fbbf24"
          strokeWidth={1}
          strokeDasharray="2 1"
        />
      </svg>
    </div>
  )
}
