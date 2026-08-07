export interface TrackDetection {
  bbox: [number, number, number, number]
  class: string
  score: number
}

export interface LocalTrack extends TrackDetection {
  localTrackId: string
  firstFrame: number
  lastFrame: number
  observations: number
  entryBbox: TrackDetection['bbox']
  exitBbox: TrackDetection['bbox']
}

function iou(left: TrackDetection['bbox'], right: TrackDetection['bbox']): number {
  const x1 = Math.max(left[0], right[0])
  const y1 = Math.max(left[1], right[1])
  const x2 = Math.min(left[0] + left[2], right[0] + right[2])
  const y2 = Math.min(left[1] + left[3], right[1] + right[3])
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const union = left[2] * left[3] + right[2] * right[3] - intersection
  return union <= 0 ? 0 : intersection / union
}

/**
 * Browser-feasible ByteTrack-compatible association. It implements the
 * defining two-stage behavior: high-confidence detections create/match
 * tracks first, then lower-confidence detections may recover unmatched
 * tracks but can never create a new track. It deliberately does not claim
 * full ByteTrack parity (no Kalman filter or global assignment).
 */
export class ByteTrackCompatibleTracker {
  private tracks = new Map<string, LocalTrack>()
  private nextId = 1

  constructor(
    private readonly highThreshold = 0.5,
    private readonly lowThreshold = 0.1,
    private readonly matchThreshold = 0.3,
    private readonly maxLostFrames = 30,
  ) {}

  update(detections: TrackDetection[], frame: number): LocalTrack[] {
    const high = detections.filter(item => item.score >= this.highThreshold)
    const low = detections.filter(item => item.score >= this.lowThreshold && item.score < this.highThreshold)
    const unmatchedTracks = new Set(this.tracks.keys())
    const matchedDetections = new Set<TrackDetection>()

    const matchStage = (candidates: TrackDetection[], mayCreate: boolean) => {
      for (const detection of candidates) {
        let bestId: string | null = null
        let bestIou = this.matchThreshold
        for (const id of unmatchedTracks) {
          const track = this.tracks.get(id)!
          if (track.class !== detection.class) continue
          const overlap = iou(track.bbox, detection.bbox)
          if (overlap >= bestIou) {
            bestIou = overlap
            bestId = id
          }
        }
        if (bestId) {
          const previous = this.tracks.get(bestId)!
          this.tracks.set(bestId, {
            ...previous,
            ...detection,
            lastFrame: frame,
            observations: previous.observations + 1,
            exitBbox: detection.bbox,
          })
          unmatchedTracks.delete(bestId)
          matchedDetections.add(detection)
        } else if (mayCreate) {
          const id = `track-${this.nextId++}`
          this.tracks.set(id, {
            ...detection,
            localTrackId: id,
            firstFrame: frame,
            lastFrame: frame,
            observations: 1,
            entryBbox: detection.bbox,
            exitBbox: detection.bbox,
          })
          matchedDetections.add(detection)
        }
      }
    }

    matchStage(high, true)
    matchStage(low, false)

    for (const [id, track] of this.tracks) {
      if (frame - track.lastFrame > this.maxLostFrames) this.tracks.delete(id)
    }
    return [...this.tracks.values()].filter(track => track.lastFrame === frame)
  }

  reset(): void {
    this.tracks.clear()
    this.nextId = 1
  }

  getAllTracks(): LocalTrack[] {
    return [...this.tracks.values()]
  }
}
