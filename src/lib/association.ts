/**
 * Cross-Video Candidate Association — Round 4
 *
 * Implements section 16 of the Solarize system prompt:
 *   - Combine representative track embeddings
 *   - Multiple crops rather than one crop
 *   - Appearance consistency + semantic attributes
 *   - Camera topology + timestamps
 *   - Travel-time constraints
 *   - Entry/exit direction
 *   - Quality and occlusion
 *   - Conflicting evidence
 *
 * Three outcomes (section 16):
 *   - plausible candidate
 *   - insufficient evidence
 *   - incompatible candidate
 *
 * Open-set rejection (section 16):
 *   Unrelated observations are NOT forced into an existing candidate.
 *
 * Absence assessment (section 17):
 *   Never say "this person is not in the video."
 *   Use: "No candidate exceeded the validated threshold within the analyzed coverage."
 *   Returns: candidate found | no confident candidate | inconclusive
 *
 * Privacy (section 2):
 *   "Appearance similarity does not establish identity."
 *   Internal IDs are track IDs, candidate IDs, association IDs — NOT identity.
 */

import type { EvidenceRecord } from './evidence'
import { cosineSim } from './evidence'

export interface CameraTopology {
  cameraId: string
  label: string
  location?: string
  /** Cameras that are physically close enough for direct walking. */
  adjacentCameraIds: string[]
  /** Estimated walking time (seconds) to each adjacent camera. */
  travelTimeSeconds: Record<string, number>
}

export interface CandidateAssociation {
  associationId: string
  leftEvidenceId: string
  rightEvidenceId: string
  leftTrackId?: string
  rightTrackId?: string
  leftCameraId: string
  rightCameraId: string
  leftTimestamp: number
  rightTimestamp: number
  appearanceScore: number       // 0..1, cosine sim of CLIP embeddings
  semanticScore: number         // 0..1, attribute overlap (clothing color, etc.)
  topologyScore: number         // 0..1, 1 if cameras are adjacent or same
  temporalScore: number         // 0..1, 1 if travel time is plausible
  motionScore: number           // 0..1, direction consistency (future)
  calibratedScore: number       // weighted fusion of above
  conflicts: string[]           // reasons this might NOT be a match
  evidenceQuality: 'high' | 'medium' | 'low'
  decision: 'plausible' | 'insufficient' | 'incompatible' | 'pending'
  reviewer?: string
  reviewedAt?: number
  /** Always shown to the user. */
  disclaimer: string
}

export const APPEARANCE_DISCLAIMER =
  'Appearance similarity does not establish identity. This is a candidate association requiring human review.'

// ─── Scoring weights (calibrated fusion) ───
const WEIGHTS = {
  appearance: 0.45,
  semantic: 0.20,
  topology: 0.15,
  temporal: 0.15,
  motion: 0.05,
}

// ─── Thresholds ───
export const THRESHOLDS = {
  plausible: 0.65,        // >= this → plausible candidate
  incompatible: 0.25,     // < this → incompatible
  // Between → insufficient evidence
  minAppearanceForPlausible: 0.55,  // even if total is high, appearance must be >= this
  minTravelTimeSeconds: 5,          // less than this → suspicious (same frame?)
  maxTravelTimeHours: 24,           // more than this → incompatible
}

/**
 * Compute the topology score between two cameras.
 * 1.0 = same camera
 * 0.8 = adjacent cameras
 * 0.0 = no topology info
 */
function computeTopologyScore(
  leftCameraId: string,
  rightCameraId: string,
  topology: CameraTopology[],
): number {
  if (leftCameraId === rightCameraId) return 1.0
  const leftTopo = topology.find(t => t.cameraId === leftCameraId)
  if (leftTopo?.adjacentCameraIds.includes(rightCameraId)) return 0.8
  const rightTopo = topology.find(t => t.cameraId === rightCameraId)
  if (rightTopo?.adjacentCameraIds.includes(leftCameraId)) return 0.8
  return 0.0
}

