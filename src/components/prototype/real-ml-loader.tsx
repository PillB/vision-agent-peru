'use client'

import { useEffect, useRef } from 'react'
import type { Detection } from '@/lib/store'
import { loadYolosDetector, YOLOS_TINY } from '@/lib/yolos-detector'

export interface RealMlHandle {
  detect: () => Promise<{ dets: Detection[]; latency: number } | null>
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  isStatic?: boolean
  onModelStatus: (status: 'loading' | 'ready' | 'error', error?: string | null) => void
  onModelReady: (handle: RealMlHandle | null) => void
}

/**
 * Pinned browser detector for the restored live prototype.
 *
 * The previous implementation always downloaded COCO-SSD's mutable remote
 * graph and exposed the model and TF runtime on `window`. The restored path
 * now shares the same immutable YOLOS-tiny adapter as the Evidence Workspace,
 * runs on WASM, and exposes no production test/debug globals.
 */
export function RealMlLoader({ videoRef, imgRef, canvasRef, isStatic, onModelStatus, onModelReady }: Props) {
  const modelRef = useRef<Awaited<ReturnType<typeof loadYolosDetector>> | null>(null)
  const isStaticRef = useRef(isStatic)

  useEffect(() => {
    isStaticRef.current = isStatic
  }, [isStatic])

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        onModelStatus('loading')
        const model = await loadYolosDetector()
        if (!mounted) return
        modelRef.current = model
        onModelStatus('ready')
        onModelReady({
          detect: async () => {
            const canvas = canvasRef.current
            const model = modelRef.current
            if (!canvas || !model) return null

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

            const targetWidth = 320
            const targetHeight = Math.max(1, Math.round((sourceHeight / sourceWidth) * targetWidth))
            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
              canvas.width = targetWidth
              canvas.height = targetHeight
            }
            const context = canvas.getContext('2d', { willReadFrequently: true })
            if (!context) return null
            context.drawImage(source, 0, 0, canvas.width, canvas.height)

            const startedAt = performance.now()
            const { RawImage } = await import('@huggingface/transformers')
            const results = await model(RawImage.fromCanvas(canvas), { threshold: 0.4, percentage: false })
            const latency = performance.now() - startedAt
            const dets: Detection[] = results.slice(0, 20).map(({ label, score, box }) => ({
              class: label,
              score,
              bbox: [box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin],
            }))
            return { dets, latency }
          },
        })
      } catch (error) {
        if (!mounted) return
        onModelReady(null)
        onModelStatus('error', `${YOLOS_TINY.id}@${YOLOS_TINY.revision}: ${error instanceof Error ? error.message : 'model load failed'}`)
      }
    }

    void load()
    return () => {
      mounted = false
      modelRef.current = null
      onModelReady(null)
    }
  }, [canvasRef, imgRef, onModelReady, onModelStatus, videoRef])

  return null
}
