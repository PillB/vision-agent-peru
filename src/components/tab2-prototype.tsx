'use client'

import { CameraView } from './prototype/camera-view'
import { MetricsRow } from './prototype/metrics-row'
import { CountChart } from './prototype/count-chart'
import { AlertsPanel } from './prototype/alerts-panel'
import { AgentTrace } from './prototype/agent-trace'
import { ActionsPanel } from './prototype/actions-panel'
import { ReportsPanel } from './prototype/reports-panel'
import { usePrototypeStore } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'

export function Tab2Prototype() {
  const isRunning = usePrototypeStore((s) => s.isRunning)

  return (
    <main className="bg-zinc-50 min-h-[calc(100vh-3.5rem-3rem)]">
      <div className="mx-auto max-w-[1600px] px-3 md:px-6 py-4 md:py-6 space-y-3 md:space-y-4">
        {/* Info banner — IA vs Agentic distinction */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex items-start gap-2 text-xs text-zinc-700">
          <Info className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 leading-relaxed">
            <span className="font-medium text-zinc-950">Analytics/IA layer</span> (TF.js COCO-SSD detection + z-score/EMA statistics) feeds the <span className="font-medium text-zinc-950">Agentic layer</span> (rule engine + LLM-as-judge + 3-tier escalation). Every action is logged in the audit trail. Switch cameras, tune thresholds, trigger anomalies.
          </div>
          <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300 text-[10px] flex-shrink-0">
            {isRunning ? 'Live' : 'Paused'}
          </Badge>
        </div>

        {/* Metrics row */}
        <MetricsRow />

        {/* Camera + right column */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
          <div className="lg:col-span-8 space-y-3 md:space-y-4">
            <CameraView />
            <CountChart />
          </div>
          <div className="lg:col-span-4 space-y-3 md:space-y-4">
            <AgentTrace />
            <AlertsPanel />
          </div>
        </div>

        {/* Bottom row — actions + reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          <ActionsPanel />
          <ReportsPanel />
        </div>

        {/* Help footer */}
        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 leading-relaxed">
          <div className="font-semibold text-zinc-950 mb-1">How to use the prototype</div>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Pick a camera (Cusco / Lima / Arequipa — stock footage of real plaza scenes).</li>
            <li>Click <span className="font-mono text-zinc-950">Start analysis</span> — the COCO-SSD model loads (~5s first run) then runs at ~1 Hz.</li>
            <li>Watch the chart fill in. After ~10 seconds the z-score baseline stabilizes; anomalies will trigger T1 (badge) → T2 (snapshot+email) → T3 (LLM judge+report).</li>
            <li>Tune thresholds with the sliders in <span className="font-mono text-zinc-950">Agent reasoning</span>. Toggle the LLM judge on/off.</li>
            <li>Acknowledge hits to silence; or use <span className="font-mono text-zinc-950">Silence 5m</span> for a circuit-breaker pause.</li>
          </ol>
        </div>
      </div>
    </main>
  )
}