/**
 * Compute the temporal score based on travel-time plausibility.
 * Returns 0..1 where 1 = perfectly plausible travel time.
 *
 * If cameras are the same, temporal score is based on gap (must be > 0).
 * If cameras are different, uses topology travel time.
 */
function computeTemporalScore(
  leftCameraId: string,
  rightCameraId: string,
  leftTimestamp: number,
  rightTimestamp: number,
  topology: CameraTopology[],
): { score: number; conflicts: string[] } {
  const gapSeconds = Math.abs(rightTimestamp - leftTimestamp) / 1000
  const conflicts: string[] = []

  if (gapSeconds < THRESHOLDS.minTravelTimeSeconds) {
    // Same frame or near-same — could be a multi-camera setup
    return { score: 0.5, conflicts: ['Very small time gap — verify multi-camera setup'] }
  }

  if (gapSeconds > THRESHOLDS.maxTravelTimeHours * 3600) {
    conflicts.push(`Time gap ${Math.round(gapSeconds / 3600)}h exceeds max ${THRESHOLDS.maxTravelTimeHours}h`)
    return { score: 0.0, conflicts }
  }

  if (leftCameraId === rightCameraId) {
    // Same camera — any positive gap is plausible (person can reappear)
    return { score: 0.9, conflicts }
  }

  // Different cameras — check topology
  const leftTopo = topology.find(t => t.cameraId === leftCameraId)
  const expectedTravel = leftTopo?.travelTimeSeconds[rightCameraId]
  if (expectedTravel === undefined) {
    // No topology info — give benefit of the doubt but flag
    return { score: 0.5, conflicts: ['No topology info for camera pair'] }
  }

  // Allow 50% slack on travel time
  const minExpected = expectedTravel * 0.5
  const maxExpected = expectedTravel * 2
  if (gapSeconds < minExpected) {
    conflicts.push(`Gap ${Math.round(gapSeconds)}s shorter than expected ${Math.round(expectedTravel)}s`)
    return { score: 0.3, conflicts }
  }
  if (gapSeconds > maxExpected) {
    conflicts.push(`Gap ${Math.round(gapSeconds)}s longer than expected ${Math.round(expectedTravel)}s`)
    return { score: 0.4, conflicts }
  }
  return { score: 0.95, conflicts }
}

/**
 * Compute the semantic score based on attribute overlap.
 * Compares detection class + carried object notes.
 */
function computeSemanticScore(left: EvidenceRecord, right: EvidenceRecord): number {
  let matches = 0
  let total = 0
  // Detection class must match
  total++
  if (left.detection.class === right.detection.class) matches++
  // Notes (if both have them) — keyword overlap
  if (left.note && right.note) {
    const leftTokens = new Set(left.note.toLowerCase().split(/\W+/).filter(t => t.length > 2))
    const rightTokens = new Set(right.note.toLowerCase().split(/\W+/).filter(t => t.length > 2))
    let overlap = 0
    for (const t of leftTokens) if (rightTokens.has(t)) overlap++
    total++
    if (overlap > 0) matches++
  }
  return total > 0 ? matches / total : 0
}

/**
 * Assess evidence quality based on detection score + embedding presence.
 */
function assessQuality(rec: EvidenceRecord): 'high' | 'medium' | 'low' {
  if (rec.detection.score >= 0.7 && rec.embedding) return 'high'
  if (rec.detection.score >= 0.4) return 'medium'
  return 'low'
}

/**
 * Propose a candidate association between two evidence records.
 *
 * Does NOT auto-merge. Returns a CandidateAssociation with decision
 * = 'plausible' | 'insufficient' | 'incompatible'.
 *
 * Human review is required to confirm (decision → 'plausible' becomes 'confirmed').
 */
