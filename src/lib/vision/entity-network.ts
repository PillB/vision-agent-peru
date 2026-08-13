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
