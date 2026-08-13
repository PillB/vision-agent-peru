'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface LiveTick {
  id: number
  feedId: string
  className: string
  tier: number
  z: number
  ts: number
}

interface FeedDef {
  feedId: string
  classes: Array<{ className: string; weight: number }>
}

const LIVE_FEEDS: FeedDef[] = [
  {
    feedId: 'feed-plaza',
    classes: [
      { className: 'person', weight: 0.55 },
      { className: 'car', weight: 0.2 },
      { className: 'backpack', weight: 0.15 },
      { className: 'motorcycle', weight: 0.1 },
    ],
  },
  {
    feedId: 'feed-mall',
    classes: [
      { className: 'person', weight: 0.7 },
      { className: 'handbag', weight: 0.15 },
      { className: 'shopping cart', weight: 0.15 },
    ],
  },
  {
    feedId: 'feed-warehouse',
    classes: [
      { className: 'person', weight: 0.4 },
      { className: 'forklift', weight: 0.3 },
      { className: 'smoke', weight: 0.15 },
      { className: 'fire', weight: 0.15 },
    ],
  },
  {
    feedId: 'feed-river',
    classes: [
      { className: 'water', weight: 0.4 },
      { className: 'person', weight: 0.3 },
      { className: 'debris', weight: 0.3 },
    ],
  },
]

function pickClass(def: FeedDef) {
  const r = Math.random()
  let acc = 0
  for (const c of def.classes) {
    acc += c.weight
    if (r <= acc) return c.className
  }
  return def.classes[0].className
}

function tierForZ(z: number): number {
  if (z >= 3.5) return 3
  if (z >= 2.5) return 2
  if (z >= 1.5) return 1
  return 0
}

/**
 * useLiveData — when `enabled`, emits ~1 detection event per second (1 Hz,
 * matching the agent loop). Each tick is a simulated detection with a
 * z-score that occasionally spikes into anomaly/critical territory. The
 * dashboard surfaces these as a live ticker + drives the heartbeat.
 */
export function useLiveData(enabled: boolean): { ticks: LiveTick[]; clear: () => void } {
  const [ticks, setTicks] = useState<LiveTick[]>([])
  const idRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => {
      const feed = LIVE_FEEDS[Math.floor(Math.random() * LIVE_FEEDS.length)]
      const className = pickClass(feed)
      // z-score: mostly nominal, sometimes anomalous
      const base = Math.random() * 1.4
      const spike = Math.random() < 0.18 ? Math.random() * 2.8 : 0
      const z = Math.round((base + spike) * 100) / 100
      const tier = tierForZ(z)
      const tick: LiveTick = {
        id: idRef.current++,
        feedId: feed.feedId,
        className,
        tier,
        z,
        ts: Date.now(),
      }
      setTicks((prev) => [tick, ...prev].slice(0, 24))
    }, 1000)
    return () => clearInterval(interval)
  }, [enabled])

  const clear = useCallback(() => setTicks([]), [])

  return { ticks, clear }
}