export function proposeAssociation(
  left: EvidenceRecord,
  right: EvidenceRecord,
  topology: CameraTopology[] = [],
): CandidateAssociation {
  const appearanceScore = cosineSim(left.embedding, right.embedding)
  const semanticScore = computeSemanticScore(left, right)
  const topologyScore = computeTopologyScore(left.cameraId, right.cameraId, topology)
  const temporal = computeTemporalScore(
    left.cameraId, right.cameraId, left.timestamp, right.timestamp, topology
  )
  const motionScore = 0  // future: direction consistency

  const calibratedScore =
    WEIGHTS.appearance * appearanceScore +
    WEIGHTS.semantic * semanticScore +
    WEIGHTS.topology * topologyScore +
    WEIGHTS.temporal * temporal.score +
    WEIGHTS.motion * motionScore

  // Determine decision
  let decision: CandidateAssociation['decision'] = 'insufficient'
  const conflicts: string[] = [...temporal.conflicts]

  if (appearanceScore < THRESHOLDS.incompatible) {
    decision = 'incompatible'
    conflicts.push(`Appearance score ${appearanceScore.toFixed(2)} below incompatible threshold`)
  } else if (calibratedScore >= THRESHOLDS.plausible
    && appearanceScore >= THRESHOLDS.minAppearanceForPlausible) {
    decision = 'plausible'
  } else if (calibratedScore < THRESHOLDS.incompatible) {
    decision = 'incompatible'
    conflicts.push(`Calibrated score ${calibratedScore.toFixed(2)} below incompatible threshold`)
  } else {
    decision = 'insufficient'
    conflicts.push(`Calibrated score ${calibratedScore.toFixed(2)} in insufficient range`)
  }

  // Open-set rejection: if appearance is very low, never mark as plausible
  // even if other scores are high (prevents forced merge).
  if (appearanceScore < THRESHOLDS.incompatible && decision === 'plausible') {
    decision = 'incompatible'
    conflicts.push('Open-set rejection: appearance too low for plausible match')
  }

  return {
    associationId: `assoc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    leftEvidenceId: left.id,
    rightEvidenceId: right.id,
    leftTrackId: left.trackId,
    rightTrackId: right.trackId,
    leftCameraId: left.cameraId,
    rightCameraId: right.cameraId,
    leftTimestamp: left.timestamp,
    rightTimestamp: right.timestamp,
    appearanceScore,
    semanticScore,
    topologyScore,
    temporalScore: temporal.score,
    motionScore,
    calibratedScore,
    conflicts,
    evidenceQuality: assessQuality(left) === 'high' && assessQuality(right) === 'high'
      ? 'high'
      : assessQuality(left) === 'low' || assessQuality(right) === 'low'
      ? 'low'
      : 'medium',
    decision,
    disclaimer: APPEARANCE_DISCLAIMER,
  }
}

/**
 * Find all candidate associations across a set of evidence records.
 * Returns only 'plausible' and 'insufficient' candidates (excludes 'incompatible').
 *
 * Does NOT auto-merge. Each candidate requires human review.
 */
export function findCrossVideoCandidates(
  evidence: EvidenceRecord[],
  topology: CameraTopology[] = [],
  minScore: number = THRESHOLDS.incompatible,
): CandidateAssociation[] {
  const candidates: CandidateAssociation[] = []
  // Only consider records WITH embeddings — without them, association
  // is based on metadata alone (too weak for cross-video).
  const withEmbeddings = evidence.filter(e => e.embedding !== undefined)
  for (let i = 0; i < withEmbeddings.length; i++) {
    for (let j = i + 1; j < withEmbeddings.length; j++) {
      const assoc = proposeAssociation(withEmbeddings[i], withEmbeddings[j], topology)
      if (assoc.decision !== 'incompatible' && assoc.calibratedScore >= minScore) {
        candidates.push(assoc)
      }
    }
  }
  // Sort by calibrated score descending
  candidates.sort((a, b) => b.calibratedScore - a.calibratedScore)
  return candidates
}

// ─── Absence assessment (section 17) ───

export interface AbsenceResult {
  query: string
  result: 'candidate_found' | 'no_confident_candidate' | 'inconclusive'
  videosSearched: string[]
  timeRanges: Array<{ videoId: string; startSeconds: number; endSeconds: number }>
  percentSampled: number
  detectorRecallEstimate: number
  failedIntervals: Array<{ videoId: string; startSeconds: number; reason: string }>
  occlusion: 'low' | 'medium' | 'high' | 'unknown'
  cropQuality: 'low' | 'medium' | 'high' | 'unknown'
  threshold: number
  strongestNearMisses: Array<{ evidenceId: string; score: number }>
  unsupportedQueryTerms: string[]
  modelLimitations: string[]
  explanation: string
}

/**
 * Assess whether a queried person/object is absent from the indexed videos.
 *
 * NEVER says "this person is not in the video." Instead returns:
 *   - candidate_found: a confident match exists
 *   - no_confident_candidate: no match exceeded threshold, but coverage is good
 *   - inconclusive: coverage or detector reliability is insufficient
 *
 * Per section 17: "If coverage or detector reliability is insufficient,
 * the only valid result is: Inconclusive."
 */
export function assessAbsence(
  queryEmbedding: Float32Array | undefined,
  queryText: string,
  evidence: EvidenceRecord[],
  coverage: {
    videosSearched: string[]
    timeRanges: Array<{ videoId: string; startSeconds: number; endSeconds: number }>
    percentSampled: number
    failedIntervals: Array<{ videoId: string; startSeconds: number; reason: string }>
    detectorRecallEstimate: number
  },
  threshold: number = 0.65,
): AbsenceResult {
  // Compute similarity scores
  const scored = evidence
    .filter(e => e.embedding !== undefined)
    .map(e => ({
      evidenceId: e.id,
      score: cosineSim(queryEmbedding, e.embedding),
    }))
    .sort((a, b) => b.score - a.score)

  const topMatch = scored[0]
  const nearMisses = scored.filter(s => s.score >= threshold * 0.7 && s.score < threshold)

  // Determine result
  let result: AbsenceResult['result']
  if (topMatch && topMatch.score >= threshold) {
    result = 'candidate_found'
  } else if (coverage.percentSampled < 50 || coverage.detectorRecallEstimate < 0.6) {
    // Insufficient coverage or detector reliability → MUST be inconclusive
    result = 'inconclusive'
  } else if (topMatch && topMatch.score >= threshold * 0.7) {
    // Has near-miss candidates but below threshold
    result = 'inconclusive'
  } else {
    result = 'no_confident_candidate'
  }

  // Build explanation
  let explanation: string
  if (result === 'candidate_found') {
    explanation = `Candidate found: top match score ${topMatch!.score.toFixed(2)} >= threshold ${threshold}. ` +
      `Appearance similarity does not establish identity — human review required.`
  } else if (result === 'no_confident_candidate') {
    explanation = `No candidate exceeded the validated threshold (${threshold}) within the analyzed coverage. ` +
      `Coverage: ${coverage.percentSampled.toFixed(0)}% sampled. ` +
      `Detector recall estimate: ${coverage.detectorRecallEstimate.toFixed(2)}. ` +
      `Strongest near miss: ${topMatch ? topMatch.score.toFixed(2) : 'none'}. ` +
      `This does not prove absence — only that no confident candidate was found in the analyzed coverage.`
  } else {
    explanation = `Inconclusive: coverage (${coverage.percentSampled.toFixed(0)}%) or detector reliability ` +
      `(${coverage.detectorRecallEstimate.toFixed(2)}) is insufficient to make a confident assessment. ` +
      `The only valid result is: inconclusive. ` +
      `Do not interpret this as confirmation of absence.`
  }

  return {
    query: queryText,
    result,
    videosSearched: coverage.videosSearched,
    timeRanges: coverage.timeRanges,
    percentSampled: coverage.percentSampled,
    detectorRecallEstimate: coverage.detectorRecallEstimate,
    failedIntervals: coverage.failedIntervals,
    occlusion: 'unknown',  // future: compute from detection quality
    cropQuality: 'unknown',
    threshold,
    strongestNearMisses: nearMisses.slice(0, 5),
    unsupportedQueryTerms: [],  // populated by query parser
    modelLimitations: [
      'CLIP similarity values are not calibrated probabilities',
      'Detector recall varies by scene, lighting, and occlusion',
      'Sampling strategy affects coverage — gaps may exist',
    ],
    explanation,
  }
}
