/**
 * Subject Re-identification + Co-occurrence Network
 *
 * Implements Flock-style subject tracking with:
 *   - Unique track IDs that persist across re-appearances
 *   - Reappearance count (how many times subject left and returned)
 *   - Total observed duration
 *   - Co-occurrence network (which subjects shared the screen)
 *   - Familiarity score (Jaccard-normalized shared screen time)
 *
 * Privacy boundary: These are TRACK IDs, not identity. Appearance
 * similarity does not establish identity (section 2, Solarize).
 */

export interface SubjectTrack {
  trackId: string
  firstSeen: number
  lastSeen: number
  totalDurationMs: number
  reappearanceCount: number
  detectionCount: number
  lastClass: string
  // Appearance features for matching
  appearanceSignature?: string
  // Co-occurrence data
  coOccurrences: Map<string, number> // otherTrackId → shared frame count
}

export interface CoOccurrenceEdge {
  source: string
  target: string
  sharedFrames: number
  sharedDurationMs: number
  familiarityScore: number  // 0..1, Jaccard-normalized
  proximityScore: number    // 0..1, average pixel distance when co-occurring
}

export interface CoOccurrenceNetwork {
  nodes: SubjectTrack[]
  edges: CoOccurrenceEdge[]
  totalFrames: number
  totalSubjects: number
}

/**
 * SubjectReidentifier tracks subjects across frames, maintaining:
 *   - Persistent track IDs
 *   - Reappearance counts (subject left frame and came back)
 *   - Total observed duration
 *   - Co-occurrence relationships (who shared the screen with whom)
 *
 * Algorithm:
 *   1. Each new detection gets a trackId via IoU matching with recent tracks
 *   2. If a track disappears for >disappearanceThresholdMs and then reappears,
 *      reappearanceCount is incremented (same trackId, new appearance session)
 *   3. Co-occurrence is tracked per-frame: if two tracks are active in the
 *      same frame, their co-occurrence count increases
 *   4. Familiarity score = Jaccard(co-occurrence frames / total frames of
 *      either subject)
 */
export class SubjectReidentifier {
  private tracks: Map<string, SubjectTrack> = new Map()
  private activeTracks: Set<string> = new Set()
  private lastFrameTracks: Set<string> = new Set()
  private frameCount = 0
  private nextTrackId = 1
  private disappearanceThresholdMs: number
  private lastFrameTimestamp: number | null = null
  private edgeStats: Map<string, { sharedFrames: number; sharedDurationMs: number; proximitySum: number }> = new Map()
  private lastBboxes: Map<string, [number, number, number, number]> = new Map()

  constructor(disappearanceThresholdMs = 3000) {
    this.disappearanceThresholdMs = disappearanceThresholdMs
  }

