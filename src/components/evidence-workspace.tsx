'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Database, Download, FileVideo, Pause, Play, Search, Shield, Trash2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { parseQuery } from '@/lib/query-parser'
import {
  clearEvidence,
  addEvidence,
  createEvidenceExport,
  listEvidence,
  searchEvidenceAdvanced,
  type EvidenceRankMode,
  type EvidenceRecord,
  type ExplainedSearchResult,
} from '@/lib/evidence'
import {
  calculateVideoHash,
  DEFAULT_SAMPLING,
  estimateProcessingCost,
  extractVideoMetadata,
  indexVideoWithAdapters,
  validateVideoFile,
  type IndexingProgress,
  type SamplingConfig,
  type VideoIndexSummary,
  type VideoMetadata,
} from '@/lib/video-indexer'
import { embedImageCanvas, embedText, RETRIEVAL_MODEL } from '@/lib/vlm-embeddings'
import { createYolosAdapter } from '@/lib/yolos-detector'
import { findCrossVideoCandidates, assessAbsence, APPEARANCE_DISCLAIMER, type CandidateAssociation, type AbsenceResult } from '@/lib/association'
import { idbClear, idbPut, probeIndexedDB, purgeExpired, type PersistenceStatus } from '@/lib/idb'
import { ALL_MODELS } from '@/lib/models/registry'
import { detectProfile, getProfileCapabilities, type CapabilityProfile } from '@/lib/incident-state-machine'
import { runControlledActions, type ControlledActionEvent } from '@/lib/action-orchestrator'
import { prefixPath } from '@/lib/path-utils'

type Destination = 'system' | 'analyze' | 'search' | 'associations' | 'incidents' | 'governance'

const DESTINATIONS: Array<{ id: Destination; label: string }> = [
  { id: 'system', label: 'System & Session' },
  { id: 'analyze', label: 'Analyze Videos' },
  { id: 'search', label: 'Search Evidence' },
  { id: 'associations', label: 'Associations & Timeline' },
  { id: 'incidents', label: 'Incidents & Actions' },
  { id: 'governance', label: 'Models & Governance' },
]

interface PreparedVideo {
  file: File
  metadata: VideoMetadata
  estimate: ReturnType<typeof estimateProcessingCost>
  objectUrl: string
}

const RETENTION_MS = 24 * 60 * 60 * 1000

