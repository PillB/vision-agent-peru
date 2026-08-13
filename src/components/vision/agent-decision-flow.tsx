'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, ShieldCheck, GitBranch, Gavel, BadgeCheck, ClipboardList,
  UserCheck, Zap, CircleCheck, CheckCircle2, Ban, ArrowUpCircle, RotateCw,
  type LucideIcon,
} from 'lucide-react'
import type { AgentFlowRun, BranchTag, FlowNode, Tier } from '@/lib/vision/types'
import { TIER_META } from '@/lib/vision/types'
import { FLOW_NODES, FLOW_EDGES, NODE_BY_ID, STAGE_ORDER, BRANCH_COLORS, computeActivePath } from '@/lib/vision/agent-flow'

const ICONS: Record<string, LucideIcon> = {
  eye: Eye,
  'shield-check': ShieldCheck,
  'git-branch': GitBranch,
  gavel: Gavel,
  'badge-check': BadgeCheck,
  'clipboard-list': ClipboardList,
  'user-check': UserCheck,
  zap: Zap,
  'circle-check': CircleCheck,
  'check-circle-2': CheckCircle2,
  ban: Ban,
  'arrow-up-circle': ArrowUpCircle,
  'rotate-cw': RotateCw,
}

const NODE_W = 138
const NODE_H = 70
const COL_GAP = 38
const ROW_GAP = 44

// Layout: backbone centered vertically around y0; judge above (row -1),
// validate_judge below (row 1), terminals at row 2.
function nodePos(n: FlowNode): { x: number; y: number } {
  const x = 24 + n.col * (NODE_W + COL_GAP)
  const y = 150 + n.row * (NODE_H + ROW_GAP)
  return { x, y }
}

interface Props {
  run: AgentFlowRun
  /** index of the "active" stage in run.trace (-1 = idle, before start). */
  activeStep: number
  width?: number
  height?: number
  selectedNodeId?: string | null
  onNodeClick?: (nodeId: string) => void
}

const NODE_TYPE_STYLE: Record<FlowNode['type'], { fill: string; stroke: string; accent: string }> = {
  observe: { fill: '#0b1220', stroke: '#334155', accent: '#38bdf8' },
  validate: { fill: '#0b1220', stroke: '#334155', accent: '#38bdf8' },
  decision: { fill: '#1e1b4b', stroke: '#4338ca', accent: '#a78bfa' },
  judge: { fill: '#3b0764', stroke: '#7e22ce', accent: '#d946ef' },
  action: { fill: '#052e2b', stroke: '#0f766e', accent: '#2dd4bf' },
  verify: { fill: '#052e16', stroke: '#15803d', accent: '#22c55e' },
  terminal: { fill: '#0b1220', stroke: '#334155', accent: '#94a3b8' },
}