  /**
   * Process a new frame of detections.
   * Returns the updated list of active tracks with their annotations.
   */
  processFrame(
    detections: Array<{ bbox: [number, number, number, number]; class: string; score: number }>,
    canvasW: number,
    canvasH: number,
    timestamp: number = Date.now(),
  ): SubjectTrack[] {
    this.frameCount++
    const frameDurationMs = this.lastFrameTimestamp === null
      ? 0
      : Math.max(0, Math.min(1000, timestamp - this.lastFrameTimestamp))
    this.lastFrameTimestamp = timestamp

    // Match detections to existing tracks via IoU
    const matchedIds = new Set<string>()
    const currentActiveTracks = new Map<string, { bbox: [number, number, number, number]; class: string }>()

    for (const det of detections) {
      // Try to match with an active track
      let bestMatch: string | null = null
      let bestIoU = 0.3 // minimum IoU threshold

      for (const [trackId, track] of this.tracks) {
        if (matchedIds.has(trackId)) continue
        if (!this.activeTracks.has(trackId)) {
          // Check if this track reappeared after disappearing
          if (timestamp - track.lastSeen > this.disappearanceThresholdMs) {
            // Track reappeared — but we need appearance matching to confirm
            // For now, use IoU with last known position (simplified)
          } else {
            continue
          }
        }

        // Simple IoU matching using last known position
        // In a full system, this would use OSNet embeddings
        const iou = this.computeIoU(det.bbox, this.getLastBbox(trackId, canvasW, canvasH))
        if (iou > bestIoU) {
          bestIoU = iou
          bestMatch = trackId
        }
      }

      if (bestMatch) {
        // Update existing track
        const track = this.tracks.get(bestMatch)!
        const elapsedSinceSeen = timestamp - track.lastSeen
        if (elapsedSinceSeen > this.disappearanceThresholdMs) {
          track.reappearanceCount++
        } else {
          track.totalDurationMs += Math.max(0, elapsedSinceSeen)
        }
        track.lastSeen = timestamp
        track.detectionCount++
        track.lastClass = det.class
        matchedIds.add(bestMatch)
        currentActiveTracks.set(bestMatch, { bbox: det.bbox, class: det.class })
        this.lastBboxes.set(bestMatch, det.bbox)
        this.activeTracks.add(bestMatch)
      } else {
        // Create new track
        const trackId = `T${this.nextTrackId++}`
        const track: SubjectTrack = {
          trackId,
          firstSeen: timestamp,
          lastSeen: timestamp,
          totalDurationMs: 0,
          reappearanceCount: 0,
          detectionCount: 1,
          lastClass: det.class,
          coOccurrences: new Map(),
        }
        this.tracks.set(trackId, track)
        matchedIds.add(trackId)
        currentActiveTracks.set(trackId, { bbox: det.bbox, class: det.class })
        this.lastBboxes.set(trackId, det.bbox)
        this.activeTracks.add(trackId)
      }
    }

    // Mark tracks that disappeared
    for (const trackId of this.activeTracks) {
      if (!matchedIds.has(trackId)) {
        this.activeTracks.delete(trackId)
      }
    }

    // Update co-occurrence: for each pair of active tracks in this frame,
    // increment their co-occurrence count
    const activeIds = Array.from(currentActiveTracks.keys())
    for (let i = 0; i < activeIds.length; i++) {
      for (let j = i + 1; j < activeIds.length; j++) {
        const idA = activeIds[i]
        const idB = activeIds[j]
        const trackA = this.tracks.get(idA)!
        const trackB = this.tracks.get(idB)!

        trackA.coOccurrences.set(idB, (trackA.coOccurrences.get(idB) || 0) + 1)
        trackB.coOccurrences.set(idA, (trackB.coOccurrences.get(idA) || 0) + 1)
        const edgeKey = [idA, idB].sort().join('-')
        const boxA = currentActiveTracks.get(idA)!.bbox
        const boxB = currentActiveTracks.get(idB)!.bbox
        const centerA = [boxA[0] + boxA[2] / 2, boxA[1] + boxA[3] / 2]
        const centerB = [boxB[0] + boxB[2] / 2, boxB[1] + boxB[3] / 2]
        const normalizedDistance = Math.hypot(centerA[0] - centerB[0], centerA[1] - centerB[1]) / Math.max(1, Math.hypot(canvasW, canvasH))
        const proximity = Math.max(0, 1 - normalizedDistance)
        const stats = this.edgeStats.get(edgeKey) ?? { sharedFrames: 0, sharedDurationMs: 0, proximitySum: 0 }
        stats.sharedFrames += 1
        stats.sharedDurationMs += frameDurationMs
        stats.proximitySum += proximity
        this.edgeStats.set(edgeKey, stats)
      }
    }

    this.lastFrameTracks = new Set(currentActiveTracks.keys())

    // Return active tracks with annotations
    return Array.from(currentActiveTracks.entries()).map(([trackId, info]) => {
      const track = this.tracks.get(trackId)!
      return {
        ...track,
        lastClass: info.class,
      }
    })
  }

