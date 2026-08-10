'use client'

import { useState, type RefObject } from 'react'
import { Fingerprint, Loader2, ShieldCheck, ShieldX, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { prefixPath } from '@/lib/path-utils'
import {
  OWNER_ENROLLMENT_SAMPLES,
  OWNER_MATCH_THRESHOLD,
  averageDescriptors,
  verifyOwnerDescriptor,
} from '@/lib/owner-verification'

type FaceApiModule = typeof import('@vladmandic/face-api')
type ResultState = { kind: 'idle' | 'match' | 'reject' | 'error'; message: string }

let faceApiPromise: Promise<FaceApiModule> | null = null

async function loadFaceApi(): Promise<FaceApiModule> {
  if (faceApiPromise) return faceApiPromise
  faceApiPromise = (async () => {
    const faceapi = await import('@vladmandic/face-api')
    const backend = faceapi.tf as unknown as {
      setBackend(name: 'webgl' | 'cpu'): Promise<boolean>
      ready(): Promise<void>
    }
    const isWebKit = typeof navigator !== 'undefined'
      && /AppleWebKit/i.test(navigator.userAgent)
      && !/(Chrome|Chromium|CriOS)/i.test(navigator.userAgent)
    if (isWebKit) {
      const cpuReady = await backend.setBackend('cpu')
      if (!cpuReady) throw new Error('CPU face backend could not be initialized')
      await backend.ready()
    } else {
      try {
        const webglReady = await backend.setBackend('webgl')
        if (!webglReady) throw new Error('WebGL backend was not initialized')
        await backend.ready()
      } catch {
        const cpuReady = await backend.setBackend('cpu')
        if (!cpuReady) throw new Error('Neither WebGL nor CPU face backend could be initialized')
        await backend.ready()
      }
    }
    const modelUri = prefixPath('/models/face-api')
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelUri),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelUri),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUri),
    ])
    return faceapi
  })().catch(error => {
    faceApiPromise = null
    throw error
  })
  return faceApiPromise
}

export function OwnerVerification({ videoRef, cameraLive }: {
  videoRef: RefObject<HTMLVideoElement | null>
  cameraLive: boolean
}) {
  const [consented, setConsented] = useState(false)
  const [loading, setLoading] = useState(false)
  const [samples, setSamples] = useState<Float32Array[]>([])
  const [enrolled, setEnrolled] = useState<Float32Array | null>(null)
  const [result, setResult] = useState<ResultState>({ kind: 'idle', message: 'No owner enrolled in this browser session.' })

  async function captureDescriptor(): Promise<Float32Array | null> {
    const video = videoRef.current
    if (!cameraLive || !video || video.readyState < 2 || video.videoWidth === 0) {
      setResult({ kind: 'error', message: 'Start the device camera before capturing a face.' })
      return null
    }
    setLoading(true)
    setResult({ kind: 'idle', message: 'Preparing the local face model…' })
    try {
      const faceapi = await loadFaceApi()
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.65 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors()
      if (detections.length !== 1 || detections[0].detection.score < 0.7) {
        setResult({ kind: 'error', message: `Expected exactly one high-quality face; found ${detections.length}. Center one face in even light and retry.` })
        return null
      }
      return new Float32Array(detections[0].descriptor)
    } catch (error) {
      setResult({ kind: 'error', message: `Face model unavailable: ${error instanceof Error ? error.message : 'unknown error'}` })
      return null
    } finally {
      setLoading(false)
    }
  }

  async function addEnrollmentSample() {
    if (!consented) return
    const descriptor = await captureDescriptor()
    if (!descriptor) return
    const next = [...samples, descriptor].slice(0, OWNER_ENROLLMENT_SAMPLES)
    setSamples(next)
    if (next.length === OWNER_ENROLLMENT_SAMPLES) {
      const template = averageDescriptors(next)
      setEnrolled(template)
      setResult(template
        ? { kind: 'match', message: 'Owner template enrolled locally for this session.' }
        : { kind: 'error', message: 'Enrollment samples were invalid; delete and retry.' })
    } else {
      setResult({ kind: 'idle', message: `Enrollment sample ${next.length}/${OWNER_ENROLLMENT_SAMPLES} captured. Change angle slightly.` })
    }
  }

  async function verify() {
    if (!consented || !enrolled) return
    const descriptor = await captureDescriptor()
    if (!descriptor) return
    const verdict = verifyOwnerDescriptor(descriptor, enrolled)
    setResult(verdict.matched
      ? { kind: 'match', message: `Owner match · distance ${verdict.distance.toFixed(3)} ≤ ${verdict.threshold.toFixed(2)}` }
      : { kind: 'reject', message: `Not verified · distance ${verdict.distance.toFixed(3)} > ${verdict.threshold.toFixed(2)}` })
  }

  function deleteEnrollment() {
    setSamples([])
    setEnrolled(null)
    setResult({ kind: 'idle', message: 'Local owner template deleted.' })
  }

  const statusColor = result.kind === 'match'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : result.kind === 'reject' || result.kind === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-800'
      : 'border-zinc-200 bg-zinc-50 text-zinc-700'

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2" data-testid="owner-verification">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
            <Fingerprint className="h-4 w-4 text-emerald-600" /> Owner verification (local, opt-in)
          </h3>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            One-to-one face descriptor match. No image or descriptor leaves the device; the template is memory-only and clears on refresh.
          </p>
        </div>
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] text-amber-800">
          No liveness · not an access-control credential
        </span>
      </div>

      <label className="flex items-start gap-2 text-xs text-zinc-700">
        <input
          type="checkbox"
          checked={consented}
          onChange={event => {
            setConsented(event.target.checked)
            if (!event.target.checked) deleteEnrollment()
          }}
          aria-label="Consent to local owner face verification"
          className="mt-0.5 h-3.5 w-3.5 accent-emerald-600"
        />
        I consent to local face processing for this browser session.
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={addEnrollmentSample} disabled={!consented || !cameraLive || loading || Boolean(enrolled)}>
          {loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="mr-1 h-3.5 w-3.5" />}
          Capture enrollment {Math.min(samples.length + 1, OWNER_ENROLLMENT_SAMPLES)}/{OWNER_ENROLLMENT_SAMPLES}
        </Button>
        <Button size="sm" onClick={verify} disabled={!consented || !cameraLive || loading || !enrolled} className="bg-emerald-600 hover:bg-emerald-700">
          <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify owner
        </Button>
        <Button size="sm" variant="ghost" onClick={deleteEnrollment} disabled={!enrolled && samples.length === 0}>
          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete template
        </Button>
        <span className="text-[9px] text-zinc-500">Operational threshold: Euclidean distance ≤ {OWNER_MATCH_THRESHOLD.toFixed(2)}</span>
      </div>

      <div className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs ${statusColor}`} role="status" aria-live="polite" data-testid="owner-verification-status">
        {result.kind === 'reject' || result.kind === 'error' ? <ShieldX className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
        {result.message}
      </div>
    </section>
  )
}
