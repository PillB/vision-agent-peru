'use client'

import { useTranslations } from 'next-intl'
import { CameraView } from './prototype/camera-view'
import { MetricsRow } from './prototype/metrics-row'
import { CountChart } from './prototype/count-chart'
import { AlertsPanel } from './prototype/alerts-panel'
import { AgentTrace } from './prototype/agent-trace'
import { ActionsPanel } from './prototype/actions-panel'
import { ReportsPanel } from './prototype/reports-panel'
import { EvidencePanel } from './prototype/evidence-panel'
import { NLSearchPanel } from './prototype/nl-search-panel'
import { IncidentPanel } from './prototype/incident-panel'
import { CoOccurrenceGraph } from './prototype/co-occurrence-graph'
import { UseCaseSelector } from './prototype/use-case-selector'
import { IdentityPanel } from './prototype/identity-panel'
import { AgentDecisionFlow } from './prototype/agent-decision-flow'
import { usePrototypeStore } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'
import type { CoOccurrenceNetwork } from '@/lib/subject-reid'
import type { StoredCoOccurrenceSlice } from '@/lib/store'

function toGraphNetwork(data: StoredCoOccurrenceSlice): CoOccurrenceNetwork {
  return {
    nodes: data.nodes.map(node => ({
      trackId: node.trackId,
      firstSeen: node.firstSeen,
      lastSeen: node.lastSeen,
      totalDurationMs: node.totalDurationMs,
      reappearanceCount: node.reappearanceCount,
      detectionCount: node.detectionCount,
      lastClass: node.lastClass,
      coOccurrences: new Map<string, number>(),
    })),
    edges: data.edges.map(edge => ({ ...edge })),
    totalFrames: data.totalFrames,
    totalSubjects: data.totalSubjects,
  }
}

export function Tab2Prototype() {
  const t = useTranslations('Tab2')
  const isRunning = usePrototypeStore((state) => state.isRunning)
  const coOccurrenceData = usePrototypeStore((s) => s.coOccurrenceData)
  const coOccurrenceByFeed = usePrototypeStore((s) => s.coOccurrenceByFeed)

  const network = coOccurrenceData ? toGraphNetwork(coOccurrenceData) : null
  const windowedNetworks = coOccurrenceData ? {
    30000: toGraphNetwork(coOccurrenceData.windows['30000']),
    120000: toGraphNetwork(coOccurrenceData.windows['120000']),
    600000: toGraphNetwork(coOccurrenceData.windows['600000']),
  } : undefined

  return (
    <main aria-label="Live prototype" className="min-h-[calc(100vh-3.5rem-3rem)] min-w-0 bg-zinc-50">
      <div className="mx-auto max-w-[1600px] min-w-0 space-y-3 px-3 py-4 md:space-y-4 md:px-6 md:py-6 [&>*]:min-w-0">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex items-start gap-2 text-xs text-zinc-700">
          <Info className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 leading-relaxed">{t('banner')}</div>
          <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300 text-[10px] flex-shrink-0">
            {isRunning ? t('metrics.live') : (t('metrics.live') === 'Live' ? 'Paused' : 'Pausado')}
          </Badge>
        </div>

        <UseCaseSelector />
        <MetricsRow />
        <AgentDecisionFlow />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 md:gap-4">
          <div className="min-w-0 space-y-3 md:space-y-4 lg:col-span-8">
            <CameraView />
            <CountChart />
          </div>
          <div className="min-w-0 space-y-3 md:space-y-4 lg:col-span-4">
            <AgentTrace />
            <AlertsPanel />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          <IdentityPanel />
          <ActionsPanel />
          <ReportsPanel />
          <div className="lg:col-span-3">
            <EvidencePanel />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          <NLSearchPanel />
          <IncidentPanel />
        </div>

        {/* Local-track entity concurrence + correlation network */}
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-base text-zinc-950">Entity concurrence &amp; correlation</h3>
            <Badge variant="outline" className="text-[9px]">Measured local tracks</Badge>
          </div>
          <p className="text-[10px] text-zinc-500 mb-2">
            Local tracks sharing the same feed and time window. Node size = observation count; edge thickness = an explainable composite of shared frames (35%), duration (25%), proximity (25%) and repeat encounters (15%). The weight is not a calibrated probability. Track IDs reset by source and never establish identity.
          </p>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <CoOccurrenceGraph network={network} windowedNetworks={windowedNetworks} width={640} height={360} />
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3" data-testid="per-feed-correlation-matrix">
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Per-feed analytics matrix</div>
              <p className="mt-1 text-[9px] leading-relaxed text-zinc-500">Each row is an independent source session. No cross-feed identity merge is performed.</p>
              <div className="mt-2 overflow-x-auto" data-allow-horizontal-scroll="true">
                <table className="w-full text-[9px]">
                  <thead className="text-zinc-500"><tr><th className="py-1 text-left">Feed</th><th className="py-1 text-right">Tracks</th><th className="py-1 text-right">Links</th><th className="py-1 text-right">Top weight</th></tr></thead>
                  <tbody>
                    {Object.values(coOccurrenceByFeed).length === 0 ? (
                      <tr><td colSpan={4} className="border-t border-zinc-200 py-4 text-center text-zinc-400">Start analysis on one or more feeds.</td></tr>
                    ) : Object.values(coOccurrenceByFeed).map(feed => (
                      <tr key={feed.cameraId} className="border-t border-zinc-200 text-zinc-700">
                        <td className="max-w-[130px] truncate py-1.5 pr-2" title={feed.cameraLabel}>{feed.cameraLabel}</td>
                        <td className="py-1.5 text-right font-mono">{feed.totalSubjects}</td>
                        <td className="py-1.5 text-right font-mono">{feed.edges.length}</td>
                        <td className="py-1.5 text-right font-mono">{feed.edges[0]?.familiarityScore.toFixed(2) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-600 leading-relaxed">
          <div className="font-semibold text-zinc-950 mb-1">{t('help.title')}</div>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>{t('help.step1')}</li>
            <li>{t('help.step2')}</li>
            <li>{t('help.step3')}</li>
            <li>{t('help.step4')}</li>
            <li>{t('help.step5')}</li>
          </ol>
        </div>
      </div>
    </main>
  )
}
