/**
 * Evidence Search Pipeline — local-first evidence indexing & retrieval.
 *
 * Implements the local-first GitHub Pages workflow:
 *   upload → capability check → adaptive sampling → detection → tracking →
 *   crops → VLM embeddings → IndexedDB → NL/reference search →
 *   ranked candidates → near misses → timeline review →
 *   candidate association → human confirmation → evidence export
 *
 * No server needed. All persistence is via IndexedDB (src/lib/idb.ts).
 * All inference (CLIP embeddings) is via transformers.js in the browser.
 *
 * ─── Schema ────────────────────────────────────────────────────────────
 *
 * EvidenceRecord:
 *   id:           uuid
 *   createdAt:    epoch ms
 *   cameraId:     source camera
 *   useCaseId:    use case that produced this evidence
 *   timestamp:    epoch ms of the source frame
 *   snapshotDataUrl:  JPEG data URL of the cropped region
 *   detection:    { class, score, bbox }
 *   embedding?:   Float32Array (CLIP embedding, 512-dim) — undefined if
 *                 embedding generation failed or was skipped
 *   trackId?:     appearance track ID (from AppearanceTracker)
 *   note?:        human-entered annotation
 *   confirmed?:   boolean — operator has reviewed and confirmed this evidence
 *
 * ─── Search ────────────────────────────────────────────────────────────
 *
 * Two search modes:
 *   1. Natural-language search: embed the query with CLIP, cosine similarity
 *      against all stored evidence embeddings, return top-K.
 *   2. Reference-image search: embed a reference image with CLIP, same.
 *
 * Both modes fall back to keyword matching on detection.class + note when
 * embeddings are unavailable (CLIP failed to load, etc.).
 */

import { idbPut, idbGet, idbGetAll, idbDelete, idbClear, idbAvailable } from './idb'

export interface EvidenceRecord {
  id: string
  createdAt: number
  cameraId: string
  useCaseId: string
  timestamp: number
  snapshotDataUrl: string
  detection: { class: string; score: number; bbox: [number, number, number, number] }
  embedding?: Float32Array
  trackId?: string
  note?: string
  confirmed?: boolean
}

export interface SearchResult {
  record: EvidenceRecord
  score: number  // 0..1 cosine similarity OR keyword match ratio
  matchedOn: 'embedding' | 'keyword'
}

/**
 * Persist a new evidence record. The embedding is optional — if not
 * provided, the record is keyword-searchable only.
 */
export async function addEvidence(rec: EvidenceRecord): Promise<void> {
  await idbPut('evidence', rec)
}

/**
 * Retrieve all stored evidence, sorted by timestamp descending.
 */
