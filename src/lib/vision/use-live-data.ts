'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface LiveTick {
  id: number
  feedId: string
  className: string
  tier: number
  z: number
  ts: number
  /** Use case id that the agent would invoke for this detection class.
   *  Populated so the dashboard can auto-animate the agent flow when an
   *  anomaly (tier >= 2) is detected. */
  useCaseId?: string
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

/** Map a detector class → the use case the agent would invoke for it. */
function classToUseCase(className: string): string {
  switch (className) {
    case 'person':
      return 'crowd_surge'
    case 'car':
    case 'truck':
    case 'bus':
    case 'motorcycle':
      return 'after_hours'
    case 'backpack':
    case 'suitcase':
    case 'handbag':
      return 'abandoned_object'
    case 'fire':
    case 'smoke':
      return 'fire_smoke'
    case 'water':
      return 'flood_watch'
    case 'debris':
      return 'landslide'
    default:
      return 'intrusion'
  }
}

/**
 * useLiveData — when `enabled`, emits ~1 detection event per second (1 Hz,
 * matching the agent loop). Each tick is a simulated detection with a
 * z-score that occasionally spikes into anomaly/critical territory. The
 * dashboard surfaces these as a live ticker + drives the heartbeat.
 *
 * `onAnomaly` (optional) is called for each new anomaly+ tick (tier >= 2)
 * with the tick's useCaseId — this lets the page react to live detections
 * by animating the matching agent flow, without a setState-in-effect.
 */
export function useLiveData(enabled: boolean, onAnomaly?: (useCaseId: string) => void): { ticks: LiveTick[]; clear: () => void } {
  const [ticks, setTicks] = useState<LiveTick[]>([])
  const idRef = useRef(0)
  // Keep the latest onAnomaly in a ref so the interval doesn't restart when it changes.
  const onAnomalyRef = useRef(onAnomaly)
  useEffect(() => { onAnomalyRef.current = onAnomaly }, [onAnomaly])

  useEffect(() => {
    if (!enabled) return
    const interval = setInterval(() => {
      const feed = LIVE_FEEDS[Math.floor(Math.random() * LIVE_FEEDS.length)]
      const className = pickClass(feed)
      // z-score: ~80% nominal, ~20% anomaly (demo-friendly rate so the
      // live-mode-drives-flow feature visibly fires within ~5-10s).
      let z: number
      if (Math.random() < 0.2) {
        // anomaly: z in 2.0–4.2 → tier 1 (watch) / 2 (anomaly) / 3 (critical)
        z = 2.0 + Math.random() * 2.2
      } else {
        // nominal: z in 0–1.3 → tier 0
        z = Math.random() * 1.3
      }
      z = Math.round(z * 100) / 100
      const tier = tierForZ(z)
      const tick: LiveTick = {
        id: idRef.current++,
        feedId: feed.feedId,
        className,
        tier,
        z,
        ts: Date.now(),
        useCaseId: classToUseCase(className),
      }
      setTicks((prev) => [tick, ...prev].slice(0, 24))
      // Fire the anomaly callback outside the setTicks update (side-effect-free).
      if (tier >= 2 && tick.useCaseId) {
        onAnomalyRef.current?.(tick.useCaseId)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [enabled])

  const clear = useCallback(() => setTicks([]), [])

  return { ticks, clear }
}
