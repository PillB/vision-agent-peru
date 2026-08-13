/**
 * Entity network data — simulates the multi-feed subject tracker output.
 *
 * Models 4 camera feeds across Lima (comercial + desastre scenarios) with
 * tracked subjects (people, vehicles, objects, hazards) and their
 * co-occurrence / correlation relationships. Deterministic (seeded RNG)
 * so the dashboard is stable across renders.
 */

import type {
  EntityNetwork,
  EntityNode,
  CorrelationEdge,
  FeedSnapshot,
  Tier,
  EntityKind,
} from './types'

// ─── Seeded RNG (mulberry32) for deterministic data ─────────────────────────
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(20250813)
const rand = (min: number, max: number) => min + rng() * (max - min)
const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)]

// ─── Feed definitions ───────────────────────────────────────────────────────
interface FeedDef {
  feedId: string
  label: string
  cameraId: string
  location: string
  scenario: 'commercial' | 'disaster'
  classes: Array<{ className: string; kind: EntityKind; count: number; baseZ: number; baseTier: Tier }>
}

const FEED_DEFS: FeedDef[] = [
  {
    feedId: 'feed-plaza',
    label: 'Plaza San Martín',
    cameraId: 'CAM-LIM-014',
    location: 'Lima Centro',
    scenario: 'commercial',
    classes: [
      { className: 'person', kind: 'person', count: 6, baseZ: 2.1, baseTier: 1 },
      { className: 'car', kind: 'vehicle', count: 3, baseZ: 0.8, baseTier: 0 },
      { className: 'backpack', kind: 'object', count: 2, baseZ: 1.9, baseTier: 1 },
    ],
  },
  {
    feedId: 'feed-mall',
    label: 'Mall Jockey Plaza',
    cameraId: 'CAM-LIM-087',
    location: 'Surco',
    scenario: 'commercial',
    classes: [
      { className: 'person', kind: 'person', count: 8, baseZ: 3.2, baseTier: 2 },
      { className: 'handbag', kind: 'object', count: 2, baseZ: 2.4, baseTier: 2 },
      { className: 'shopping cart', kind: 'object', count: 2, baseZ: 0.3, baseTier: 0 },
    ],
  },
  {
    feedId: 'feed-warehouse',
    label: 'Almacén Central Callao',
    cameraId: 'CAM-CAL-031',
    location: 'Callao',
    scenario: 'disaster',
    classes: [
      { className: 'person', kind: 'person', count: 3, baseZ: 1.2, baseTier: 1 },
      { className: 'forklift', kind: 'vehicle', count: 2, baseZ: 0.6, baseTier: 0 },
      { className: 'fire', kind: 'hazard', count: 1, baseZ: 4.1, baseTier: 3 },
      { className: 'smoke', kind: 'hazard', count: 1, baseZ: 3.8, baseTier: 3 },
    ],
  },
  {
    feedId: 'feed-river',
    label: 'Río Rímac — Puente',
    cameraId: 'CAM-LIM-112',
    location: 'Rímac',
    scenario: 'disaster',
    classes: [
      { className: 'water', kind: 'environment', count: 1, baseZ: 3.4, baseTier: 3 },
      { className: 'person', kind: 'person', count: 2, baseZ: 0.9, baseTier: 1 },
      { className: 'debris', kind: 'hazard', count: 1, baseZ: 2.8, baseTier: 2 },
    ],
  },
]

const ENTITY_LABELS: Record<string, string[]> = {
  person: ['Persona-A', 'Persona-B', 'Persona-C', 'Persona-D', 'Persona-E', 'Persona-F', 'Persona-G', 'Persona-H'],
  car: ['Auto-α', 'Auto-β', 'Auto-γ'],
  truck: ['Camión-K', 'Camión-L'],
  bus: ['Bus-01'],
  motorcycle: ['Moto-M1'],
  backpack: ['Mochila-1', 'Mochila-2'],
  handbag: 'Bolso-A,Bolso-B,Bolso-C'.split(','),
  'shopping cart': 'Carrito-1,Carrito-2'.split(','),
  forklift: 'Montacarga-1,Montacarga-2'.split(','),
  fire: ['Fuego-Z1'],
  smoke: ['Humo-Z1'],
  water: ['Agua-R1'],
  debris: ['Escombros-D1'],
}

function tierFromZ(z: number): Tier {
  if (z >= 3.5) return 3
  if (z >= 2.5) return 2
  if (z >= 1.5) return 1
  return 0
}

