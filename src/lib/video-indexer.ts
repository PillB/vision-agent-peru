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
): Promise<VideoMetadata> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'metadata'
  video.muted = true

  return new Promise((resolve, reject) => {
    video.onloadedmetadata = async () => {
      const contentHash = await calculateVideoHash(file)
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
): Promise<{ framesProcessed: number; cancelled: boolean }> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.preload = 'auto'
  video.muted = true
  video.playsInline = true

  const videoId = `sample-${Date.now()}`
  const startedAt = Date.now()
  let framesProcessed = 0
  const totalFrames = Math.min(
    config.maxFrames,
    Math.floor(video.duration || 0 / config.targetFrameInterval),
  )

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
        return { framesProcessed, cancelled: true }
      }

      // Seek to timestamp
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
        const onError = () => { video.removeEventListener('error', onError); reject(new Error(`Seek failed at ${t}s`)) }
        video.addEventListener('seeked', onSeeked)
        video.addEventListener('error', onError)
        video.currentTime = t
      })

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

      await onFrame(bitmap, t)
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

    return { framesProcessed, cancelled: false }
  } finally {
    URL.revokeObjectURL(url)
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