export async function listEvidence(): Promise<EvidenceRecord[]> {
  const all = await idbGetAll<EvidenceRecord>('evidence')
  return all.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Delete one evidence record by ID.
 */
export async function deleteEvidence(id: string): Promise<void> {
  await idbDelete('evidence', id)
}

/**
 * Clear all evidence.
 */
export async function clearEvidence(): Promise<void> {
  await idbClear('evidence')
}

/**
 * Mark an evidence record as confirmed by the operator.
 */
export async function confirmEvidence(id: string): Promise<void> {
  const rec = await idbGet<EvidenceRecord>('evidence', id)
  if (rec) {
    rec.confirmed = true
    await idbPut('evidence', rec)
  }
}

/**
 * Attach a note to an evidence record.
 */
export async function annotateEvidence(id: string, note: string): Promise<void> {
  const rec = await idbGet<EvidenceRecord>('evidence', id)
  if (rec) {
    rec.note = note
    await idbPut('evidence', rec)
  }
}

// ─── Similarity ──────────────────────────────────────────────────────

/**
 * Cosine similarity between two vectors. Returns 0..1.
 * Returns 0 if either vector is undefined or wrong dimensionality.
 */
export function cosineSim(a: Float32Array | undefined, b: Float32Array | undefined): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * Keyword-match score: token overlap between query and (class + note).
 * Returns 0..1.
 */
function keywordScore(query: string, rec: EvidenceRecord): number {
  const qTokens = new Set(query.toLowerCase().split(/\W+/).filter(t => t.length > 2))
  if (qTokens.size === 0) return 0
  const doc = `${rec.detection.class} ${rec.note ?? ''} ${rec.useCaseId}`.toLowerCase()
  const docTokens = new Set(doc.split(/\W+/).filter(t => t.length > 2))
  let hits = 0
  for (const t of qTokens) if (docTokens.has(t)) hits++
  return hits / qTokens.size
}

/**
 * Search evidence by natural-language query. Returns top-K results ranked
 * by cosine similarity to the query embedding (if provided) OR by keyword
 * match (fallback).
 *
 * @param queryEmbedding  Pre-computed CLIP embedding of the query. If
 *                        undefined, only keyword matching is used.
 * @param queryText       The raw text query (used for keyword fallback).
 * @param topK            Number of results to return. Default 10.
 */
export async function searchEvidence(
  queryEmbedding: Float32Array | undefined,
  queryText: string,
  topK: number = 10,
): Promise<SearchResult[]> {
  const all = await listEvidence()
  const scored: SearchResult[] = all.map(rec => {
    const embScore = cosineSim(queryEmbedding, rec.embedding)
    const kwScore = keywordScore(queryText, rec)
    // Prefer embedding score if non-zero; fall back to keyword.
    if (embScore > 0) {
      return { record: rec, score: embScore, matchedOn: 'embedding' as const }
    }
    return { record: rec, score: kwScore, matchedOn: 'keyword' as const }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

/**
 * Find near-miss candidates: evidence with low similarity to confirmed
 * evidence from the same use case. These are cases where the system
 * flagged something but the operator has not confirmed — useful for
 * "review these before discarding" workflows.
 *
 * @param useCaseId   Filter to this use case. If undefined, all use cases.
 * @param threshold   Similarity below which a record is a "near miss"
 *                    relative to confirmed records. Default 0.5.
 */
export async function findNearMisses(
  useCaseId?: string,
  threshold: number = 0.5,
): Promise<SearchResult[]> {
  const all = await listEvidence()
  const confirmed = all.filter(r =>
    r.confirmed && (!useCaseId || r.useCaseId === useCaseId)
  )
  if (confirmed.length === 0) return []
  const unconfirmed = all.filter(r =>
    !r.confirmed && (!useCaseId || r.useCaseId === useCaseId)
  )
  const near: SearchResult[] = []
  for (const uc of unconfirmed) {
    // Find the best similarity to any confirmed record.
    let best = 0
    let bestRef: EvidenceRecord | null = null
    for (const c of confirmed) {
      const s = cosineSim(uc.embedding, c.embedding)
      if (s > best) { best = s; bestRef = c }
    }
    // Near-miss: similar enough to be worth reviewing, but not confirmed.
    if (best > threshold * 0.5 && best < threshold) {
      near.push({ record: uc, score: best, matchedOn: 'embedding' })
    } else if (best === 0 && uc.embedding === undefined) {
      // No embedding — include as a near-miss candidate for human review.
      near.push({ record: uc, score: 0, matchedOn: 'keyword' })
    }
  }
  return near.sort((a, b) => b.score - a.score)
}

// ─── Association ────────────────────────────────────────────────────

/**
 * Associate evidence records by track ID. Returns a map of trackId →
 * records belonging to that track. Records without a trackId are grouped
 * under 'untracked'.
 */
export async function associateByTrack(): Promise<Record<string, EvidenceRecord[]>> {
  const all = await listEvidence()
  const groups: Record<string, EvidenceRecord[]> = {}
  for (const rec of all) {
    const key = rec.trackId ?? 'untracked'
    if (!groups[key]) groups[key] = []
    groups[key].push(rec)
  }
  return groups
}

// ─── Export ─────────────────────────────────────────────────────────

/**
 * Export evidence to a JSON file (downloadable). Includes all fields
 * except the embedding (which is large and not human-readable).
 */
export async function exportEvidenceJSON(): Promise<string> {
  const all = await listEvidence()
  const exportable = all.map(r => ({
    id: r.id,
    createdAt: r.createdAt,
    cameraId: r.cameraId,
    useCaseId: r.useCaseId,
    timestamp: r.timestamp,
    snapshotDataUrl: r.snapshotDataUrl,
    detection: r.detection,
    trackId: r.trackId,
    note: r.note,
    confirmed: r.confirmed,
    hasEmbedding: !!r.embedding,
    embeddingDims: r.embedding?.length ?? 0,
  }))
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: exportable.length,
    idbAvailable: idbAvailable(),
    records: exportable,
  }, null, 2)
}

/**
 * Check if IndexedDB is available for evidence storage.
 */
export function evidenceStorageAvailable(): boolean {
  return idbAvailable()
}
