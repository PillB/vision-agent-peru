/**
 * Vision Agent Perú — Domain types
 *
 * Models the entities identified across camera feeds, their co-occurrence and
 * correlation, the agentic use cases, and the 9-stage agentic decision flow.
 * Mirrors the reference repo (lib/use-cases.ts, lib/agent.ts, lib/agentic-response.ts,
 * lib/subject-reid.ts) so the dashboard is faithful to the real system.
 */

// ─── Capability levels (from reference lib/use-cases.ts) ───────────────────
export type CapabilityLevel = 'traditional' | 'mldl' | 'cognitive' | 'agentic'

// ─── Tier severity (from reference lib/agent.ts) ────────────────────────────
export type Tier = 0 | 1 | 2 | 3

export const TIER_META: Record<Tier, { label: string; short: string; color: string; glow: string }> = {
  0: { label: 'NOMINAL', short: 'T0', color: '#10b981', glow: 'rgba(16,185,129,0.55)' },
  1: { label: 'WATCH', short: 'T1', color: '#f59e0b', glow: 'rgba(245,158,11,0.55)' },
  2: { label: 'ANOMALY', short: 'T2', color: '#f97316', glow: 'rgba(249,115,22,0.55)' },
  3: { label: 'CRITICAL', short: 'T3', color: '#ef4444', glow: 'rgba(239,68,68,0.6)' },
}

// ─── Entity / subject types ─────────────────────────────────────────────────
export type EntityKind = 'person' | 'vehicle' | 'object' | 'hazard' | 'environment'

export interface EntityNode {
  id: string
  label: string
  kind: EntityKind
  /** Detector class label (person, car, truck, backpack, fire, flood, ...). */
  className: string
  feedId: string
  detectionCount: number
  reappearanceCount: number
  totalDurationMs: number
  confidence: number
  /** Z-score of this subject's density vs the feed baseline (0..5). */
  anomalyZ: number
  /** Tier the agent assigned this subject (drives node color). */
  tier: Tier
  firstSeenMs: number
  lastSeenMs: number
}

export interface CorrelationEdge {
  source: string
  target: string
  encounterCount: number
  sharedFrames: number
  sharedDurationMs: number
  /** Spatial proximity 0..1. */
  proximityScore: number
  /** Temporal co-occurrence 0..1 (how often seen together in time). */
  temporalOverlap: number
  /** Familiarity (proximity × sharedFrames) — reference repo field. */
  familiarityScore: number
  /** Combined correlation score 0..1 (weighted blend used by the network). */
  correlationScore: number
  /** Same feed or cross-feed correlation. */
  crossFeed: boolean
}

export interface FeedSnapshot {
  feedId: string
  label: string
  cameraId: string
  location: string
  /** Active entity ids in this feed. */
  entityIds: string[]
  totalSubjects: number
  totalFrames: number
  isLive: boolean
}

export interface EntityNetwork {
  nodes: EntityNode[]
  edges: CorrelationEdge[]
  feeds: FeedSnapshot[]
  totalFrames: number
  generatedAt: number
}

// ─── Use cases (mirrors reference lib/use-cases.ts, 15 cases) ───────────────
export interface UseCase {
  id: string
  name: string
  nameEn: string
  category: 'commercial' | 'disaster'
  level: CapabilityLevel
  description: string
  detectionClasses: string[]
  ruleType: 'count_threshold' | 'roi_breach' | 'time_gate' | 'frame_diff' | 'sustain_verify' | 'density_anomaly'
  params: {
    threshold?: number
    sustainTicks?: number
    timeGate?: { after: string; before: string }
  }
  actions: string[]
  indeciReport?: boolean
  icon: string
  tier: Tier
  signal: string
  value: string
}

// ─── Agent decision flow (mirrors reference lib/agentic-response.ts) ─────────
export type StageName =
  | 'OBSERVE'
  | 'VALIDATE_EVIDENCE'
  | 'POLICY'
  | 'JUDGE'
  | 'VALIDATE_JUDGE'
  | 'PROPOSE_ACTION'
  | 'APPROVAL'
  | 'EXECUTE'
  | 'VERIFY_OUTCOME'

export type StageStatus = 'pass' | 'fail' | 'skip' | 'pending' | 'active' | 'queued'

export type FlowNodeType = 'observe' | 'validate' | 'decision' | 'judge' | 'action' | 'verify' | 'terminal'

export interface FlowNode {
  id: string
  stage: StageName | 'RETRY' | 'SUPPRESSED' | 'ESCALATE' | 'RESOLVED'
  label: string
  short: string
  type: FlowNodeType
  /** Grid coordinates (col, row) for the DAG layout. */
  col: number
  row: number
  description: string
  icon: string
}

export type BranchTag =
  | 'pass'
  | 'fail'
  | 'tier0'
  | 'tier1'
  | 'tier2'
  | 'tier3'
  | 'approve'
  | 'reject'
  | 'retry'
  | 'suppressed'
  | 'resolve'
  | 'compensate'

export interface FlowEdge {
  source: string
  target: string
  branch: BranchTag
  label: string
  /** Probability weight 0..1 (visual thickness). */
  weight: number
}

export interface StageTrace {
  stage: StageName
  status: StageStatus
  timestamp: number
  detail: string
  reasoning: string
  tier?: Tier
  action?: string
  /** Outcome the stage produced, used to pick the branch. */
  branch?: BranchTag
}

export interface AgentFlowRun {
  useCaseId: string
  useCaseName: string
  cycle: number
  startedAt: number
  trace: StageTrace[]
  finalTier: Tier
  finalOutcome: 'resolved' | 'retry' | 'compensate' | 'pending_approval' | 'suppressed'
  finalActions: string[]
}