function buildNodes(): EntityNode[] {
  const nodes: EntityNode[] = []
  const now = Date.now()
  FEED_DEFS.forEach((feed) => {
    feed.classes.forEach((cls) => {
      const labels = ENTITY_LABELS[cls.className] ?? [`${cls.className}-${feed.feedId}`]
      for (let i = 0; i < cls.count; i++) {
        const label = labels[i % labels.length]
        const detectionCount = Math.round(rand(8, 60))
        const reappearanceCount = Math.floor(rng() * 3)
        const anomalyZ = Math.max(0, cls.baseZ + rand(-0.6, 0.8))
        const tier = Math.max(cls.baseTier, tierFromZ(anomalyZ))
        nodes.push({
          id: `${feed.feedId}::${cls.className}::${i}`,
          label,
          kind: cls.kind,
          className: cls.className,
          feedId: feed.feedId,
          detectionCount,
          reappearanceCount,
          totalDurationMs: Math.round(detectionCount * rand(2.5, 6) * 1000),
          confidence: Math.round(rand(0.78, 0.98) * 100) / 100,
          anomalyZ: Math.round(anomalyZ * 100) / 100,
          tier,
          firstSeenMs: now - Math.round(rand(60_000, 600_000)),
          lastSeenMs: now - Math.round(rand(0, 45_000)),
        })
      }
    })
  })
  return nodes
}

function buildEdges(nodes: EntityNode[]): CorrelationEdge[] {
  const edges: CorrelationEdge[] = []
  // Within-feed correlations (stronger)
  const byFeed = new Map<string, EntityNode[]>()
  nodes.forEach((n) => {
    if (!byFeed.has(n.feedId)) byFeed.set(n.feedId, [])
    byFeed.get(n.feedId)!.push(n)
  })

  byFeed.forEach((group) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        // Person↔object/hazard correlations are the interesting ones
        const personInvolved = a.kind === 'person' || b.kind === 'person'
        const hazardInvolved = a.kind === 'hazard' || b.kind === 'hazard'
        const base = personInvolved ? 0.45 : 0.2
        const boost = hazardInvolved ? 0.3 : 0
        const familiarity = Math.min(1, base + boost + rand(0, 0.4))
        const proximity = Math.min(1, rand(0.3, 0.95) * familiarity + 0.1)
        const temporalOverlap = Math.min(1, rand(0.4, 0.95))
        const encounterCount = Math.round(rand(2, 14) * familiarity)
        const sharedFrames = Math.round(encounterCount * rand(8, 25))
        const sharedDurationMs = sharedFrames * 1000
        // Correlation = weighted blend: familiarity 40% + proximity 25% + temporal 20% + hazard 15%
        const hazardWeight = hazardInvolved ? 0.15 : 0
        const correlationScore = Math.min(
          1,
          familiarity * 0.4 + proximity * 0.25 + temporalOverlap * 0.2 + (hazardInvolved ? 0.15 : 0) + hazardWeight * 0,
        )
        edges.push({
          source: a.id,
          target: b.id,
          encounterCount,
          sharedFrames,
          sharedDurationMs,
          proximityScore: Math.round(proximity * 100) / 100,
          temporalOverlap: Math.round(temporalOverlap * 100) / 100,
          familiarityScore: Math.round(familiarity * 100) / 100,
          correlationScore: Math.round(correlationScore * 100) / 100,
          crossFeed: false,
        })
      }
    }
  })

  // Cross-feed correlations (weaker — subject re-id across cameras)
  const personNodes = nodes.filter((n) => n.kind === 'person')
  for (let i = 0; i < Math.min(personNodes.length, 6); i++) {
    const a = personNodes[i]
    const candidate = personNodes.find((n) => n.feedId !== a.feedId && n.id !== a.id)
    if (!candidate) continue
    if (rng() > 0.45) continue
    const familiarity = Math.round(rand(0.18, 0.55) * 100) / 100
    const proximity = Math.round(rand(0.1, 0.4) * 100) / 100
    const temporalOverlap = Math.round(rand(0.5, 0.9) * 100) / 100
    const correlation = Math.min(1, familiarity * 0.5 + temporalOverlap * 0.3 + 0.05)
    edges.push({
      source: a.id,
      target: candidate.id,
      encounterCount: Math.round(rand(1, 4)),
      sharedFrames: Math.round(rand(5, 20)),
      sharedDurationMs: Math.round(rand(5_000, 20_000)),
      proximityScore: proximity,
      temporalOverlap,
      familiarityScore: familiarity,
      correlationScore: Math.round(correlation * 100) / 100,
      crossFeed: true,
    })
  }

  return edges
}

function buildFeeds(nodes: EntityNode[]): FeedSnapshot[] {
  return FEED_DEFS.map((def) => {
    const entityIds = nodes.filter((n) => n.feedId === def.feedId).map((n) => n.id)
    return {
      feedId: def.feedId,
      label: def.label,
      cameraId: def.cameraId,
      location: def.location,
      entityIds,
      totalSubjects: entityIds.length,
      totalFrames: Math.round(rand(4200, 9800)),
      isLive: true,
    }
  })
}

let cached: EntityNetwork | null = null

