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
import { usePrototypeStore } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'

export function Tab2Prototype() {
  const t = useTranslations('Tab2')
  const isRunning = usePrototypeStore((state) => state.isRunning)

  return (
    <main aria-label="Live prototype" className="bg-zinc-50 min-h-[calc(100vh-3.5rem-3rem)]">
      <div className="mx-auto max-w-[1600px] px-3 md:px-6 py-4 md:py-6 space-y-3 md:space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex items-start gap-2 text-xs text-zinc-700">
          <Info className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 leading-relaxed">{t('banner')}</div>
          <Badge variant="outline" className="bg-white text-emerald-700 border-emerald-300 text-[10px] flex-shrink-0">
            {isRunning ? t('metrics.live') : (t('metrics.live') === 'Live' ? 'Paused' : 'Pausado')}
          </Badge>
        </div>

        <UseCaseSelector />
        <MetricsRow />

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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 md:gap-4">
          <IdentityPanel />
          <ActionsPanel />
          <ReportsPanel />
          <EvidencePanel />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          <NLSearchPanel />
          <IncidentPanel />
        </div>

        {/* Subject re-identification + co-occurrence network */}
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-serif text-sm text-zinc-950">Subject Co-occurrence Network</h3>
            <Badge variant="outline" className="text-[9px]">Flock-style re-ID</Badge>
          </div>
          <p className="text-[10px] text-zinc-500 mb-2">
            Force-directed graph of subjects sharing the screen. Node size = detection count.
            Edge thickness = familiarity score (Jaccard-normalized co-occurrence).
            Track IDs are NOT identity — appearance similarity does not establish identity.
          </p>
          <div className="flex justify-center">
            <CoOccurrenceGraph network={null} width={500} height={350} />
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