export function EvidenceWorkspace() {
  const [destination, setDestination] = useState<Destination>('system')
  const [profile, setProfile] = useState<CapabilityProfile>('github_pages')
  const [storage, setStorage] = useState<PersistenceStatus>({ available: false, persistent: false, reason: 'Checking…' })
  const [webGpu, setWebGpu] = useState(false)
  const [prepared, setPrepared] = useState<PreparedVideo[]>([])
  const [preflightError, setPreflightError] = useState<string | null>(null)
  const [cameraName, setCameraName] = useState('Camera 1')
  const [location, setLocation] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [timezone, setTimezone] = useState('America/Lima')
  const [strategy, setStrategy] = useState<SamplingConfig['strategy']>('motion-adaptive')
  const [semanticEnabled, setSemanticEnabled] = useState(false)
  const [progress, setProgress] = useState<IndexingProgress | null>(null)
  const [analysisState, setAnalysisState] = useState<'idle' | 'running' | 'paused' | 'cancelled' | 'done' | 'error'>('idle')
  const [analysisMessage, setAnalysisMessage] = useState('Select authorized local videos to begin.')
  const [summaries, setSummaries] = useState<VideoIndexSummary[]>([])
  const [records, setRecords] = useState<EvidenceRecord[]>([])
  const [query, setQuery] = useState('person with a backpack')
  const [rankMode, setRankMode] = useState<EvidenceRankMode>('relevance')
  const [threshold, setThreshold] = useState(0.65)
  const [cameraFilter, setCameraFilter] = useState('')
  const [objectFilter, setObjectFilter] = useState('')
  const [candidates, setCandidates] = useState<ExplainedSearchResult[]>([])
  const [nearMisses, setNearMisses] = useState<ExplainedSearchResult[]>([])
  const [searchStatus, setSearchStatus] = useState('No search run yet.')
  const [selectedResult, setSelectedResult] = useState<EvidenceRecord | null>(null)
  const [associations, setAssociations] = useState<CandidateAssociation[]>([])
  const [absence, setAbsence] = useState<AbsenceResult | null>(null)
  const [controlTrace, setControlTrace] = useState<ControlledActionEvent[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const pausedRef = useRef(false)
  const resumeRef = useRef<(() => void) | null>(null)

  const capabilities = getProfileCapabilities(profile)
  const parsed = useMemo(() => parseQuery(query), [query])

  const refreshRecords = useCallback(async () => {
    try {
      setRecords(await listEvidence())
    } catch (error) {
      setStorage({ available: false, persistent: false, reason: error instanceof Error ? error.message : 'Storage read failed' })
      setRecords([])
    }
  }, [])

  useEffect(() => {
    probeIndexedDB().then(async status => {
      setProfile(detectProfile())
      setWebGpu(typeof navigator !== 'undefined' && 'gpu' in navigator)
      setStorage(status)
      if (status.available) {
        await purgeExpired('evidence', RETENTION_MS)
        await purgeExpired('videos', RETENTION_MS)
        await purgeExpired('tracks', RETENTION_MS)
        await purgeExpired('associations', RETENTION_MS)
        await refreshRecords()
      }
    })
    return () => prepared.forEach(item => URL.revokeObjectURL(item.objectUrl))
  }, [refreshRecords])

  const handleFiles = async (files: FileList | null) => {
    setPreflightError(null)
    if (!files?.length) return
    const next: PreparedVideo[] = []
    for (const file of Array.from(files)) {
      const validation = validateVideoFile(file)
      if (validation) {
        setPreflightError(validation)
        continue
      }
      try {
        const metadata = await extractVideoMetadata(
          file,
          cameraName,
          location || undefined,
          recordedAt ? new Date(recordedAt).getTime() : undefined,
          timezone,
          false,
        )
        const config = { ...DEFAULT_SAMPLING, strategy }
        next.push({ file, metadata, estimate: estimateProcessingCost(metadata, config), objectUrl: URL.createObjectURL(file) })
      } catch (error) {
        setPreflightError(`${file.name}: ${error instanceof Error ? error.message : 'failed decoding metadata'}`)
      }
    }
    setPrepared(previous => [...previous, ...next])
  }

  const waitIfPaused = async () => {
    if (!pausedRef.current) return
    await new Promise<void>(resolve => { resumeRef.current = resolve })
  }

  const loadDemonstrationEvidence = async () => {
    if (!storage.available) return
    const imageToDataUrl = async (path: string) => {
      const blob = await fetch(prefixPath(path)).then(response => {
        if (!response.ok) throw new Error(`Fixture image failed: ${response.status}`)
        return response.blob()
      })
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
    }
    const [backpack, pedestrians, parking] = await Promise.all([
      imageToDataUrl('/sim/frames/uc-backpack.jpg'),
      imageToDataUrl('/sim/frames/urban-pedestrians.jpg'),
      imageToDataUrl('/sim/frames/uc-parking.jpg'),
    ])
    const now = Date.now()
    const fixtureRecords: EvidenceRecord[] = [
      {
        id: 'simulation-track-a-entry', createdAt: now, videoId: 'simulation-video-a', cameraId: 'Simulation camera A',
        useCaseId: 'explicit-labeled-simulation', timestamp: now - 120_000, sourceTimestampSeconds: 4,
        snapshotDataUrl: backpack, detection: { class: 'person', score: 0.82, bbox: [20, 10, 80, 160] },
        embedding: new Float32Array([1, 0, 0]), trackId: 'simulation-video-a:track-1', note: 'person blue jacket red backpack walking',
        confirmed: false, contextPosition: 'entry', modelId: 'deterministic-simulation', modelRevision: 'fixture-v1', quality: 'high',
      },
      {
        id: 'simulation-track-b-exit', createdAt: now, videoId: 'simulation-video-b', cameraId: 'Simulation camera B',
        useCaseId: 'explicit-labeled-simulation', timestamp: now - 60_000, sourceTimestampSeconds: 18,
        snapshotDataUrl: pedestrians, detection: { class: 'person', score: 0.79, bbox: [30, 10, 75, 155] },
        embedding: new Float32Array([0.98, 0.02, 0]), trackId: 'simulation-video-b:track-7', note: 'person blue jacket red backpack toward exit',
        confirmed: false, contextPosition: 'exit', modelId: 'deterministic-simulation', modelRevision: 'fixture-v1', quality: 'high',
      },
      {
        id: 'simulation-near-miss', createdAt: now, videoId: 'simulation-video-c', cameraId: 'Simulation camera C',
        useCaseId: 'explicit-labeled-simulation', timestamp: now - 30_000, sourceTimestampSeconds: 9,
        snapshotDataUrl: parking, detection: { class: 'car', score: 0.72, bbox: [40, 30, 120, 70] },
        embedding: new Float32Array([0.55, 0.45, 0]), trackId: 'simulation-video-c:track-2', note: 'white car near entrance',
        confirmed: false, contextPosition: 'middle', modelId: 'deterministic-simulation', modelRevision: 'fixture-v1', quality: 'medium',
      },
    ]
    for (const record of fixtureRecords) await addEvidence(record)
    await refreshRecords()
    setAnalysisMessage('Labeled simulation evidence loaded. It is explicitly separated from analyzed user video evidence.')
  }

  const startAnalysis = async () => {
    if (!prepared.length || !storage.available) return
    const abort = new AbortController()
    abortRef.current = abort
    pausedRef.current = false
    setAnalysisState('running')
    setAnalysisMessage('Approved. Hashing and analyzing locally…')
    const completed: VideoIndexSummary[] = []
    try {
      for (const item of prepared) {
        if (abort.signal.aborted) break
        const metadata = { ...item.metadata, contentHash: await calculateVideoHash(item.file) }
        const summary = await indexVideoWithAdapters(
          item.file,
          metadata,
          { ...DEFAULT_SAMPLING, strategy, maxFrames: 240 },
          createYolosAdapter(waitIfPaused, abort.signal),
          semanticEnabled ? {
            id: RETRIEVAL_MODEL.id,
            revision: RETRIEVAL_MODEL.revision,
            embed: embedImageCanvas,
          } : undefined,
          setProgress,
          abort.signal,
        )
        completed.push(summary)
      }
      setSummaries(previous => [...previous, ...completed])
      setAnalysisState(abort.signal.aborted ? 'cancelled' : 'done')
      setAnalysisMessage(abort.signal.aborted
        ? 'Cancelled. Partial evidence is labeled and remains deletable.'
        : `Completed ${completed.length} video(s). Review coverage and failures below.`)
      await refreshRecords()
    } catch (error) {
      setAnalysisState('error')
      setAnalysisMessage(error instanceof Error ? error.message : 'Analysis failed')
    }
  }

  const pause = () => {
    pausedRef.current = true
    setAnalysisState('paused')
    setAnalysisMessage('Paused after the current adapter call.')
  }
  const resume = () => {
    pausedRef.current = false
    resumeRef.current?.()
    resumeRef.current = null
    setAnalysisState('running')
    setAnalysisMessage('Analysis resumed.')
  }
  const cancel = () => {
    pausedRef.current = false
    resumeRef.current?.()
    abortRef.current?.abort()
    setAnalysisState('cancelled')
  }

  const runSearch = async (referenceEmbedding?: Float32Array) => {
    if (parsed.rejectedTerms.length) {
      setSearchStatus(parsed.explanation)
      setCandidates([])
      setNearMisses([])
      return
    }
    setSearchStatus('Searching the local index…')
    try {
      let queryEmbedding = referenceEmbedding
      if (!queryEmbedding && semanticEnabled) queryEmbedding = await embedText(parsed.semanticQuery)
      const result = await searchEvidenceAdvanced({
        queryText: referenceEmbedding ? '' : query,
        queryEmbedding,
        filters: {
          cameraIds: cameraFilter ? [cameraFilter] : undefined,
          objectType: objectFilter || parsed.objectType,
        },
        rankMode,
        threshold,
      })
      setCandidates(result.candidates)
      setNearMisses(result.nearMisses)
      setSearchStatus(`${result.candidates.length} candidate(s), ${result.nearMisses.length} near miss(es). Scores are not probabilities.`)
      await idbPut('searches', {
        id: `search-${Date.now()}`,
        createdAt: Date.now(),
        query,
        parsed,
        rankMode,
        threshold,
        resultIds: [...result.candidates, ...result.nearMisses].map(item => item.record.id),
      })
    } catch (error) {
      setSearchStatus(`Search unavailable: ${error instanceof Error ? error.message : 'unknown error'}. Structured filters remain available.`)
    }
  }

  const handleReference = async (file: File | undefined) => {
    if (!file) return
    const image = new Image()
    const url = URL.createObjectURL(file)
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    canvas.getContext('2d')?.drawImage(image, 0, 0)
    URL.revokeObjectURL(url)
    await runSearch(await embedImageCanvas(canvas))
  }

  const proposeCandidates = () => setAssociations(findCrossVideoCandidates(records))
  const reviewAssociation = async (association: CandidateAssociation, accepted: boolean) => {
    const reviewed = {
      ...association,
      decision: accepted ? 'plausible' as const : 'incompatible' as const,
      reviewer: 'local operator',
      reviewedAt: Date.now(),
    }
    setAssociations(previous => previous.map(item => item.associationId === association.associationId ? reviewed : item))
    await idbPut('associations', { ...reviewed, id: reviewed.associationId, createdAt: reviewed.reviewedAt })
  }

  const runAbsence = () => {
    const totalDuration = summaries.reduce((sum, item) => sum + item.metadata.durationSeconds, 0)
    const analyzed = summaries.reduce((sum, item) => sum + item.analyzedDurationSeconds, 0)
    const queryEmbedding = undefined
    setAbsence(assessAbsence(queryEmbedding, query, records, {
      videosSearched: summaries.map(item => item.metadata.videoId),
      timeRanges: summaries.map(item => ({ videoId: item.metadata.videoId, startSeconds: 0, endSeconds: item.analyzedDurationSeconds })),
      percentSampled: totalDuration > 0 ? analyzed / totalDuration * 100 : 0,
      detectorRecallEstimate: 0,
      failedIntervals: summaries.flatMap(item => item.failedIntervals.map(interval => ({
        videoId: item.metadata.videoId,
        startSeconds: interval.startSeconds,
        reason: interval.reason,
      }))),
      skippedIntervals: summaries.flatMap(item => item.skippedIntervals.map(interval => ({
        videoId: item.metadata.videoId,
        ...interval,
      }))),
    }, threshold))
  }

  const exportEvidence = async () => {
    const output = await createEvidenceExport({ query, threshold, coverage: summaries, associationDecisions: associations, actionTrace: controlTrace })
    const blob = new Blob([output.json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vision-agent-evidence-${output.sha256.slice(0, 12)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const deleteLocalData = async () => {
    await clearEvidence()
    for (const store of ['videos', 'tracks', 'searches', 'associations', 'incidents', 'actions'] as const) await idbClear(store)
    setRecords([])
    setCandidates([])
    setNearMisses([])
    setAssociations([])
    setSummaries([])
  }

  const runFalsePositiveProof = async () => {
    const trace: ControlledActionEvent[] = []
    await runControlledActions({
      incidentId: `proof-${Date.now()}`,
      proposedActions: ['llm_judge', 'generate_report', 'send_email', 'escalate'],
      allowedActions: ['llm_judge', 'generate_report', 'send_email', 'escalate'],
      profile: 'secure_service',
      evidence: { available: true, visual: true, evidenceIds: ['negative-control-fixture'] },
      judge: async () => ({ verdict: 'false_positive', confidence: 0.99, reason: 'Deterministic negative-control fixture' }),
      approval: async () => false,
      execute: async action => ({ ok: false, verified: false, message: `unexpected execution: ${action}` }),
      onEvent: event => trace.push(event),
    })
    setControlTrace(trace)
  }

  const selectedPreview = selectedResult && prepared.find(item => item.metadata.videoId === selectedResult.videoId)

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-zinc-50" aria-label="Evidence workspace">
      <div className="mx-auto max-w-[1600px] px-3 py-5 md:px-6 space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-zinc-950">Authorized video evidence workspace</h1>
              <p className="text-sm text-zinc-600">Local-first analysis. Candidate similarity never establishes identity.</p>
            </div>
            <Badge variant="outline">{capabilities.badge}</Badge>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label="Evidence destinations">
            {DESTINATIONS.map(item => (
              <Button key={item.id} variant={destination === item.id ? 'default' : 'outline'} onClick={() => setDestination(item.id)}>
                {item.label}
              </Button>
            ))}
          </nav>
        </div>

        {destination === 'system' && (
          <section className="grid gap-4 lg:grid-cols-2" aria-labelledby="system-heading">
            <Panel title="Execution profile" id="system-heading">
              <Status label="Profile" value={profile} ok />
              <Status label="WebGPU" value={webGpu ? 'available (experimental)' : 'absent — WASM fallback required'} ok={!webGpu} />
              <Status label="WebAssembly" value={typeof WebAssembly !== 'undefined' ? 'available' : 'unavailable'} ok={typeof WebAssembly !== 'undefined'} />
              <Status label="IndexedDB" value={storage.available ? `available · ${storage.persistent ? 'persistent grant' : 'best-effort / evictable'}` : `unavailable · ${storage.reason}`} ok={storage.available} />
              <Status label="External actions" value="unavailable until authenticated service + explicit approval" ok />
            </Panel>
            <Panel title="Privacy & retention">
              <p>Evidence stays in this browser unless you explicitly export it. IndexedDB is user-deletable and not immutable.</p>
              <p className="mt-2">Default retention: 24 hours, enforced on workspace startup for evidence, videos, tracks, and associations.</p>
              <p className="mt-2">Faces, permanent watchlists, age, perceived gender, body proportion, and gait are excluded from the normal index.</p>
              <Button className="mt-4" variant="destructive" onClick={deleteLocalData}><Trash2 className="mr-2 h-4 w-4" />Delete all local evidence</Button>
            </Panel>
          </section>
        )}

        {destination === 'analyze' && (
          <section className="space-y-4" aria-labelledby="analyze-heading">
            <Panel title="Upload and capability check" id="analyze-heading">
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Camera name"><Input value={cameraName} onChange={event => setCameraName(event.target.value)} /></Field>
                <Field label="Location"><Input value={location} onChange={event => setLocation(event.target.value)} /></Field>
                <Field label="Recording start"><Input type="datetime-local" value={recordedAt} onChange={event => setRecordedAt(event.target.value)} /></Field>
                <Field label="Timezone"><Input value={timezone} onChange={event => setTimezone(event.target.value)} /></Field>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Sampling strategy">
                  <select className="h-10 w-full rounded-md border px-3" value={strategy} onChange={event => setStrategy(event.target.value as SamplingConfig['strategy'])}>
                    <option value="motion-adaptive">Motion adaptive</option>
                    <option value="scene-change">Scene change</option>
                    <option value="fixed">Fixed interval</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={semanticEnabled} onChange={event => setSemanticEnabled(event.target.checked)} />Experimental CLIP embeddings (~100+ MB)</label>
                <Field label="Authorized videos"><Input type="file" accept="video/*" multiple onChange={event => handleFiles(event.target.files)} /></Field>
              </div>
              {preflightError && <Notice tone="error">{preflightError}</Notice>}
              <div className="mt-4 space-y-2">
                {prepared.map(item => <div key={item.metadata.videoId} className="rounded border p-3 text-sm"><FileVideo className="mr-2 inline h-4 w-4" />{item.file.name} · {item.metadata.durationSeconds.toFixed(1)}s · {item.estimate.estimatedFrames} sampled frames · estimate {item.estimate.estimatedTimeSeconds.toFixed(0)}s / {item.estimate.estimatedMemoryMB.toFixed(1)}MB</div>)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={startAnalysis} disabled={!prepared.length || !storage.available || analysisState === 'running'}><Play className="mr-2 h-4 w-4" />Approve and analyze locally</Button>
                <Button variant="outline" onClick={loadDemonstrationEvidence} disabled={!storage.available}>Load labeled simulation evidence</Button>
                <Button variant="outline" onClick={pause} disabled={analysisState !== 'running'}><Pause className="mr-2 h-4 w-4" />Pause</Button>
                <Button variant="outline" onClick={resume} disabled={analysisState !== 'paused'}><Play className="mr-2 h-4 w-4" />Resume</Button>
                <Button variant="destructive" onClick={cancel} disabled={!['running', 'paused'].includes(analysisState)}>Cancel</Button>
              </div>
              <Notice tone={analysisState === 'error' ? 'error' : 'info'}>{analysisMessage}</Notice>
              {progress && <div className="mt-3"><Progress value={progress.framesTotal ? progress.framesProcessed / progress.framesTotal * 100 : 0} /><p className="mt-1 text-xs">{progress.phase} · {progress.framesProcessed}/{progress.framesTotal} · {progress.currentTimestamp.toFixed(1)}s</p></div>}
            </Panel>
            <Panel title="Coverage and failures">
              {summaries.length === 0 ? <p>No completed analysis yet.</p> : summaries.map(summary => (
                <div key={summary.metadata.videoId} className="mb-3 rounded border p-3 text-sm">
                  <strong>{summary.metadata.fileName}</strong> · analyzed {summary.analyzedDurationSeconds.toFixed(1)}s / {summary.metadata.durationSeconds.toFixed(1)}s · {summary.framesProcessed} frames · {summary.evidenceStored} crops · {summary.skippedIntervals.length} skipped intervals · {summary.failedIntervals.length} decode failures
                </div>
              ))}
            </Panel>
          </section>
        )}

        {destination === 'search' && (
          <section className="space-y-4" aria-labelledby="search-heading">
            <Panel title="Natural-language and reference search" id="search-heading">
              <Field label="Describe observable evidence"><Input value={query} onChange={event => setQuery(event.target.value)} /></Field>
              <p className="mt-2 text-xs text-zinc-500">{parsed.explanation}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Camera"><Input value={cameraFilter} onChange={event => setCameraFilter(event.target.value)} placeholder="all cameras" /></Field>
                <Field label="Object class"><Input value={objectFilter} onChange={event => setObjectFilter(event.target.value)} placeholder="person, car…" /></Field>
                <Field label="Ranking"><select className="h-10 w-full rounded-md border px-3" value={rankMode} onChange={event => setRankMode(event.target.value as EvidenceRankMode)}><option value="relevance">Relevance</option><option value="recency">Recency</option><option value="balanced">Balanced</option></select></Field>
                <Field label={`Threshold ${threshold.toFixed(2)}`}><input className="w-full" type="range" min="0" max="1" step="0.01" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => runSearch()}><Search className="mr-2 h-4 w-4" />Search local evidence</Button>
                <label className="inline-flex cursor-pointer items-center rounded-md border px-3 text-sm">Reference image<input className="sr-only" type="file" accept="image/*" onChange={event => handleReference(event.target.files?.[0])} /></label>
                <Button variant="outline" onClick={runAbsence}>Assess analyzed coverage</Button>
                <Button variant="outline" onClick={exportEvidence}><Download className="mr-2 h-4 w-4" />Export evidence</Button>
              </div>
              <Notice tone={parsed.rejectedTerms.length ? 'error' : 'info'}>{searchStatus}</Notice>
            </Panel>
            {absence && <Panel title={`Coverage assessment · ${absence.result.replaceAll('_', ' ')}`}><p>{absence.explanation}</p><p className="mt-2 text-xs">Analyzed duration: {absence.analyzedDurationSeconds.toFixed(1)}s · skipped: {absence.skippedIntervals.length} · decode failures: {absence.failedIntervals.length} · threshold: {absence.threshold} · near misses: {absence.strongestNearMisses.length}</p><ul className="mt-2 list-disc pl-5 text-xs">{absence.modelLimitations.map(item => <li key={item}>{item}</li>)}</ul></Panel>}
            <ResultGrid title="Ranked candidates" items={candidates} onSelect={setSelectedResult} />
            <ResultGrid title="Near misses" items={nearMisses} onSelect={setSelectedResult} />
          </section>
        )}

        {destination === 'associations' && (
          <section className="space-y-4" aria-labelledby="association-heading">
            <Panel title="Candidate association review" id="association-heading">
              <p>{APPEARANCE_DISCLAIMER}</p>
              <p className="mt-2 text-xs">Outcome vocabulary: local track · appearance-similar candidate · plausible cross-video association · human-confirmed association · inconclusive.</p>
              <Button className="mt-3" onClick={proposeCandidates}>Propose from embedded crops</Button>
            </Panel>
            {associations.length === 0 ? <Panel title="Association queue"><p>No candidates. At least two embedded track crops are required; open-set rejection is enabled.</p></Panel> : associations.map(item => (
              <Panel key={item.associationId} title={`${item.reviewer ? (item.decision === 'plausible' ? 'Human-confirmed association' : 'Rejected association') : 'Plausible cross-video association'} · experimental fusion ${item.fusionScore.toFixed(3)}`}>
                <p>{item.leftTrackId} ↔ {item.rightTrackId}</p><p className="text-xs">Appearance {item.appearanceScore.toFixed(3)} · topology {item.topologyScore.toFixed(3)} · temporal {item.temporalScore.toFixed(3)} · quality {item.evidenceQuality}</p>
                {item.conflicts.map(conflict => <p className="text-xs text-amber-700" key={conflict}>{conflict}</p>)}
                <div className="mt-3 flex gap-2"><Button onClick={() => reviewAssociation(item, true)}>Human confirm</Button><Button variant="outline" onClick={() => reviewAssociation(item, false)}>Reject</Button></div>
              </Panel>
            ))}
            {selectedResult && <Panel title="Timeline review"><img className="max-h-64 rounded" src={selectedResult.snapshotDataUrl} alt={`Evidence ${selectedResult.id}`} /><p className="mt-2">{selectedResult.cameraId} · {new Date(selectedResult.timestamp).toLocaleString()} · {selectedResult.contextPosition ?? 'middle'} context</p>{selectedPreview && <video className="mt-3 w-full max-w-xl" src={selectedPreview.objectUrl} controls onLoadedMetadata={event => { event.currentTarget.currentTime = selectedResult.sourceTimestampSeconds ?? 0 }} />}</Panel>}
          </section>
        )}

        {destination === 'incidents' && (
          <section className="space-y-4" aria-labelledby="incident-heading">
            <Panel title="Deterministic agentic control" id="incident-heading">
              <p>observe → validate evidence → apply deterministic policy → invoke optional judge → validate judge output → propose action → request approval → execute → verify outcome → close/retry/compensate</p>
              <p className="mt-2">Email, tickets, dispatch, access control, emergency messaging, and external evidence transmission require explicit approval plus a configured authenticated service. None is configured here.</p>
              <Button className="mt-3" onClick={runFalsePositiveProof}>Run labeled false-positive simulation</Button>
            </Panel>
            <Panel title="Action trace">
              {controlTrace.length === 0 ? <p>No control proof run.</p> : controlTrace.map((event, index) => <div className="border-b py-2 text-sm" key={`${event.stage}-${index}`}>{index + 1}. {event.stage} · {event.action ?? 'incident'} · {event.status} {event.detail && `· ${event.detail}`}</div>)}
              {controlTrace.length > 0 && <Notice tone="info">Simulation result: false-positive verdict closed the incident before report, email, or escalation execution.</Notice>}
            </Panel>
          </section>
        )}

        {destination === 'governance' && (
          <section className="space-y-4" aria-labelledby="governance-heading">
            <Panel title="Model and adapter inventory" id="governance-heading">
              <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Model</th><th>Status</th><th>Revision</th><th>License</th><th>Limits</th></tr></thead><tbody>{ALL_MODELS.map(model => <tr className="border-t" key={model.id}><td className="py-2">{model.label}</td><td>{model.adapterImplemented && model.browserReady ? 'experimental adapter' : 'unavailable candidate'}</td><td className="font-mono text-xs">{model.revision}</td><td>{model.license}</td><td>{model.cons.join(' · ')}</td></tr>)}</tbody></table></div>
            </Panel>
            <Panel title="Responsible-use boundary">
              <p>No facial recognition or permanent watchlists. Age, perceived gender, body proportion, and gait are disabled research-only topics and never enter operational ranking, normal retention, association, or action authorization.</p>
              <p className="mt-2">COCO-SSD cannot detect fire, flood, graffiti, landslide, slips, or structural damage. CLIP retrieval is experimental. MobileCLIP is research-only under its released weight license; YOLOv10 awaits AGPL review; SigLIP is not selected due browser footprint.</p>
            </Panel>
          </section>
        )}
      </div>
    </main>
  )
}

function Panel({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700"><h2 id={id} className="mb-3 text-base font-semibold text-zinc-950">{title}</h2>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm"><span className="mb-1 block font-medium text-zinc-700">{label}</span>{children}</label> }
function Status({ label, value, ok }: { label: string; value: string; ok: boolean }) { return <div className="flex items-start justify-between gap-4 border-b py-2"><span>{label}</span><span className="flex items-center gap-1 text-right">{ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}{value}</span></div> }
function Notice({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) { return <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-3 rounded-md border px-3 py-2 text-sm ${tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-blue-200 bg-blue-50 text-blue-800'}`}>{tone === 'error' ? <AlertTriangle className="mr-2 inline h-4 w-4" /> : <Shield className="mr-2 inline h-4 w-4" />}{children}</div> }
function ResultGrid({ title, items, onSelect }: { title: string; items: ExplainedSearchResult[]; onSelect: (record: EvidenceRecord) => void }) { return <Panel title={title}>{items.length === 0 ? <p>No results.</p> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{items.map(item => <button className="rounded border p-2 text-left focus-visible:ring-2" key={item.record.id} onClick={() => onSelect(item.record)}><img className="aspect-video w-full rounded object-cover" src={item.record.snapshotDataUrl} alt={`${item.record.detection.class} candidate`} /><strong className="mt-2 block">{item.outcome.replace('_', ' ')} · {item.score.toFixed(3)}</strong><span className="text-xs">{item.record.cameraId} · {new Date(item.record.timestamp).toLocaleString()}</span><span className="mt-1 block text-xs">{item.explanation.join(' · ')}</span></button>)}</div>}</Panel> }