export function AgentDecisionFlow({ run, activeStep, selectedNodeId, onNodeClick }: Props) {
  const { nodes: activeNodes, edges: activeEdges } = useMemo(
    () => computeActivePath(run),
    [run],
  )

  // Compute canvas dimensions from node positions (auto-fit)
  const { width, height } = useMemo(() => {
    let maxX = 0
    let maxY = 0
    for (const n of FLOW_NODES) {
      const p = nodePos(n)
      maxX = Math.max(maxX, p.x + NODE_W)
      maxY = Math.max(maxY, p.y + NODE_H)
    }
    return { width: maxX + 24, height: maxY + 24 }
  }, [])

  // "completed" = nodes the agent has already traversed up to activeStep
  const completedNodes = useMemo(() => {
    const set = new Set<string>(['observe'])
    for (let i = 0; i <= activeStep && i < run.trace.length; i++) {
      const t = run.trace[i]
      if (t.branch) {
        const edge = FLOW_EDGES.find((e) => e.source === lastNode(set) && e.branch === t.branch)
        if (edge) set.add(edge.target)
      }
    }
    return set
  }, [run, activeStep])

  // active node = the stage at activeStep
  const activeStage = activeStep >= 0 && activeStep < run.trace.length ? run.trace[activeStep].stage : null
  const activeNodeId = activeStage ? STAGE_ID_BY_STAGE[activeStage] : null

  // token animation along the active edge
  const [tokenPos, setTokenPos] = useState<{ x: number; y: number } | null>(null)
  const tokenTimer = useRef<number>(0)

  useEffect(() => {
    if (activeStep < 0 || activeStep >= run.trace.length) {
      setTokenPos(null)
      return
    }
    const t = run.trace[activeStep]
    if (!t.branch) {
      setTokenPos(null)
      return
    }
    // find current cursor (last node)
    const cursor = lastNode(completedNodes)
    const edge = FLOW_EDGES.find((e) => e.source === cursor && e.branch === t.branch)
    if (!edge) {
      setTokenPos(null)
      return
    }
    const src = NODE_BY_ID[edge.source]
    const tgt = NODE_BY_ID[edge.target]
    const sp = nodePos(src)
    const tp = nodePos(tgt)
    const start = { x: sp.x + NODE_W, y: sp.y + NODE_H / 2 }
    const end = { x: tp.x, y: tp.y + NODE_H / 2 }
    // animate token along the bezier
    const steps = 24
    let i = 0
    const cx = (start.x + end.x) / 2
    const cy = Math.min(start.y, end.y) - 60
    const interval = setInterval(() => {
      i++
      const u = i / steps
      // quadratic bezier
      const x = (1 - u) * (1 - u) * start.x + 2 * (1 - u) * u * cx + u * u * end.x
      const y = (1 - u) * (1 - u) * start.y + 2 * (1 - u) * u * cy + u * u * end.y
      setTokenPos({ x, y })
      if (i >= steps) {
        clearInterval(interval)
        setTokenPos(null)
      }
    }, 30)
    tokenTimer.current = interval as unknown as number
    return () => clearInterval(interval)
  }, [activeStep, run])

  return (
    <div className="relative overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block"
        data-testid="agent-flow-svg"
        style={{ minWidth: width, background: 'radial-gradient(circle at 30% 20%, #0f172a 0%, #020617 75%)' }}
      >
        <defs>
          <linearGradient id="edgeFlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000" floodOpacity="0.5" />
          </filter>
          <pattern id="flowgrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#flowgrid)" />

        {/* edges */}
        <g>
          {FLOW_EDGES.map((e, idx) => {
            const src = NODE_BY_ID[e.source]
            const tgt = NODE_BY_ID[e.target]
            const sp = nodePos(src)
            const tp = nodePos(tgt)
            const sx = sp.x + NODE_W
            const sy = sp.y + NODE_H / 2
            const tx = tp.x
            const ty = tp.y + NODE_H / 2
            const cx = (sx + tx) / 2
            const cy = Math.min(sy, ty) - 70
            const edgeId = `${e.source}->${e.target}:${e.branch}`
            const isActive = activeEdges.has(edgeId)
            const isCompleted = completedNodes.has(e.source) && completedNodes.has(e.target)
            const color = isActive ? BRANCH_COLORS[e.branch] : '#1e293b'
            const opacity = isActive ? 0.95 : isCompleted ? 0.5 : 0.3
            const sw = isActive ? 3 : Math.max(1, e.weight * 2.5)
            return (
              <g key={idx}>
                <path
                  d={`M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`}
                  fill="none"
                  stroke={color}
                  strokeOpacity={opacity}
                  strokeWidth={sw}
                  strokeDasharray={isActive ? undefined : '6 5'}
                />
                {/* edge label */}
                {isActive && (
                  <g>
                    <rect
                      x={cx - 26}
                      y={cy - 9}
                      width={52}
                      height={18}
                      rx={9}
                      fill="#0f172a"
                      stroke={color}
                      strokeOpacity={0.6}
                    />
                    <text
                      x={cx}
                      y={cy + 3}
                      textAnchor="middle"
                      fill={color}
                      fontSize="9"
                      fontWeight={700}
                      fontFamily="monospace"
                    >
                      {e.label.toUpperCase()}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </g>

        {/* animated token */}
        {tokenPos && (
          <motion.circle
            r={6}
            fill="#fbbf24"
            initial={false}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.9))' }}
            cx={tokenPos.x}
            cy={tokenPos.y}
          />
        )}

        {/* nodes */}
        <g>
          {FLOW_NODES.map((n) => {
            const pos = nodePos(n)
            const isActive = activeNodeId === n.id
            const isSelected = selectedNodeId === n.id
            const isCompleted = completedNodes.has(n.id)
            const onPath = activeNodes.has(n.id)
            const style = NODE_TYPE_STYLE[n.type]
            const Icon = ICONS[n.icon] ?? Eye
            const stageTrace = run.trace.find((t) => STAGE_ID_BY_STAGE[t.stage] === n.id)
            const tier = stageTrace?.tier
            const accent = isActive ? '#fbbf24' : isSelected ? '#38bdf8' : isCompleted ? style.accent : style.stroke
            const fillOpacity = onPath ? 1 : 0.45
            const scale = isActive ? 1.06 : isSelected ? 1.04 : 1
            return (
              <motion.g
                key={n.id}
                initial={false}
                animate={{ scale }}
                style={{ transformOrigin: `${pos.x + NODE_W / 2}px ${pos.y + NODE_H / 2}px`, cursor: onNodeClick ? 'pointer' : 'default' }}
                transition={{ duration: 0.25 }}
                onClick={() => onNodeClick?.(n.id)}
              >
                {/* glow ring when active */}
                {isActive && (
                  <rect
                    x={pos.x - 6}
                    y={pos.y - 6}
                    width={NODE_W + 12}
                    height={NODE_H + 12}
                    rx={14}
                    fill="none"
                    stroke="#fbbf24"
                    strokeOpacity={0.7}
                    strokeWidth={2}
                  />
                )}
                {/* selection ring */}
                {isSelected && !isActive && (
                  <rect
                    x={pos.x - 4}
                    y={pos.y - 4}
                    width={NODE_W + 8}
                    height={NODE_H + 8}
                    rx={13}
                    fill="none"
                    stroke="#38bdf8"
                    strokeOpacity={0.8}
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
                {/* card */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={style.fill}
                  fillOpacity={fillOpacity}
                  stroke={accent}
                  strokeWidth={isActive ? 2.5 : 1.5}
                  filter="url(#nodeShadow)"
                />
                {/* left accent stripe */}
                <rect
                  x={pos.x}
                  y={pos.y + 8}
                  width={4}
                  height={NODE_H - 16}
                  rx={2}
                  fill={style.accent}
                  fillOpacity={onPath ? 1 : 0.4}
                />
                {/* icon circle */}
                <circle
                  cx={pos.x + 26}
                  cy={pos.y + NODE_H / 2}
                  r={15}
                  fill={style.accent + '22'}
                  stroke={style.accent}
                  strokeOpacity={0.6}
                />
                <g transform={`translate(${pos.x + 26 - 8} ${pos.y + NODE_H / 2 - 8})`}>
                  <Icon size={16} color={style.accent} />
                </g>
                {/* step number */}
                <text
                  x={pos.x + NODE_W - 12}
                  y={pos.y + 18}
                  textAnchor="end"
                  fill="#475569"
                  fontSize="11"
                  fontWeight={800}
                  fontFamily="monospace"
                >
                  {n.short}
                </text>
                {/* title */}
                <text
                  x={pos.x + 50}
                  y={pos.y + 26}
                  fill="#e2e8f0"
                  fontSize="12.5"
                  fontWeight={700}
                  fontFamily="sans-serif"
                >
                  {n.label}
                </text>
                {/* subtitle: stage status or tier */}
                <text
                  x={pos.x + 50}
                  y={pos.y + 44}
                  fill={stageTrace ? statusColor(stageTrace.status) : '#64748b'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight={600}
                >
                  {stageTrace ? `${stageTrace.status.toUpperCase()}${tier !== undefined ? ' · T' + tier : ''}` : n.type.toUpperCase()}
                </text>
                {/* detail line */}
                <text
                  x={pos.x + 50}
                  y={pos.y + 60}
                  fill="#94a3b8"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {stageTrace ? clipText(stageTrace.detail, 20) : clipText(stageDescription(n), 20)}
                </text>
              </motion.g>
            )
          })}
        </g>
      </svg>

      {/* legend / step counter overlay */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[11px] font-mono text-slate-200">
          Cycle #{run.cycle} · step {Math.max(0, activeStep + 1)}/{run.trace.length}
        </span>
        <span
          className="ml-1 rounded px-1.5 py-0.5 text-[9px] font-mono font-bold"
          style={{
            background: TIER_META[run.finalTier].color + '22',
            color: TIER_META[run.finalTier].color,
          }}
        >
          {TIER_META[run.finalTier].short}
        </span>
      </div>
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

function lastNode(set: Set<string>): string {
  // returns the "cursor" = the latest node added to the path
  // we infer cursor by stage order: find the highest-indexed stage that's in set
  for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
    const id = STAGE_ID_BY_STAGE[STAGE_ORDER[i]]
    if (set.has(id)) return id
  }
  return 'observe'
}

function statusColor(status: string): string {
  switch (status) {
    case 'pass': return '#22c55e'
    case 'fail': return '#ef4444'
    case 'skip': return '#64748b'
    case 'active': return '#fbbf24'
    case 'pending': return '#f59e0b'
    default: return '#64748b'
  }
}

function clipText(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function stageDescription(n: FlowNode): string {
  return n.description.split('—')[0]?.trim() ?? n.type
}