export function getEntityNetwork(): EntityNetwork {
  if (cached) return cached
  const nodes = buildNodes()
  const edges = buildEdges(nodes)
  const feeds = buildFeeds(nodes)
  cached = {
    nodes,
    edges,
    feeds,
    totalFrames: feeds.reduce((s, f) => s + f.totalFrames, 0),
    generatedAt: Date.now(),
  }
  return cached
}

// ─── Entity visual styling ──────────────────────────────────────────────────
export const KIND_META: Record<EntityKind, { label: string; color: string; icon: string }> = {
  person: { label: 'Person', color: '#3b82f6', icon: 'user' },
  vehicle: { label: 'Vehicle', color: '#10b981', icon: 'car' },
  object: { label: 'Object', color: '#a855f7', icon: 'package' },
  hazard: { label: 'Hazard', color: '#ef4444', icon: 'alert-triangle' },
  environment: { label: 'Environment', color: '#0ea5e9', icon: 'waves' },
}

// ─── Live tick → entity mapping ─────────────────────────────────────────────
const CLASS_TO_KIND: Record<string, EntityKind> = {
  person: 'person',
  car: 'vehicle', truck: 'vehicle', bus: 'vehicle', motorcycle: 'vehicle', forklift: 'vehicle',
  backpack: 'object', handbag: 'object', 'shopping cart': 'object', suitcase: 'object',
  fire: 'hazard', smoke: 'hazard', debris: 'hazard',
  water: 'environment',
}

export interface LiveEntity {
  id: string
  label: string
  feedId: string
  className: string
  kind: EntityKind
  z: number
  tier: number
  ts: number
}

/**
 * Merge live detection ticks into the base entity network. Anomaly+ ticks
 * (tier >= 2) become "live" entity nodes appended to the network with a
 * "live" prefix so the dashboard's correlation graph visibly grows when
 * live mode is on. Each live entity correlates (weakly) with the most
 * recent base entity in the same feed.
 */
export function mergeLiveTicks(base: EntityNetwork, live: LiveEntity[]): EntityNetwork {
  if (live.length === 0) return base
  const liveNodes: EntityNode[] = live.slice(0, 12).map((l, i) => {
    const kind = CLASS_TO_KIND[l.className] ?? 'object'
    return {
      id: `live::${l.id}`,
      label: `⚡${l.className}`,
      kind,
      className: l.className,
      feedId: l.feedId,
      detectionCount: 1 + (l.tier >= 2 ? 2 : 0),
      reappearanceCount: 0,
      totalDurationMs: 1000,
      confidence: 0.85,
      anomalyZ: l.z,
      tier: l.tier as Tier,
      firstSeenMs: l.ts,
      lastSeenMs: l.ts,
    }
  })
  // Edges: each live node correlates with the most recent base entity in the same feed.
  const liveEdges: CorrelationEdge[] = []
  liveNodes.forEach((ln) => {
    const baseInFeed = base.nodes.filter((n) => n.feedId === ln.feedId)
    if (baseInFeed.length === 0) return
    // pick the most-recent base node by lastSeenMs
    const target = baseInFeed.reduce((a, b) => (b.lastSeenMs > a.lastSeenMs ? b : a))
    const corr = Math.min(0.95, 0.4 + ln.anomalyZ * 0.12)
    liveEdges.push({
      source: ln.id,
      target: target.id,
      encounterCount: 1,
      sharedFrames: Math.round(corr * 15),
      sharedDurationMs: Math.round(corr * 8000),
      proximityScore: Math.round(corr * 100) / 100,
      temporalOverlap: 0.9,
      familiarityScore: Math.round(corr * 100) / 100,
      correlationScore: Math.round(corr * 100) / 100,
      crossFeed: false,
    })
  })
  // Also correlate consecutive live nodes with each other.
  for (let i = 1; i < liveNodes.length; i++) {
    const a = liveNodes[i - 1]
    const b = liveNodes[i]
    if (a.feedId !== b.feedId) continue
    const corr = 0.35 + Math.random() * 0.2
    liveEdges.push({
      source: a.id,
      target: b.id,
      encounterCount: 1,
      sharedFrames: 5,
      sharedDurationMs: 3000,
      proximityScore: Math.round(corr * 100) / 100,
      temporalOverlap: 0.8,
      familiarityScore: Math.round(corr * 100) / 100,
      correlationScore: Math.round(corr * 100) / 100,
      crossFeed: false,
    })
  }
  return {
    ...base,
    nodes: [...base.nodes, ...liveNodes],
    edges: [...base.edges, ...liveEdges],
    feeds: base.feeds.map((f) => {
      const liveInFeed = liveNodes.filter((n) => n.feedId === f.feedId)
      return liveInFeed.length === 0 ? f : {
        ...f,
        entityIds: [...f.entityIds, ...liveInFeed.map((n) => n.id)],
        totalSubjects: f.totalSubjects + liveInFeed.length,
      }
    }),
  }
}
