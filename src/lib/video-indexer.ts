/**
 * Adaptive Video Indexing Pipeline — Round 3
 *
 * Implements the local-first evidence search pipeline:
 *   upload → capability check → adaptive sampling → detection → tracking →
 *   crops → embeddings → IndexedDB → NL/reference search →
 *   ranked candidates → near misses → timeline review →
 *   candidate association → human confirmation → evidence export
 *
 * This module handles steps 1-12 of section 12 (Adaptive video indexing):
 *   1. calculate content hash
 *   2. validate format and size
 *   3. inspect duration and dimensions
 *   4. estimate processing cost
 *   5. obtain user approval
 *   6. decode incrementally
 *   7. sample frames
 *   8. detect relevant objects
 *   9. form local tracks
 *  10. choose representative track crops
 *  11. generate embeddings and attributes
 *  12. store blobs and vectors in IndexedDB
 *
 * No server needed. All persistence via IndexedDB. All inference via
 * transformers.js / TF.js in the browser.
 */

import { addEvidence, type EvidenceRecord } from './evidence'
import { idbPut } from './idb'
import { ByteTrackCompatibleTracker, type TrackDetection } from './byte-track'

export interface VideoMetadata {
  videoId: string
  fileName: string
  fileSize: number
  contentHash: string        // SHA-256 of file bytes
  durationSeconds: number
  width: number
  height: number
  fps: number
  cameraName?: string        // user-provided label
  location?: string
  recordedAt?: number        // epoch ms — user-provided recording start
  timezone?: string          // IANA tz, e.g. 'America/Lima'
  uploadedAt: number
}

export interface SamplingConfig {
  strategy: 'fixed' | 'motion-adaptive' | 'scene-change' | 'keyframe'
  targetFrameInterval: number   // seconds between sampled frames
  maxFrames: number             // hard cap to bound processing time
  minScore: number              // detection threshold
}

export const DEFAULT_SAMPLING: SamplingConfig = {
  strategy: 'fixed',
  targetFrameInterval: 2.0,  // sample every 2s — 30 FPS video → 1 frame per 60
  maxFrames: 500,
  minScore: 0.4,
}

export interface IndexingProgress {
  videoId: string
  phase: 'hashing' | 'metadata' | 'sampling' | 'detecting' | 'embedding' | 'storing' | 'done' | 'error' | 'cancelled'
  framesProcessed: number
  framesTotal: number
  detectionsFound: number
  evidenceStored: number
  currentTimestamp: number    // seconds into video
  startedAt: number
  elapsedMs: number
  estimatedRemainingMs: number
  error?: string
}

export type ProgressCallback = (progress: IndexingProgress) => void

export interface SkippedInterval {
  startSeconds: number
  endSeconds: number
  reason: 'adaptive-low-motion' | 'sampling-gap'
}

export interface FailedInterval {
  startSeconds: number
  endSeconds: number
  reason: string
}

/**
 * Calculate SHA-256 content hash of a video file.
 * Used for deduplication (don't re-index the same file) and provenance.
 */
export async function calculateVideoHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Extract video metadata by loading it into a temporary <video> element.
 */
