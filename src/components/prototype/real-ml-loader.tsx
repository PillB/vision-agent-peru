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
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  onModelStatus: (s: 'loading' | 'ready' | 'error', err?: string | null) => void
  onModelReady: (handle: RealMlHandle | null) => void
}

export function RealMlLoader({ videoRef, canvasRef, onModelStatus, onModelReady }: Props) {
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null)

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
            const canvas = canvasRef.current
            const model = modelRef.current
            if (!video || !canvas || !model) {
              console.log('[RealMlLoader] detect: missing', { video: !!video, canvas: !!canvas, model: !!model })
              return null
            }
            if (video.readyState < 2 || video.videoWidth === 0) {
              console.log('[RealMlLoader] detect: video not ready', { readyState: video.readyState, videoWidth: video.videoWidth })
              return null
            }

            const targetW = 480
            const targetH = Math.round((video.videoHeight / video.videoWidth) * targetW)
            if (canvas.width !== targetW || canvas.height !== targetH) {
              canvas.width = targetW
              canvas.height = targetH
            }
            const ctx = canvas.getContext('2d')
            if (!ctx) return null

            const t0 = performance.now()
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const predictions = await model.detect(canvas, 20)
            const latency = performance.now() - t0

            console.log('[RealMlLoader] detect result', {
              predictions: predictions.length,
              latency: latency.toFixed(0) + 'ms',
              classes: predictions.slice(0, 5).map((p) => `${p.class}:${p.score.toFixed(2)}`),
            })

            // Bboxes are already in canvas coordinates — no scaling needed
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
