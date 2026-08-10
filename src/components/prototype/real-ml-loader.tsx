'use client'

import { useEffect, useRef } from 'react'
import type { Detection } from '@/lib/store'
import { loadObjectDetector, type ObjectDetectorId } from '@/lib/yolos-detector'

export type SelectableObjectDetectorId = ObjectDetectorId | 'coco-ssd'

export interface RealMlHandle {
  detect: (modelId?: SelectableObjectDetectorId) => Promise<{ dets: Detection[]; latency: number } | null>
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isStatic?: boolean
  onModelStatus: (status: 'loading' | 'ready' | 'error', error?: string | null) => void
  onModelReady: (handle: RealMlHandle | null) => void
}

// Cache dynamic imports at module level
let _rawImageCtor: typeof import('@huggingface/transformers').RawImage | null = null
async function getRawImage() {
  if (!_rawImageCtor) {
    const mod = await import('@huggingface/transformers')
    _rawImageCtor = mod.RawImage
  }
  return _rawImageCtor
}

const DETECTION_WIDTH = 256
let cocoModelPromise: Promise<Awaited<ReturnType<typeof import('@tensorflow-models/coco-ssd').load>>> | null = null

async function loadCocoSsd() {
  if (!cocoModelPromise) {
    cocoModelPromise = Promise.all([
      import('@tensorflow/tfjs'),
      import('@tensorflow-models/coco-ssd'),
    ])
      .then(async ([tf, { load }]) => {
        await tf.ready()
        return load({ base: 'lite_mobilenet_v2' })
      })
      .catch(error => {
        cocoModelPromise = null
        throw error
      })
  }
  return cocoModelPromise
}

/**
 * Pinned browser detector for the restored live prototype.
 *
 * FPS OPTIMIZATIONS (2026-08-09):
 *   - Module-level RawImage cache
 *   - Smaller canvas (256×144 vs 320×180, 36% fewer pixels)
 *   - desynchronized: true on canvas context
 *   - Lower threshold (0.35 vs 0.4, more recall)
 *
 * ARCHITECTURE NOTE:
 *   This loader runs inference on the MAIN THREAD (WASM blocks for 8-12s).
 *   A Web Worker version exists in detection-worker.ts but GitHub Pages
 *   static export doesn't support worker URLs reliably. The main-thread
 *   approach with adaptiveThrottle=1000ms and setTimeout(0) yield is the
 *   pragmatic compromise — the UI paints between detections.
 */
export function RealMlLoader({ videoRef, imgRef, canvasRef, isStatic, onModelStatus, onModelReady }: Props) {
  const isStaticRef = useRef(isStatic)

  useEffect(() => {
    isStaticRef.current = isStatic
  }, [isStatic])

  useEffect(() => {
    onModelStatus('ready')
    onModelReady({
          detect: async (modelId = 'yolos-tiny') => {
            const canvas = canvasRef.current
            if (!canvas) return null

            const video = videoRef.current
            const image = imgRef.current
            let source: CanvasImageSource
            let sourceWidth: number
            let sourceHeight: number

            if (isStaticRef.current) {
              if (!image?.complete || image.naturalWidth === 0) return null
              source = image
              sourceWidth = image.naturalWidth
              sourceHeight = image.naturalHeight
            } else {
              if (!video || video.readyState < 2 || video.videoWidth === 0) return null
              source = video
              sourceWidth = video.videoWidth
              sourceHeight = video.videoHeight
            }

            const targetWidth = DETECTION_WIDTH
            const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth))
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
              canvas.width = targetWidth
              canvas.height = targetHeight
            }
            const context = canvas.getContext('2d', {
              willReadFrequently: true,
              desynchronized: true,
            })
            if (!context) return null
            context.drawImage(source, 0, 0, canvas.width, canvas.height)

            const startedAt = performance.now()
            if (modelId === 'coco-ssd') {
              const model = await loadCocoSsd()
              const results = await model.detect(canvas, 20, 0.35)
              return {
                latency: performance.now() - startedAt,
                dets: results.map(result => ({
                  class: result.class,
                  score: result.score,
                  bbox: result.bbox as [number, number, number, number],
                })),
              }
            }

            const model = await loadObjectDetector(modelId)
            const RawImage = await getRawImage()
            const results = await model(RawImage.fromCanvas(canvas), {
              threshold: 0.35,
              percentage: false,
            })
            const latency = performance.now() - startedAt
            const dets: Detection[] = results.slice(0, 20).map(({ label, score, box }) => ({
              class: label,
              score,
              bbox: [box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin],
            }))
            return { dets, latency }
          },
    })
    return () => {
      onModelReady(null)
    }
  }, [])

  return null
}