export async function extractVideoMetadata(
  file: File,
  cameraName?: string,
  location?: string,
  recordedAt?: number,
  timezone?: string,
  calculateHashNow = true,
): Promise<VideoMetadata> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true

  return new Promise((resolve, reject) => {
    video.onloadedmetadata = async () => {
      const contentHash = calculateHashNow ? await calculateVideoHash(file) : 'pending-user-approval'
      const meta: VideoMetadata = {
        videoId: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: file.name,
        fileSize: file.size,
        contentHash,
        durationSeconds: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30,  // browsers don't expose fps reliably; assume 30
        cameraName,
        location,
        recordedAt,
        timezone,
        uploadedAt: Date.now(),
      }
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load video metadata for ${file.name}`))
    }
    video.src = url
  })
}

/**
 * Estimate processing cost for a video.
 * Returns approximate time in seconds and memory in MB.
 */
export function estimateProcessingCost(meta: VideoMetadata, config: SamplingConfig = DEFAULT_SAMPLING): {
  estimatedFrames: number
  estimatedTimeSeconds: number
  estimatedMemoryMB: number
} {
  const estimatedFrames = Math.min(
    config.maxFrames,
    Math.floor(meta.durationSeconds / config.targetFrameInterval),
  )
  // Rough estimates based on COCO-SSD @ ~3 fps on WASM + CLIP @ ~1 fps
  const detectionTimePerFrame = 0.3
  const embeddingTimePerFrame = 1.0
  const estimatedTimeSeconds = estimatedFrames * (detectionTimePerFrame + embeddingTimePerFrame)
  // Each frame at 320x180 = ~170KB JPEG; CLIP embedding = 512 floats = 2KB
  const estimatedMemoryMB = (estimatedFrames * 0.17) + (estimatedFrames * 0.002)
  return { estimatedFrames, estimatedTimeSeconds, estimatedMemoryMB }
}

/**
 * Decode and sample frames from a video at the configured interval.
 * Calls onFrame for each sampled frame with the ImageBitmap + timestamp.
 *
 * Supports cancellation via AbortSignal.
 */
export async function sampleVideoFrames(
  file: File,
  config: SamplingConfig,
  onFrame: (frame: ImageBitmap, timestampSeconds: number) => Promise<void>,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<{
  framesProcessed: number
  cancelled: boolean
  skippedIntervals: SkippedInterval[]
  failedIntervals: FailedInterval[]
}> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  const videoId = `sample-${Date.now()}`
  const startedAt = Date.now()
  let framesProcessed = 0
  const skippedIntervals: SkippedInterval[] = []
  const failedIntervals: FailedInterval[] = []
  let previousThumbnail: Uint8ClampedArray | null = null

  try {
    // Wait for metadata
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video metadata'))
      video.src = url
    })

    // Seek to each sample point
    const duration = video.duration
    const samplePoints: number[] = []
    for (let t = 0; t < duration && samplePoints.length < config.maxFrames; t += config.targetFrameInterval) {
      samplePoints.push(t)
    }

    onProgress({
      videoId, phase: 'sampling', framesProcessed: 0, framesTotal: samplePoints.length,
      detectionsFound: 0, evidenceStored: 0, currentTimestamp: 0,
      startedAt, elapsedMs: 0, estimatedRemainingMs: 0,
    })

    for (const t of samplePoints) {
      if (signal?.aborted) {
        return { framesProcessed, cancelled: true, skippedIntervals, failedIntervals }
      }

      // Seek to timestamp
      try {
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
          const onError = () => { video.removeEventListener('error', onError); reject(new Error(`Seek failed at ${t}s`)) }
          video.addEventListener('seeked', onSeeked)
          video.addEventListener('error', onError)
          video.currentTime = t
        })
      } catch (error) {
        failedIntervals.push({
          startSeconds: t,
          endSeconds: Math.min(duration, t + config.targetFrameInterval),
          reason: error instanceof Error ? error.message : 'Decode seek failed',
        })
        continue
      }

      // Capture frame as ImageBitmap (more efficient than canvas for large videos)
      let bitmap: ImageBitmap
      try {
        bitmap = await createImageBitmap(video)
      } catch {
        // Fallback: use canvas
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.drawImage(video, 0, 0)
        bitmap = await createImageBitmap(canvas)
      }

      if (config.strategy === 'motion-adaptive' || config.strategy === 'scene-change') {
        const thumbnailCanvas = document.createElement('canvas')
        thumbnailCanvas.width = 32
        thumbnailCanvas.height = 18
        const thumbnailContext = thumbnailCanvas.getContext('2d', { willReadFrequently: true })
        if (thumbnailContext) {
          thumbnailContext.drawImage(bitmap, 0, 0, 32, 18)
          const current = thumbnailContext.getImageData(0, 0, 32, 18).data
          if (previousThumbnail) {
            let difference = 0
            for (let index = 0; index < current.length; index += 4) {
              difference += (
                Math.abs(current[index] - previousThumbnail[index])
                + Math.abs(current[index + 1] - previousThumbnail[index + 1])
                + Math.abs(current[index + 2] - previousThumbnail[index + 2])
              ) / (3 * 255)
            }
            const score = difference / (current.length / 4)
            const threshold = config.strategy === 'scene-change' ? 0.12 : 0.025
            if (score < threshold) {
              skippedIntervals.push({
                startSeconds: t,
                endSeconds: Math.min(duration, t + config.targetFrameInterval),
                reason: 'adaptive-low-motion',
              })
              previousThumbnail = new Uint8ClampedArray(current)
              bitmap.close()
              continue
            }
          }
          previousThumbnail = new Uint8ClampedArray(current)
        }
      }

      await onFrame(bitmap, t)
      bitmap.close()
      framesProcessed++

      const elapsedMs = Date.now() - startedAt
      const msPerFrame = elapsedMs / framesProcessed
      const estimatedRemainingMs = msPerFrame * (samplePoints.length - framesProcessed)

      onProgress({
        videoId, phase: 'detecting', framesProcessed, framesTotal: samplePoints.length,
        detectionsFound: 0, evidenceStored: 0, currentTimestamp: t,
        startedAt, elapsedMs, estimatedRemainingMs,
      })
    }

    onProgress({
      videoId, phase: 'done', framesProcessed, framesTotal: samplePoints.length,
      detectionsFound: 0, evidenceStored: 0, currentTimestamp: duration,
      startedAt, elapsedMs: Date.now() - startedAt, estimatedRemainingMs: 0,
    })

    return { framesProcessed, cancelled: false, skippedIntervals, failedIntervals }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export interface DetectionAdapter {
  id: string
  revision: string
  detect: (canvas: HTMLCanvasElement) => Promise<TrackDetection[]>
}

export interface EmbeddingAdapter {
  id: string
  revision: string
  embed: (crop: HTMLCanvasElement) => Promise<Float32Array>
}

export interface VideoIndexSummary {
  metadata: VideoMetadata
  framesProcessed: number
  detectionsFound: number
  evidenceStored: number
  skippedIntervals: SkippedInterval[]
  failedIntervals: FailedInterval[]
  cancelled: boolean
  analyzedDurationSeconds: number
}

/** Execute the real local indexing path with injected, testable adapters. */
export async function indexVideoWithAdapters(
  file: File,
  metadata: VideoMetadata,
  config: SamplingConfig,
  detector: DetectionAdapter,
  embedder: EmbeddingAdapter | undefined,
  onProgress: ProgressCallback,
  signal?: AbortSignal,
): Promise<VideoIndexSummary> {
  const tracker = new ByteTrackCompatibleTracker()
  const cropsPerTrack = new Map<string, number>()
  const lastCropByTrack = new Map<string, EvidenceRecord>()
  let detectionsFound = 0
  let evidenceStored = 0
  let frameNumber = 0

  await idbPut('videos', { id: metadata.videoId, createdAt: metadata.uploadedAt, ...metadata })
  const sampled = await sampleVideoFrames(file, config, async (frame, timestampSeconds) => {
    if (signal?.aborted) return
    frameNumber++
    const canvas = document.createElement('canvas')
    canvas.width = frame.width
    canvas.height = frame.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas 2D context unavailable')
    context.drawImage(frame, 0, 0)
    const detections = (await detector.detect(canvas)).filter(item => item.score >= config.minScore)
    detectionsFound += detections.length
    const tracks = tracker.update(detections, frameNumber)

    for (const track of tracks) {
      const existingCrops = cropsPerTrack.get(track.localTrackId) ?? 0
      if (existingCrops >= 3) continue
      const [x, y, width, height] = track.bbox
      if (width <= 1 || height <= 1) continue
      const crop = document.createElement('canvas')
      crop.width = Math.max(1, Math.round(width))
      crop.height = Math.max(1, Math.round(height))
      crop.getContext('2d')?.drawImage(canvas, x, y, width, height, 0, 0, crop.width, crop.height)
      const embedding = embedder ? await embedder.embed(crop) : undefined
      const now = Date.now()
      const record: EvidenceRecord = {
        id: `ev-${metadata.videoId}-${frameNumber}-${track.localTrackId}`,
        createdAt: now,
        videoId: metadata.videoId,
        cameraId: metadata.cameraName ?? metadata.videoId,
        useCaseId: 'uploaded-video-evidence',
        timestamp: (metadata.recordedAt ?? metadata.uploadedAt) + timestampSeconds * 1000,
        sourceTimestampSeconds: timestampSeconds,
        snapshotDataUrl: crop.toDataURL('image/jpeg', 0.82),
        detection: { class: track.class, score: track.score, bbox: track.bbox },
        embedding,
        trackId: `${metadata.videoId}:${track.localTrackId}`,
        confirmed: false,
        contextPosition: existingCrops === 0 ? 'entry' : 'middle',
        trajectoryPoint: { x: x + width / 2, y: y + height / 2 },
        modelId: detector.id,
        modelRevision: detector.revision,
        quality: track.score >= 0.7 ? 'high' : track.score >= 0.5 ? 'medium' : 'low',
      }
      await addEvidence(record)
      lastCropByTrack.set(track.localTrackId, record)
      cropsPerTrack.set(track.localTrackId, existingCrops + 1)
      evidenceStored++
    }
  }, onProgress, signal)

  for (const track of tracker.getAllTracks()) {
    const exitCrop = lastCropByTrack.get(track.localTrackId)
    if (exitCrop && exitCrop.contextPosition !== 'entry') {
      await addEvidence({ ...exitCrop, contextPosition: 'exit' })
    }
    await idbPut('tracks', {
      id: `${metadata.videoId}:${track.localTrackId}`,
      createdAt: metadata.uploadedAt,
      videoId: metadata.videoId,
      cameraId: metadata.cameraName ?? metadata.videoId,
      class: track.class,
      firstFrame: track.firstFrame,
      lastFrame: track.lastFrame,
      observations: track.observations,
      entryBbox: track.entryBbox,
      exitBbox: track.exitBbox,
    })
  }

  const coveredSeconds = sampled.framesProcessed * config.targetFrameInterval
  return {
    metadata,
    framesProcessed: sampled.framesProcessed,
    detectionsFound,
    evidenceStored,
    skippedIntervals: sampled.skippedIntervals,
    failedIntervals: sampled.failedIntervals,
    cancelled: sampled.cancelled,
    analyzedDurationSeconds: Math.min(metadata.durationSeconds, coveredSeconds),
  }
}

/**
 * Persist a video metadata record to IndexedDB.
 */
export async function saveVideoMetadata(meta: VideoMetadata): Promise<void> {
  // Reuse the evidence store's IndexedDB connection
  const { idbPut } = await import('./idb')
  await idbPut('meta', { id: meta.videoId, kind: 'video', ...meta })
}

/**
 * List all indexed videos.
 */
export async function listIndexedVideos(): Promise<VideoMetadata[]> {
  const { idbGetAll } = await import('./idb')
  const all = await idbGetAll<VideoMetadata & { kind: string }>('meta')
  return all.filter(m => m.kind === 'video').map(({ kind, ...rest }) => rest as VideoMetadata)
}

/**
 * Delete a video and all its evidence records.
 */
export async function deleteVideoAndEvidence(videoId: string): Promise<void> {
  const { idbDelete, idbGetAll } = await import('./idb')
  // Delete all evidence records belonging to this video
  const evidence = await idbGetAll<EvidenceRecord>('evidence')
  for (const ev of evidence) {
    if (ev.cameraId === videoId) {
      await idbDelete('evidence', ev.id)
    }
  }
  // Delete the video metadata
  await idbDelete('meta', videoId)
}

/**
 * Validate a video file before indexing.
 * Returns null if valid, or an error message.
 */
export function validateVideoFile(file: File): string | null {
  const MAX_SIZE = 500 * 1024 * 1024  // 500 MB
  const ALLOWED_TYPES = [
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    'video/x-msvideo', 'video/x-matroska',
  ]
  if (file.size > MAX_SIZE) {
    return `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Maximum is 500 MB.`
  }
  // Some browsers don't set MIME types correctly — check extension too
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowedExts = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']
  if (!ALLOWED_TYPES.includes(file.type) && !allowedExts.includes(ext || '')) {
    return `Unsupported file type: ${file.type || ext}. Allowed: MP4, WebM, OGG, MOV, AVI, MKV.`
  }
  return null
}
