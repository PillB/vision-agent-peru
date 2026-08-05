'use client'

// This component is dynamically loaded ONLY when the user switches to Real ML mode.
// It statically imports TF.js + COCO-SSD, which are heavy (~30MB).
// Keeping it in a separate file + dynamic import ensures the default (simulation)
// bundle stays small and the dev server compile doesn't OOM.

import { useEffect, useRef } from 'react'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import { usePrototypeStore, type Detection } from '@/lib/store'

export interface RealMlHandle {
  detect: () => Promise<{ dets: Detection[]; latency: number } | null>
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>
  imgRef: React.RefObject<HTMLImageElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** When true, draw from imgRef instead of videoRef (static-image camera mode). */
  isStatic?: boolean
  onModelStatus: (s: 'loading' | 'ready' | 'error', err?: string | null) => void
  onModelReady: (handle: RealMlHandle | null) => void
}

export function RealMlLoader({ videoRef, imgRef, canvasRef, isStatic, onModelStatus, onModelReady }: Props) {
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null)
  // Keep isStatic in a ref so the detect closure (created once on mount)
  // always reads the current value, not the stale mount-time value.
  const isStaticRef = useRef(isStatic)
  useEffect(() => {
    isStaticRef.current = isStatic
  }, [isStatic])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        onModelStatus('loading')
        await tf.setBackend('webgl').catch(() => {})
        await tf.ready()
        const model = await cocoSsd.load({ base: 'lite_mobilenet_v2' })
        if (!mounted) return
        modelRef.current = model
        if (typeof window !== 'undefined') {
          ;(window as any).__cocoModel = model
          ;(window as any).__tf = tf
        }
        onModelStatus('ready')
        // Provide a detect handle
        onModelReady({
          detect: async () => {
            const video = videoRef.current
            const img = imgRef.current
            const canvas = canvasRef.current
            const model = modelRef.current
            if (!canvas || !model) {
              if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: missing', { canvas: !!canvas, model: !!model })
              return null
            }

            // ─── Static-image mode ───
            if (isStaticRef.current) {
              if (!img || !img.complete || img.naturalWidth === 0) {
                if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: image not ready', { img: !!img, complete: img?.complete, naturalWidth: img?.naturalWidth })
                return null
              }
              const targetW = 320
              const targetH = Math.round((img.naturalHeight / img.naturalWidth) * targetW)
              if (canvas.width !== targetW || canvas.height !== targetH) {
                canvas.width = targetW
                canvas.height = targetH
              }
              const ctx = canvas.getContext('2d', { willReadFrequently: true })
              if (!ctx) return null
              const t0 = performance.now()
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

              // Verify not black. If the image is mostly dark (night scene),
              // check multiple points before declaring it "black".
              try {
                const points = [
                  [canvas.width / 2, canvas.height / 2],
                  [canvas.width / 4, canvas.height / 4],
                  [canvas.width * 3 / 4, canvas.height * 3 / 4],
                  [10, 10],
                ]
                let allBlack = true
                for (const [px, py] of points) {
                  const sample = ctx.getImageData(px, py, 1, 1).data
                  if (sample[0] !== 0 || sample[1] !== 0 || sample[2] !== 0) {
                    allBlack = false
                    break
                  }
                }
                if (allBlack) {
                  if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: static image canvas is all black, skipping')
                  return null
                }
              } catch (e) { /* tainted */ }

              const predictions = await model.detect(canvas, 20)
              const latency = performance.now() - t0
              if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect (static) result', {
                predictions: predictions.length,
                latency: latency.toFixed(0) + 'ms',
                classes: predictions.slice(0, 5).map((p) => `${p.class}:${p.score.toFixed(2)}`),
              })
              const dets: Detection[] = predictions.map((p) => ({
                bbox: [p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]] as [number, number, number, number],
                class: p.class,
                score: p.score,
              }))
              return { dets, latency }
            }

            // ─── Video mode ───
            if (!video) {
              if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: video missing')
              return null
            }
            if (video.readyState < 2 || video.videoWidth === 0 || video.currentTime <= 0) {
              if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: video not ready', { readyState: video.readyState, videoWidth: video.videoWidth, currentTime: video.currentTime })
              return null
            }

            const targetW = 320
            const targetH = Math.round((video.videoHeight / video.videoWidth) * targetW)
            if (canvas.width !== targetW || canvas.height !== targetH) {
              canvas.width = targetW
              canvas.height = targetH
            }
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            if (!ctx) return null

            // Wait for next video frame
            if (typeof (video as any).requestVideoFrameCallback === 'function') {
              await new Promise<void>((resolve) => {
                (video as any).requestVideoFrameCallback(() => resolve())
                setTimeout(resolve, 500)
              })
            }

            const t0 = performance.now()
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Verify not black, try createImageBitmap fallback
            try {
              const sample = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data
              if (sample[0] === 0 && sample[1] === 0 && sample[2] === 0) {
                const corner = ctx.getImageData(5, 5, 1, 1).data
                if (corner[0] === 0 && corner[1] === 0 && corner[2] === 0) {
                  if (typeof createImageBitmap === 'function') {
                    try {
                      const bitmap = await createImageBitmap(video, 0, 0, video.videoWidth, video.videoHeight)
                      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
                      bitmap.close()
                      const recheck = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data
                      if (recheck[0] === 0 && recheck[1] === 0 && recheck[2] === 0) {
                        if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: canvas still black after createImageBitmap, skipping')
                        return null
                      }
                    } catch (bmpErr) {
                      if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: createImageBitmap failed, skipping')
                      return null
                    }
                  } else {
                    if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect: canvas is black, skipping')
                    return null
                  }
                }
              }
            } catch (e) { /* tainted */ }

            const predictions = await model.detect(canvas, 20)
            const latency = performance.now() - t0

            if (process.env.NODE_ENV === 'development') console.log('[RealMlLoader] detect result', {
              predictions: predictions.length,
              latency: latency.toFixed(0) + 'ms',
              classes: predictions.slice(0, 5).map((p) => `${p.class}:${p.score.toFixed(2)}`),
            })

            const dets: Detection[] = predictions.map((p) => ({
              bbox: [p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]] as [number, number, number, number],
              class: p.class,
              score: p.score,
            }))
            return { dets, latency }
          },
        })
      } catch (err) {
        console.error('[RealMlLoader] model load failed:', err)
        onModelStatus('error', err instanceof Error ? err.message : 'unknown')
      }
    }
    load()
    return () => {
      mounted = false
      onModelReady(null)
    }
  }, [])

  return null
}