  /**
   * Build the co-occurrence network from all tracked subjects.
   */
  getCoOccurrenceNetwork(): CoOccurrenceNetwork {
    const edges: CoOccurrenceEdge[] = []
    const processed = new Set<string>()

    for (const [trackId, track] of this.tracks) {
      for (const [otherId, sharedFrames] of track.coOccurrences) {
        const edgeKey = [trackId, otherId].sort().join('-')
        if (processed.has(edgeKey)) continue
        processed.add(edgeKey)

        const other = this.tracks.get(otherId)
        if (!other) continue

        // Composite relationship weight: normalized co-occurrence, average
        // spatial proximity, and repeated encounters. No component establishes identity.
        const totalA = track.detectionCount
        const totalB = other.detectionCount
        const jaccard = totalA + totalB - sharedFrames > 0
          ? sharedFrames / (totalA + totalB - sharedFrames)
          : 0
        const stats = this.edgeStats.get(edgeKey)
        const proximity = stats?.sharedFrames ? stats.proximitySum / stats.sharedFrames : 0
        const recurrence = Math.min(1, (track.reappearanceCount + other.reappearanceCount) / 4)
        const familiarity = 0.55 * jaccard + 0.3 * proximity + 0.15 * recurrence

        edges.push({
          source: trackId,
          target: otherId,
          sharedFrames,
          sharedDurationMs: stats?.sharedDurationMs ?? 0,
          familiarityScore: Math.min(1, familiarity),
          proximityScore: proximity,
        })
      }
    }

    // Sort edges by familiarity (strongest relationships first)
    edges.sort((a, b) => b.familiarityScore - a.familiarityScore)

    return {
      nodes: Array.from(this.tracks.values()),
      edges,
      totalFrames: this.frameCount,
      totalSubjects: this.tracks.size,
    }
  }

  /**
   * Get annotation data for a specific track (for UI display).
   */
  getAnnotation(trackId: string): {
    trackId: string
    reappearanceCount: number
    totalDurationMs: number
    detectionCount: number
    firstSeen: number
    lastSeen: number
    coSubjects: number
  } | null {
    const track = this.tracks.get(trackId)
    if (!track) return null
    return {
      trackId: track.trackId,
      reappearanceCount: track.reappearanceCount,
      totalDurationMs: track.totalDurationMs,
      detectionCount: track.detectionCount,
      firstSeen: track.firstSeen,
      lastSeen: track.lastSeen,
      coSubjects: track.coOccurrences.size,
    }
  }

  /**
   * Get all track annotations for display.
   */
  getAllAnnotations(): Array<ReturnType<SubjectReidentifier['getAnnotation']>> {
    return Array.from(this.tracks.keys()).map(id => this.getAnnotation(id)).filter(Boolean)
  }

  reset(): void {
    this.tracks.clear()
    this.activeTracks.clear()
    this.lastFrameTracks.clear()
    this.frameCount = 0
    this.nextTrackId = 1
    this.lastFrameTimestamp = null
    this.edgeStats.clear()
    this.lastBboxes.clear()
  }

  private getLastBbox(trackId: string, canvasW: number, canvasH: number): [number, number, number, number] {
    return this.lastBboxes.get(trackId) ?? [0, 0, canvasW, canvasH]
  }

  private computeIoU(
    boxA: [number, number, number, number],
    boxB: [number, number, number, number],
  ): number {
    const [ax, ay, aw, ah] = boxA
    const [bx, by, bw, bh] = boxB

    const x1 = Math.max(ax, bx)
    const y1 = Math.max(ay, by)
    const x2 = Math.min(ax + aw, bx + bw)
    const y2 = Math.min(ay + ah, by + bh)

    const interW = Math.max(0, x2 - x1)
    const interH = Math.max(0, y2 - y1)
    const interArea = interW * interH

    const unionArea = aw * ah + bw * bh - interArea
    return unionArea > 0 ? interArea / unionArea : 0
  }
}
