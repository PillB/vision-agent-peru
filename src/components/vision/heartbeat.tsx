'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Heartbeat — an ECG-style animated pulse line that visualizes the agent's
 * 1 Hz perceive→reason→act loop. Width-flexible; drops into the header.
 */
export function Heartbeat({ active = true, width = 180, height = 34 }: { active?: boolean; width?: number; height?: number }) {
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number>(0)
  const startRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!active) return
    const step = () => {
      setTick((t) => t + 1)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [active])

  // Build the ECG path — a repeating blip every ~1s.
  const now = (Date.now() - startRef.current) / 1000
  const samples = 80
  const pts: string[] = []
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const x = u * width
    // phase shifts over time so the blip scrolls left
    const phase = (u - (now % 1)) % 1
    const p = phase < 0 ? phase + 1 : phase
    // baseline with a sharp spike near p=0
    let y = height / 2
    const d = Math.min(p, 1 - p)
    if (d < 0.04) {
      // small dip then tall peak
      const local = (0.04 - d) / 0.04
      y = height / 2 - Math.sin(local * Math.PI) * (height * 0.42)
    } else if (d < 0.08) {
      const local = (0.08 - d) / 0.04
      y = height / 2 + Math.sin(local * Math.PI) * (height * 0.18)
    }
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  const path = pts.join(' ')

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="block">
        <defs>
          <linearGradient id="hbStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
            <stop offset="60%" stopColor="#10b981" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(148,163,184,0.15)" strokeWidth="1" strokeDasharray="2 3" />
        <motion.path
          key={tick % 2}
          d={path}
          fill="none"
          stroke="url(#hbStroke)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 3px rgba(16,185,129,0.6))' }}
        />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="text-[8px] uppercase tracking-wider text-slate-500">loop</span>
        <span className="text-[10px] font-mono font-bold text-emerald-400">1 Hz</span>
      </div>
    </div>
  )
}
