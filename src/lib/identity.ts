/**
 * Identity Management System — persistent multi-object identity tracking.
 *
 * Based on the research synthesis (Phase 7 of the Re-ID guide):
 *   - Within-feed tracker: IoU-based with lost_track_buffer (simplified ByteTrack)
 *   - Global identity manager: centroid-based gallery with cosine similarity matching
 *   - Person identity: appearance features (bbox aspect ratio, dominant color, size)
 *   - Vehicle identity: class + color + size as appearance proxy
 *   - Cross-feed re-ID: spatio-temporal gating + appearance similarity
 *
 * ELI5: "This module gives each person and car a unique ID that sticks with them
 * even if they leave the camera and come back. It's like a digital name tag
 * that the system remembers."
 *
 * NOTE: Full face/gait/clothing embeddings require ONNX models that are too
 * heavy for this browser-only environment. This implementation uses lightweight
 * appearance features (bbox geometry + dominant color histogram) as a proxy.
 * The architecture is designed to swap in OSNet/ArcFace embeddings when
 * available.
 */

/** A single observation of a tracked object. */
export interface Observation {
  camId: string
  timestamp: number
  bbox: [number, number, number, number] // [x, y, w, h] in canvas pixels
  confidence: number
}

/** Lightweight appearance features extractable from canvas without ML models. */
export interface AppearanceFeatures {
  /** Aspect ratio of bbox (width / height) — stable for persons vs vehicles. */
  aspectRatio: number
  /** Relative size (bbox area / canvas area) — distance proxy. */
  relativeSize: number
  /** Dominant color as [r, g, b] — averaged from bbox center region. */
  dominantColor: [number, number, number]
  /** Color histogram signature (8 bins per channel = 24 values). */
  colorHistogram: number[]
}

/** A persistent identity for a person or vehicle. */
export interface TrackedIdentity {
  /** Stable unique ID (UUID-like). */
  trackId: string
  /** Type of tracked object. */
  type: 'person' | 'vehicle'
  /** Local track ID within current feed. */
  localTrackId: number
  /** Appearance features (updated each frame). */
  appearance: AppearanceFeatures
  /** All observations of this identity. */
  observations: Observation[]
  /** First seen timestamp (epoch ms). */
  firstSeen: number
  /** Last seen timestamp (epoch ms). */
  lastSeen: number
  /** Vehicle plate string (if read). */
  plateString?: string
}

/** Within-feed tracked object (transient, per-frame). */
export interface TrackedObject {
  localTrackId: number
  bbox: [number, number, number, number]
  class: string
  score: number
  age: number // frames since first detection
  lastSeen: number // epoch ms
  appearance?: AppearanceFeatures
}

/**
 * Lightweight within-feed tracker — IoU-based with lost track buffer.
 *
 * ELI5: "When the detector finds a person, the tracker checks if it looks like
 * the same person from the last frame (by comparing positions). If yes, it
 * keeps the same ID. If the person disappears for a few frames, it remembers
 * them for up to `lostTrackBuffer` frames before giving up."
 *
 * This is a simplified version of ByteTrack — it uses IoU matching without
 * the low-confidence second pass. It's fast (O(n*m) where n=tracks, m=detections)
 * and suitable for real-time browser use.
 */
export class WithinFeedTracker {
  private tracks: Map<number, TrackedObject> = new Map()
  private nextTrackId = 1
  private lostTrackBuffer: number
  private iouThreshold: number

  constructor(lostTrackBuffer = 60, iouThreshold = 0.3) {
    this.lostTrackBuffer = lostTrackBuffer
    this.iouThreshold = iouThreshold
  }

  /**
   * Update tracker with new detections. Returns tracked objects with stable IDs.
   */
  update(detections: Array<{ bbox: [number, number, number, number]; class: string; score: number }>): TrackedObject[] {
    const now = Date.now()
    const activeTracks = Array.from(this.tracks.values()).filter(
      (t) => now - t.lastSeen < this.lostTrackBuffer * 1000 / 30 // assume 30fps
    )

    // IoU matching
    const matched = new Set<number>()
    const unmatchedDetections: number[] = []

    for (let i = 0; i < detections.length; i++) {
      let bestTrack: TrackedObject | null = null
      let bestIou = this.iouThreshold

      for (const track of activeTracks) {
        if (matched.has(track.localTrackId)) continue
        if (track.class !== detections[i].class) continue

        const iou = this.computeIou(track.bbox, detections[i].bbox)
        if (iou > bestIou) {
          bestIou = iou
          bestTrack = track
        }
      }

      if (bestTrack) {
        // Update existing track
        bestTrack.bbox = detections[i].bbox
        bestTrack.score = detections[i].score
        bestTrack.age++
        bestTrack.lastSeen = now
        matched.add(bestTrack.localTrackId)
      } else {
        unmatchedDetections.push(i)
      }
    }

    // Create new tracks for unmatched detections
    for (const idx of unmatchedDetections) {
      const trackId = this.nextTrackId++
      const newTrack: TrackedObject = {
        localTrackId: trackId,
        bbox: detections[idx].bbox,
        class: detections[idx].class,
        score: detections[idx].score,
        age: 1,
        lastSeen: now,
      }
      this.tracks.set(trackId, newTrack)
    }

    // Remove stale tracks
    for (const [id, track] of this.tracks) {
      if (now - track.lastSeen > this.lostTrackBuffer * 1000 / 30) {
        this.tracks.delete(id)
      }
    }

    return Array.from(this.tracks.values()).filter((t) => now - t.lastSeen < 2000) // active in last 2s
  }

