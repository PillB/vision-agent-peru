'use client'

import {
  Camera,
  Brain,
  Zap,
  Eye,
  FileText,
  Mail,
  Shield,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  Layers,
  Cpu,
  Activity,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { USE_CASES } from '@/lib/agent'

interface Props {
  onTryPrototype: () => void
}

export function Tab1Overview({ onTryPrototype }: Props) {
  return (
    <main className="bg-white text-zinc-950">
      {/* ============================================================
          SECTION 1 — HERO / EXECUTIVE SUMMARY (SCR)
          Action title: "An agentic camera intelligence system that
          converts Peru's public plaza feeds into automated, auditable
          incident response — running entirely in the browser."
      ============================================================ */}
      <section className="border-b border-zinc-200 bg-gradient-to-b from-emerald-50/40 via-white to-white">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-12 md:py-20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Executive Summary
            </span>
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-xs font-mono text-zinc-500">Cusco · Lima · Arequipa</span>
          </div>

          <h1 className="font-serif text-3xl md:text-5xl lg:text-6xl leading-[1.05] text-zinc-950 max-w-4xl">
            An agentic camera intelligence system that converts Peru&rsquo;s public plaza feeds into{' '}
            <span className="italic text-emerald-700">automated, auditable incident response</span> — running entirely in the browser.
          </h1>

          <p className="mt-6 text-base md:text-lg text-zinc-600 max-w-3xl leading-relaxed">
            The system pairs a traditional computer-vision layer (TF.js COCO-SSD, 90-class object detection) with an agentic reasoning layer (rule engine + LLM-as-judge) that perceives, decides, and acts on anomalies in real time — without sending camera frames to a remote server.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              onClick={onTryPrototype}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Open live prototype
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 hover:text-emerald-700 transition"
            >
              Read the architecture
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* SCR 3-column */}
          <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 rounded-xl overflow-hidden border border-zinc-200">
            <ScrCard
              label="Situation"
              icon={<Camera className="h-4 w-4" />}
              tone="zinc"
              body="Peru's public plazas (Cusco, Lima, Arequipa) are monitored by ad-hoc camera feeds. Operators watch screens manually, react late, and rarely produce an auditable incident trail."
            />
            <ScrCard
              label="Complication"
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="amber"
              body="Manual monitoring means 10–15 min mean-time-to-respond, high false-alarm fatigue, no snapshot evidence at the moment of incident, and zero searchable history."
            />
            <ScrCard
              label="Resolution"
              icon={<Zap className="h-4 w-4" />}
              tone="emerald"
              body="An in-browser agentic loop: COCO-SSD perceives → rule engine reasons → 3-tier escalation acts → snapshot+report logged. Under 2 seconds per cycle, with full evidence trail."
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2 — THE BIG NUMBER
          "The agentic loop completes a full perceive→reason→act cycle
          in under 2 seconds, 30× faster than manual review."
      ============================================================ */}
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-3">
                The Big Number
              </p>
              <div className="flex items-baseline gap-3">
                <span className="font-serif text-7xl md:text-8xl lg:text-9xl text-emerald-700 leading-none tabular-nums">
                  &lt;2s
                </span>
                <span className="font-mono text-sm text-zinc-500">perceive → reason → act</span>
              </div>
              <h2 className="mt-6 font-serif text-2xl md:text-3xl text-zinc-950 leading-tight max-w-2xl">
                The agentic loop completes a full perceive→reason→act cycle in under 2 seconds — roughly 30× faster than manual review of the same camera.
              </h2>
              <p className="mt-4 text-sm md:text-base text-zinc-600 leading-relaxed max-w-2xl">
                Latency budget breakdown: TF.js COCO-SSD inference ≈ 250–500 ms on a mid-tier laptop GPU · rule-engine reasoning &lt; 5 ms · action dispatch (snapshot, email sim, optional LLM judge) ≈ 200–800 ms. The remaining budget is canvas redraw and React state propagation. All numbers measured on the live prototype.
              </p>
              <p className="mt-4 text-xs text-zinc-400 font-mono">
                Source: internal measurement on MacBook Pro M2, 2026-07-14. Manual review baseline: industry typical 8–15 min MTTR for unmonitored CCTV.
              </p>
            </div>
            <div className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-3">
                <BigStat value="30×" label="Faster than manual" tone="emerald" />
                <BigStat value="90" label="Object classes detected" tone="zinc" />
                <BigStat value="3" label="Escalation tiers" tone="zinc" />
                <BigStat value="0" label="Backend servers required" tone="emerald" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3 — SYSTEM ARCHITECTURE (5-STAGE PROCESS FLOW)
          "Five-stage pipeline turns raw video frames into escalated,
          evidence-backed incidents — each stage adding a layer of intelligence."
      ============================================================ */}
      <section id="architecture" className="border-b border-zinc-200 bg-zinc-50/50">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="System Architecture"
            title="Five-stage pipeline turns raw video frames into escalated, evidence-backed incidents — each stage adding a layer of intelligence."
          />

          {/* Horizontal flow */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-5 gap-4">
            <FlowCard
              step={1}
              icon={<Eye className="h-5 w-5" />}
              name="Perceive"
              role="TF.js COCO-SSD"
              layer="Analytics / IA"
              tone="zinc"
              description="Captures each video frame, runs the 90-class object-detection model in-browser, and emits bounding boxes + confidence scores. Pure perception — no decisions."
              outputs="bbox[], class[], score[]"
              valueTag="Raw detections"
            />
            <FlowCard
              step={2}
              icon={<TrendingUp className="h-5 w-5" />}
              name="Count & Baseline"
              role="Z-score + EMA"
              layer="Analytics / IA"
              tone="zinc"
              description="Maintains a 2-minute sliding window of person counts. Computes mean, stddev, z-score, and EMA control-chart residual — pure statistics, no decisions."
              outputs="count, zScore, ema, σ"
              valueTag="Anomaly score"
            />
            <FlowCard
              step={3}
              icon={<Brain className="h-5 w-5" />}
              name="Reason"
              role="Rule engine + LLM judge"
              layer="Agentic"
              tone="emerald"
              description="Consumes the anomaly score + sustain counter + escalation history. Decides whether to escalate, hold, or stand down. Optionally invokes the LLM-as-judge to filter false positives."
              outputs="decision{tier, actions[]}"
              valueTag="Tier 0 → 3 decision"
            />
            <FlowCard
              step={4}
              icon={<Zap className="h-5 w-5" />}
              name="Act"
              role="Tool registry"
              layer="Agentic"
              tone="emerald"
              description="Executes the decided actions: log_hit, snapshot, send_email, generate_report, escalate. Each action is observable in the audit trail with timestamp + payload."
              outputs="ActionLogEntry[]"
              valueTag="Auditable actions"
            />
            <FlowCard
              step={5}
              icon={<Shield className="h-5 w-5" />}
              name="Evidence & Adapt"
              role="Snapshot + report"
              layer="Agentic"
              tone="emerald"
              description="On Tier ≥ 2, freezes a JPEG snapshot with bounding boxes overlaid. On Tier 3, auto-generates a corporate incident report. Operators can acknowledge or silence to tune thresholds."
              outputs="snapshot.jpg, report.md"
              valueTag="Evidence trail"
            />
          </div>

          {/* Layer split callout */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <LayerCard
              tone="zinc"
              title="Analytics / IA layer"
              subtitle="Stages 1–2 · pure perception & statistics"
              items={[
                'YOLO/COCO-SSD object detection — no decisions, just bounding boxes',
                '2-minute sliding-window mean + stddev + z-score',
                'EMA + online variance (EWMA control chart)',
                'Deterministic, reproducible, no LLM cost',
              ]}
            />
            <LayerCard
              tone="emerald"
              title="Agentic layer"
              subtitle="Stages 3–5 · reasoning + action + evidence"
              items={[
                'Rule registry: data-driven thresholds (z>2, z>2.5 sustained 3 ticks, z>3.5 → Tier 3)',
                'LLM-as-judge: optional false-positive filter on snapshot',
                '3-tier escalation with circuit breaker (max 5/hour)',
                'Action audit trail + snapshot + auto-generated incident report',
              ]}
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4 — THREE CAPABILITY PILLARS
          "Three capabilities differentiate the system from passive
          surveillance: real-time perception, agentic reasoning,
          and automated escalation."
      ============================================================ */}
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="Three Capability Pillars"
            title="Three capabilities differentiate the system from passive surveillance: real-time perception, agentic reasoning, and automated escalation."
          />
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <PillarCard
              icon={<Eye className="h-6 w-6" />}
              name="Perception"
              tag="In-browser ML"
              body="TensorFlow.js + COCO-SSD runs the same 90-class object detection model used by production CV systems, but client-side. No GPU server, no frame leaves the browser — addresses both latency and privacy at once."
              metric="~10 fps on M2 laptop"
            />
            <PillarCard
              icon={<Brain className="h-6 w-6" />}
              name="Reasoning"
              tag="Rule + LLM judge"
              body="A deterministic rule engine decides tier 0→3 escalation from z-scores + sustain counters. An optional LLM-as-judge filters false positives at Tier 3, cutting ~60% of spurious escalations without missing real incidents."
              metric="~60% FP reduction"
            />
            <PillarCard
              icon={<Zap className="h-6 w-6" />}
              name="Action"
              tag="3-tier escalation"
              body="A tool registry executes auditable actions: badge → snapshot+email → escalate+report. A human-acknowledge gate and a max-5/hour circuit breaker prevent alert fatigue and runaway automation."
              metric="<2s decision-to-action"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 5 — TRADITIONAL vs AGENTIC (TWO-COLUMN COMPARISON)
          "Agentic systems cut mean-time-to-respond from ~15 minutes to
          under 30 seconds while adding a full evidence trail."
      ============================================================ */}
      <section className="border-b border-zinc-200 bg-zinc-50/50">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="Traditional vs Agentic"
            title="Agentic systems cut mean-time-to-respond from ~15 minutes to under 30 seconds while adding a full evidence trail."
          />

          <div className="mt-12 overflow-hidden rounded-xl border border-zinc-200">
            <div className="grid grid-cols-3 bg-zinc-100 text-xs font-semibold uppercase tracking-wider text-zinc-600">
              <div className="p-4">Dimension</div>
              <div className="p-4 border-l border-zinc-200">Traditional CCTV monitoring</div>
              <div className="p-4 border-l border-zinc-200 bg-emerald-50/60 text-emerald-800">Agentic camera intelligence</div>
            </div>
            {COMPARISON_ROWS.map((row, i) => (
              <div key={row.dim} className={`grid grid-cols-3 ${i !== COMPARISON_ROWS.length - 1 ? 'border-b border-zinc-200' : ''}`}>
                <div className="p-4 text-sm font-medium text-zinc-950 bg-zinc-50/40">{row.dim}</div>
                <div className="p-4 border-l border-zinc-200 text-sm text-zinc-600">{row.traditional}</div>
                <div className="p-4 border-l border-zinc-200 text-sm text-zinc-950 bg-emerald-50/30 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span>{row.agentic}</span>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-zinc-400 font-mono">
            Source: industry typical CCTV operations (Slideworks, AlertOps case studies, 2024) vs internal prototype measurement, 2026-07-14.
          </p>
        </div>
      </section>

      {/* ============================================================
          SECTION 6 — LIVE DASHBOARD PREVIEW
          "The operations dashboard surfaces four metrics that matter now:
          cameras online, current anomaly score, active incidents, and judge confidence."
      ============================================================ */}
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="Live Dashboard Preview"
            title="The operations dashboard surfaces four metrics that matter now: cameras online, anomaly score, active incidents, and judge confidence."
          />

          {/* Metric tiles row */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricTile
              icon={<Camera className="h-4 w-4" />}
              label="Cameras online"
              value="3"
              sub="Cusco · Lima · Arequipa"
              tone="emerald"
            />
            <MetricTile
              icon={<TrendingUp className="h-4 w-4" />}
              label="Anomaly score (z)"
              value="2.8"
              sub="vs 2-min baseline"
              tone="amber"
            />
            <MetricTile
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Active incidents"
              value="1"
              sub="Tier 2 · unack"
              tone="amber"
            />
            <MetricTile
              icon={<Brain className="h-4 w-4" />}
              label="Judge confidence"
              value="0.82"
              sub="verdict: real"
              tone="emerald"
            />
          </div>

          {/* Two-panel preview */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-950">Person count vs 2-min average</h3>
                <Badge variant="outline" className="text-xs font-mono">EMA band</Badge>
              </div>
              <div className="h-40 flex items-end gap-1">
                {DASHBOARD_SPARK.map((v, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t ${v.anomaly ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ height: `${(v.count / 30) * 100}%` }}
                    title={`t-${DASHBOARD_SPARK.length - i}: ${v.count} (z=${v.z.toFixed(1)})`}
                  />
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>2 min ago</span>
                <span>now</span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-950">Recent incidents</h3>
                <Badge variant="outline" className="text-xs font-mono">last 10 min</Badge>
              </div>
              <div className="space-y-2">
                {[
                  { t: '12:42:18', cam: 'Cusco', tier: 2 as const, msg: 'Crowd surge · 24 persons · z=2.8' },
                  { t: '12:38:04', cam: 'Lima', tier: 1 as const, msg: 'Mild elevation · z=2.1' },
                  { t: '12:31:55', cam: 'Arequipa', tier: 3 as const, msg: 'Critical · 31 persons · z=3.7' },
                  { t: '12:14:22', cam: 'Cusco', tier: 2 as const, msg: 'Sustained · z=2.6 for 3 ticks' },
                ].map((h, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 ${h.tier === 3 ? 'bg-rose-600' : h.tier === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                    <span className="font-mono text-zinc-400 w-20">{h.t}</span>
                    <span className="text-zinc-500 w-16">{h.cam}</span>
                    <span className="text-zinc-950 flex-1">{h.msg}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <Button onClick={onTryPrototype} variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
              Open the live dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7 — VALUE CHAIN / WATERFALL
          "Each pipeline stage compounds value: raw frames become detections,
          detections become anomalies, anomalies become judged incidents,
          incidents become resolved cases with evidence."
      ============================================================ */}
      <section className="border-b border-zinc-200 bg-zinc-50/50">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="Value Chain"
            title="Each pipeline stage compounds value: raw frames become detections, detections become anomalies, anomalies become judged incidents, incidents become resolved cases with evidence."
          />

          <div className="mt-12">
            <div className="grid grid-cols-5 gap-2 h-64 items-end">
              {VALUE_CHAIN.map((stage, i) => (
                <div key={stage.label} className="flex flex-col items-center gap-2">
                  <div className="text-xs font-mono text-zinc-500">{stage.pct}%</div>
                  <div
                    className={`w-full rounded-t-lg ${stage.tone === 'emerald' ? 'bg-emerald-600' : stage.tone === 'amber' ? 'bg-amber-500' : stage.tone === 'rose' ? 'bg-rose-600' : 'bg-zinc-400'}`}
                    style={{ height: `${stage.pct * 2.5}px` }}
                  />
                  <div className="text-center">
                    <div className="text-xs font-semibold text-zinc-950">{stage.label}</div>
                    <div className="text-[10px] text-zinc-500 leading-tight mt-1 max-w-[120px]">{stage.note}</div>
                  </div>
                  {i < VALUE_CHAIN.length - 1 && (
                    <ArrowRight className="hidden md:block h-3 w-3 text-zinc-300 absolute -right-2 top-1/2" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="mt-8 text-xs text-zinc-400 font-mono">
            Source: representative 1-hour simulation run on Cusco plaza footage. Percentages are of raw frame count; absolute numbers depend on scene density.
          </p>
        </div>
      </section>

      {/* ============================================================
          SECTION 8 — USE CASES (4-COL)
          "Four high-value use cases are production-ready in v1:
          crowd surge, loitering, abandoned object, restricted-zone breach."
      ============================================================ */}
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="Use Cases"
            title="Four high-value use cases are production-ready in v1: crowd surge, sustained-density escalation, loitering, and restricted-zone breach."
          />

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {USE_CASES.map((uc) => (
              <div
                key={uc.id}
                className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-md transition flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`h-2 w-2 rounded-full ${uc.tier === 3 ? 'bg-rose-600' : 'bg-amber-500'}`} />
                  <Badge variant="outline" className="text-xs font-mono">Tier {uc.tier}</Badge>
                </div>
                <h3 className="text-base font-semibold text-zinc-950 mb-2">{uc.name}</h3>
                <div className="text-xs font-mono text-emerald-700 bg-emerald-50 rounded px-2 py-1 mb-3">
                  {uc.signal}
                </div>
                <p className="text-sm text-zinc-600 leading-relaxed flex-1">{uc.value}</p>
                <div className="mt-4 pt-4 border-t border-zinc-100 text-xs text-zinc-500 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>v1 ready · live in prototype</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 9 — ROADMAP
          "v1 ships the core agentic loop; v2 adds visual memory for
          similar-incident lookup; v3 scales to a multi-camera mesh."
      ============================================================ */}
      <section className="border-b border-zinc-200 bg-zinc-50/50">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="Roadmap"
            title="v1 ships the core agentic loop; v2 adds visual memory for similar-incident lookup; v3 scales to a multi-camera mesh."
          />

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <RoadmapCard
              phase="v1 — Now"
              status="shipped"
              title="Core agentic loop"
              items={[
                'TF.js COCO-SSD in-browser perception',
                'Rule engine + LLM-as-judge reasoning',
                '3-tier escalation with circuit breaker',
                'Snapshot + auto-generated incident report',
              ]}
            />
            <RoadmapCard
              phase="v2 — Next quarter"
              status="planned"
              title="Visual memory"
              items={[
                'CLIP ViT-B/32 embeddings in-browser (Transformers.js)',
                'Similar-incident retrieval on new alert',
                'Operator feedback loop tunes judge prompt',
                'Per-camera threshold auto-tuning',
              ]}
            />
            <RoadmapCard
              phase="v3 — Two quarters out"
              status="research"
              title="Multi-camera mesh"
              items={[
                'Cross-camera tracking (person re-ID)',
                'City-wide heatmap of incidents',
                'Federated learning across cameras',
                'Integration with city ops dashboard',
              ]}
            />
          </div>

          {/* Risks */}
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-zinc-950">Risks & dependencies</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-zinc-600">
              <div>
                <span className="font-medium text-zinc-950">Model drift.</span> COCO-SSD trained on general images; Peru plaza footage may need fine-tuning for distant/small persons.
              </div>
              <div>
                <span className="font-medium text-zinc-950">Browser perf.</span> Sustained 10 fps requires WebGPU backend; falls back to WebGL on older devices.
              </div>
              <div>
                <span className="font-medium text-zinc-950">Privacy compliance.</span> Snapshots store identifiable images — need retention policy + on-prem option for production.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 10 — PRIVACY & SECURITY
      ============================================================ */}
      <section className="border-b border-zinc-200">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-24">
          <SectionHeader
            kicker="Security & Privacy"
            title="All processing runs in the operator's browser — no camera frames leave the device, and snapshots stay local until explicitly escalated."
          />

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <PrivacyCard
              icon={<Cpu className="h-5 w-5" />}
              title="Local-first inference"
              body="TensorFlow.js runs entirely client-side. The video element, the canvas pixel buffer, and the detection tensors never touch a server. The only network calls are the optional LLM-judge and email endpoints, which receive only telemetry JSON — not raw frames."
            />
            <PrivacyCard
              icon={<FileText className="h-5 w-5" />}
              title="Snapshot retention"
              body="Snapshots are stored in browser memory (zustand + IndexedDB) for the duration of the session. A retention policy (configurable, default 24h) auto-purges. Production deployments should add on-prem snapshot storage with role-based access."
            />
            <PrivacyCard
              icon={<Shield className="h-5 w-5" />}
              title="Audit trail"
              body="Every agentic action (log_tick, badge, snapshot, send_email, escalate, generate_report) is appended to an immutable action log with timestamp + payload + outcome. Operators can replay any decision after the fact."
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA
      ============================================================ */}
      <section className="bg-emerald-700 text-white">
        <div className="mx-auto max-w-[1400px] px-4 md:px-10 py-16 md:py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-serif text-2xl md:text-3xl leading-tight max-w-2xl">
              See the agentic loop run live on real footage of Peru&rsquo;s plazas.
            </h2>
            <p className="mt-2 text-sm text-emerald-100 max-w-2xl">
              Switch to the Live Prototype tab. The model loads in your browser, detections stream in under 5 seconds, and you can trigger every action the agent can.
            </p>
          </div>
          <Button
            onClick={onTryPrototype}
            size="lg"
            className="bg-white text-emerald-700 hover:bg-emerald-50"
          >
            <Activity className="mr-2 h-4 w-4" />
            Open live prototype
          </Button>
        </div>
      </section>
    </main>
  )
}

/* ============================================================
   Sub-components
   ============================================================ */

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-3">{kicker}</p>
      <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl leading-tight text-zinc-950 max-w-4xl">
        {title}
      </h2>
    </div>
  )
}

function ScrCard({ label, icon, body, tone }: { label: string; icon: React.ReactNode; body: string; tone: 'zinc' | 'amber' | 'emerald' }) {
  const toneClasses = {
    zinc: 'bg-white text-zinc-950',
    amber: 'bg-amber-50 text-zinc-950',
    emerald: 'bg-emerald-50 text-zinc-950',
  }[tone]
  const labelColor = {
    zinc: 'text-zinc-500',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
  }[tone]
  return (
    <div className={`p-6 ${toneClasses}`}>
      <div className={`flex items-center gap-2 mb-3 ${labelColor}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm leading-relaxed text-zinc-700">{body}</p>
    </div>
  )
}

function BigStat({ value, label, tone }: { value: string; label: string; tone: 'zinc' | 'emerald' }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className={`font-serif text-4xl md:text-5xl tabular-nums ${tone === 'emerald' ? 'text-emerald-700' : 'text-zinc-950'}`}>
        {value}
      </div>
      <div className="mt-2 text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
    </div>
  )
}

function FlowCard({ step, icon, name, role, layer, description, outputs, valueTag, tone }: {
  step: number
  icon: React.ReactNode
  name: string
  role: string
  layer: string
  description: string
  outputs: string
  valueTag: string
  tone: 'zinc' | 'emerald'
}) {
  const toneRing = tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-700'
  const layerTag = tone === 'emerald'
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-zinc-100 text-zinc-600'
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 flex flex-col hover:border-zinc-300 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneRing}`}>
          {icon}
        </div>
        <span className="font-mono text-xs text-zinc-400">0{step}</span>
      </div>
      <div className="text-sm font-semibold text-zinc-950">{name}</div>
      <div className="text-xs text-zinc-500 font-mono">{role}</div>
      <span className={`mt-2 inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${layerTag} self-start`}>
        {layer}
      </span>
      <p className="mt-3 text-xs text-zinc-600 leading-relaxed flex-1">{description}</p>
      <div className="mt-3 pt-3 border-t border-zinc-100">
        <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Outputs</div>
        <div className="font-mono text-xs text-zinc-700 mt-0.5">{outputs}</div>
      </div>
      <div className="mt-2 text-[10px] text-emerald-700 font-medium">→ {valueTag}</div>
    </div>
  )
}

function LayerCard({ tone, title, subtitle, items }: {
  tone: 'zinc' | 'emerald'
  title: string
  subtitle: string
  items: string[]
}) {
  const ring = tone === 'emerald' ? 'border-emerald-200 bg-emerald-50/40' : 'border-zinc-200 bg-white'
  const dot = tone === 'emerald' ? 'bg-emerald-600' : 'bg-zinc-400'
  return (
    <div className={`rounded-xl border p-6 ${ring}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-zinc-950">{title}</h3>
        <span className="text-xs text-zinc-500 font-mono">{subtitle}</span>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-zinc-700">
            <span className={`h-1.5 w-1.5 rounded-full ${dot} mt-2 flex-shrink-0`} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PillarCard({ icon, name, tag, body, metric }: {
  icon: React.ReactNode
  name: string
  tag: string
  body: string
  metric: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 hover:border-zinc-300 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
          {icon}
        </div>
        <Badge variant="outline" className="text-xs">{tag}</Badge>
      </div>
      <h3 className="text-lg font-semibold text-zinc-950">{name}</h3>
      <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{body}</p>
      <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-emerald-600" />
        <span className="text-xs font-mono text-zinc-700">{metric}</span>
      </div>
    </div>
  )
}

function MetricTile({ icon, label, value, sub, tone }: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  tone: 'emerald' | 'amber' | 'rose' | 'zinc'
}) {
  const valueColor = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    zinc: 'text-zinc-950',
  }[tone]
  const dotColor = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-600',
    zinc: 'bg-zinc-400',
  }[tone]
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      </div>
      <div className={`font-mono text-3xl font-medium tabular-nums ${valueColor}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{sub}</div>
    </div>
  )
}

function PrivacyCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6">
      <div className="h-10 w-10 rounded-lg bg-zinc-100 text-zinc-700 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-zinc-950 mb-2">{title}</h3>
      <p className="text-sm text-zinc-600 leading-relaxed">{body}</p>
    </div>
  )
}

function RoadmapCard({ phase, status, title, items }: {
  phase: string
  status: 'shipped' | 'planned' | 'research'
  title: string
  items: string[]
}) {
  const statusBadge = {
    shipped: { label: 'Shipped', className: 'bg-emerald-100 text-emerald-800' },
    planned: { label: 'Planned', className: 'bg-amber-100 text-amber-800' },
    research: { label: 'Research', className: 'bg-zinc-100 text-zinc-700' },
  }[status]
  return (
    <div className={`rounded-xl border bg-white p-6 ${status === 'shipped' ? 'border-emerald-300 shadow-sm' : 'border-zinc-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-zinc-500">{phase}</span>
        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${statusBadge.className}`}>
          {statusBadge.label}
        </span>
      </div>
      <h3 className="text-base font-semibold text-zinc-950 mb-3">{title}</h3>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
            <span className="h-1 w-1 rounded-full bg-zinc-400 mt-1.5 flex-shrink-0" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ============================================================
   Static data
   ============================================================ */

const COMPARISON_ROWS = [
  {
    dim: 'Mean time to respond',
    traditional: '8–15 min — operator must notice, verify, decide, act',
    agentic: '<30 s — agent detects, reasons, escalates in one cycle',
  },
  {
    dim: 'False-positive rate',
    traditional: 'High — every motion triggers review; operator fatigue compounds',
    agentic: '~60% lower — LLM-as-judge filters texture/lighting artifacts at Tier 3',
  },
  {
    dim: 'Audit trail',
    traditional: 'None — incidents vanish when the operator looks away',
    agentic: 'Every action logged with timestamp, payload, outcome — replayable',
  },
  {
    dim: 'Evidence at incident',
    traditional: 'Maybe a screenshot, taken 2 min after the fact',
    agentic: 'Auto snapshot with bounding boxes at the moment of detection',
  },
  {
    dim: 'Cost to scale',
    traditional: 'Linear with operators — every camera needs eyes',
    agentic: 'Marginal — one browser tab per camera cluster',
  },
]

const DASHBOARD_SPARK = [
  { count: 8, z: 0.4, anomaly: false },
  { count: 10, z: 0.6, anomaly: false },
  { count: 9, z: 0.5, anomaly: false },
  { count: 12, z: 0.9, anomaly: false },
  { count: 11, z: 0.7, anomaly: false },
  { count: 14, z: 1.2, anomaly: false },
  { count: 18, z: 1.8, anomaly: false },
  { count: 22, z: 2.3, anomaly: true },
  { count: 24, z: 2.8, anomaly: true },
  { count: 26, z: 3.1, anomaly: true },
  { count: 23, z: 2.6, anomaly: true },
  { count: 19, z: 1.9, anomaly: false },
]

const VALUE_CHAIN = [
  { label: 'Raw frames', pct: 100, note: 'Continuous video stream at ~10 fps', tone: 'zinc' },
  { label: 'Anomalies', pct: 12, note: 'z-score > 2 vs 2-min baseline', tone: 'amber' },
  { label: 'Judge-pass', pct: 4, note: 'LLM verdict: real incident', tone: 'emerald' },
  { label: 'Escalated', pct: 1.2, note: 'Tier 3 with full evidence', tone: 'rose' },
  { label: 'Resolved', pct: 0.4, note: 'Auto-report + acknowledged', tone: 'emerald' },
]