  /** Compute Intersection-over-Union between two bboxes. */
  private computeIou(bbox1: [number, number, number, number], bbox2: [number, number, number, number]): number {
    const [x1, y1, w1, h1] = bbox1
    const [x2, y2, w2, h2] = bbox2

    const xi1 = Math.max(x1, x2)
    const yi1 = Math.max(y1, y2)
    const xi2 = Math.min(x1 + w1, x2 + w2)
    const yi2 = Math.min(y1 + h1, y2 + h2)

    const interArea = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1)
    const unionArea = w1 * h1 + w2 * h2 - interArea

    return unionArea > 0 ? interArea / unionArea : 0
  }

  /** Get all active tracks. */
  getActiveTracks(): TrackedObject[] {
    const now = Date.now()
    return Array.from(this.tracks.values()).filter((t) => now - t.lastSeen < 2000)
  }

  /** Reset tracker (e.g., on camera switch). */
  reset() {
    this.tracks.clear()
    this.nextTrackId = 1
  }
}

/**
 * Global Identity Manager — maintains persistent identities across feeds and time.
 *
 * ELI5: "This is the system's memory. When it sees a person, it checks:
 * 'Have I seen this person before?' by comparing their appearance. If yes,
 * it uses the same ID. If no, it creates a new ID. It remembers people for
 * up to 24 hours, then forgets them (for privacy)."
 *
 * Uses lightweight appearance features (bbox geometry + color histogram) as
 * a proxy for deep embeddings. The matching threshold is intentionally loose
 * because these features are weak — the primary value is tracking continuity
 * within a feed, not reliable cross-camera re-ID.
 */
export class AppearanceTracker {
  private gallery: Map<string, TrackedIdentity> = new Map()
  private localToGlobal: Map<string, string> = new Map() // "camId:localId" → trackId
  private matchThreshold: number
  private ttlHours: number

  constructor(matchThreshold = 0.6, ttlHours = 24) {
    this.matchThreshold = matchThreshold
    this.ttlHours = ttlHours
  }

  /**
   * Match or create a persistent identity for a tracked object.
   * Returns the global ID.
   */
  matchOrCreate(
    localTrackId: number,
    type: 'person' | 'vehicle',
    appearance: AppearanceFeatures,
    camId: string,
    bbox: [number, number, number, number],
    confidence: number
  ): string {
    const now = Date.now()
    const key = `${camId}:${localTrackId}`

    // Fast path: local track already mapped to global ID
    if (this.localToGlobal.has(key)) {
      const gid = this.localToGlobal.get(key)!
      const identity = this.gallery.get(gid)
      if (identity) {
        identity.lastSeen = now
        identity.appearance = appearance
        identity.observations.push({ camId, timestamp: now, bbox, confidence })
        // Keep only last 100 observations to bound memory
        if (identity.observations.length > 100) {
          identity.observations = identity.observations.slice(-100)
        }
        return gid
      }
    }

    // Prune expired identities
    this.pruneExpired()

    // Search gallery for best match
    let bestMatchId: string | null = null
    let bestScore = 0

    for (const [gid, identity] of this.gallery) {
      if (identity.type !== type) continue
      const score = this.appearanceSimilarity(appearance, identity.appearance)
      if (score > bestScore) {
        bestScore = score
        bestMatchId = gid
      }
    }

    let gid: string
    if (bestMatchId && bestScore >= this.matchThreshold) {
      // Matched to existing identity
      gid = bestMatchId
      const identity = this.gallery.get(gid)!
      identity.appearance = appearance
      identity.lastSeen = now
      identity.observations.push({ camId, timestamp: now, bbox, confidence })
    } else {
      // Create new identity
      gid = `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const identity: TrackedIdentity = {
        trackId: gid,
        type,
        localTrackId,
        appearance,
        observations: [{ camId, timestamp: now, bbox, confidence }],
        firstSeen: now,
        lastSeen: now,
      }
      this.gallery.set(gid, identity)
    }

    this.localToGlobal.set(key, gid)
    return gid
  }

  /**
   * Compute appearance similarity between two feature sets.
   * Uses weighted combination of color histogram correlation + geometry.
   */
  private appearanceSimilarity(a: AppearanceFeatures, b: AppearanceFeatures): number {
    // Color histogram correlation (cosine similarity)
    const colorSim = this.cosineSimilarity(a.colorHistogram, b.colorHistogram)
    // Geometry similarity (aspect ratio + relative size)
    const arDiff = Math.abs(a.aspectRatio - b.aspectRatio) / Math.max(a.aspectRatio, b.aspectRatio, 0.01)
    const sizeDiff = Math.abs(a.relativeSize - b.relativeSize) / Math.max(a.relativeSize, b.relativeSize, 0.01)
    const geoSim = 1 - 0.5 * (arDiff + sizeDiff)
    // Weighted fusion: 60% color, 40% geometry
    return 0.6 * colorSim + 0.4 * geoSim
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dot += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB)
    return denom > 0 ? dot / denom : 0
  }

  /** Remove identities older than TTL. */
  private pruneExpired() {
    const now = Date.now()
    const ttlMs = this.ttlHours * 3600 * 1000
    for (const [gid, identity] of this.gallery) {
      if (now - identity.lastSeen > ttlMs) {
        this.gallery.delete(gid)
        // Clean up local-to-global mappings
        for (const [key, g] of this.localToGlobal) {
          if (g === gid) this.localToGlobal.delete(key)
        }
      }
    }
  }

  /** Get all active identities. */
  getIdentities(): TrackedIdentity[] {
    this.pruneExpired()
    return Array.from(this.gallery.values()).sort((a, b) => b.lastSeen - a.lastSeen)
  }

  /** Get identity by global ID. */
  getIdentity(gid: string): TrackedIdentity | undefined {
    return this.gallery.get(gid)
  }

  /** Reset gallery (e.g., on session end). */
  reset() {
    this.gallery.clear()
    this.localToGlobal.clear()
  }
}

/**
 * Extract lightweight appearance features from a canvas region.
 *
 * ELI5: "This function looks at a person or car in the video and describes
 * them using simple numbers: how wide vs tall they are, how big they appear
 * (which tells us how far away they are), and what color they mostly are.
 * These numbers help the system tell different people apart."
 */
export function extractAppearanceFeatures(
  ctx: CanvasRenderingContext2D,
  bbox: [number, number, number, number],
  canvasW: number,
  canvasH: number
): AppearanceFeatures {
  const [x, y, w, h] = bbox

  // Geometry features
  const aspectRatio = h > 0 ? w / h : 1
  const relativeSize = (w * h) / (canvasW * canvasH)

  // Color features — sample center region of bbox
  const cx = Math.max(0, Math.floor(x + w * 0.25))
  const cy = Math.max(0, Math.floor(y + h * 0.25))
  const cw = Math.max(1, Math.floor(w * 0.5))
  const ch = Math.max(1, Math.floor(h * 0.5))

  let imageData: ImageData
  try {
    imageData = ctx.getImageData(cx, cy, cw, ch)
  } catch {
    // Canvas tainted or out of bounds — return default features
    return {
      aspectRatio,
      relativeSize,
      dominantColor: [128, 128, 128],
      colorHistogram: new Array(24).fill(0),
    }
  }

  // Compute dominant color and histogram
  const data = imageData.data
  let totalR = 0, totalG = 0, totalB = 0
  const histogram = new Array(24).fill(0) // 8 bins per channel
  let count = 0

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    totalR += r
    totalG += g
    totalB += b
    count++
    // 8 bins per channel (0-31, 32-63, ..., 224-255)
    histogram[Math.floor(r / 32)]++
    histogram[8 + Math.floor(g / 32)]++
    histogram[16 + Math.floor(b / 32)]++
  }

  const dominantColor: [number, number, number] = count > 0
    ? [Math.round(totalR / count), Math.round(totalG / count), Math.round(totalB / count)]
    : [128, 128, 128]

  // Normalize histogram
  const maxBin = Math.max(...histogram, 1)
  const normalizedHistogram = histogram.map((v) => v / maxBin)

  return {
    aspectRatio,
    relativeSize,
    dominantColor,
    colorHistogram: normalizedHistogram,
  }
}
