'use client'

import { AlertTriangle, Check, Bell, BellOff } from 'lucide-react'
import { usePrototypeStore, type AlertHit } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

export function AlertsPanel() {
  const hits = usePrototypeStore((s) => s.hits)
  const acknowledgeHit = usePrototypeStore((s) => s.acknowledgeHit)
  const acknowledge = usePrototypeStore((s) => s.acknowledge)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Alerts & incidents</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono">{hits.length}</Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => acknowledge(5)}
            title="Silence alerts for 5 minutes"
          >
            <BellOff className="h-3 w-3 mr-1" />
            Silence 5m
          </Button>
        </div>
      </div>
      {/* ELI5 hint */}
      <div className="mb-3 rounded-md bg-amber-50 border border-amber-100 px-2.5 py-1.5 text-[10px] text-zinc-600 leading-relaxed">
        💡 <strong>¿Qué es esto?</strong> Cuando el agente detecta algo inusual (demasiadas personas,
        intrusión, objeto abandonado), crea una alerta aquí. <strong>Reconocer</strong> = "ya lo vi".
        <strong>Silenciar</strong> = "no me avises por 5 minutos".
      </div>
      <ScrollArea className="flex-1 max-h-[380px] pr-2">
        {hits.length === 0 ? (
          <div className="text-center py-10 text-xs text-zinc-400">
            <Bell className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
            No anomalies detected yet.
            <br />
            <span className="text-zinc-500">Run the analysis to populate this panel.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {hits.map((hit) => (
              <HitCard key={hit.id} hit={hit} onAck={() => acknowledgeHit(hit.id)} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function HitCard({ hit, onAck }: { hit: AlertHit; onAck: () => void }) {
  const tierColor = hit.tier === 3 ? 'bg-rose-600' : hit.tier === 2 ? 'bg-amber-500' : 'bg-emerald-500'
  const tierBg = hit.tier === 3 ? 'bg-rose-50 border-rose-200' : hit.tier === 2 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'

  return (
    <div className={`rounded-lg border p-3 ${hit.acknowledged ? 'bg-zinc-50 border-zinc-200 opacity-70' : tierBg}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${tierColor} ${!hit.acknowledged ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-semibold text-zinc-950">
            Tier {hit.tier} · {hit.cameraLabel}
          </span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">
          {new Date(hit.timestamp).toLocaleTimeString('en-US', { hour12: false })}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[10px] mb-2">
        <div>
          <div className="text-zinc-500 uppercase tracking-wide">Persons</div>
          <div className="font-mono text-zinc-950 text-sm">{hit.count}</div>
        </div>
        <div>
          <div className="text-zinc-500 uppercase tracking-wide">z-score</div>
          <div className="font-mono text-zinc-950 text-sm">{hit.zScore.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-zinc-500 uppercase tracking-wide">Avg (2min)</div>
          <div className="font-mono text-zinc-950 text-sm">{hit.mean.toFixed(1)}</div>
        </div>
      </div>
      <div className="text-[10px] text-zinc-600 mb-2 font-mono leading-snug">{hit.reasoning}</div>
      {hit.snapshotDataUrl && (
        <details className="mb-2">
          <summary className="text-[10px] text-emerald-700 cursor-pointer hover:underline">
            View snapshot evidence
          </summary>
          <img src={hit.snapshotDataUrl} alt="snapshot" className="mt-1 rounded max-h-32 w-full object-cover" />
        </details>
      )}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] ${hit.acknowledged ? 'text-zinc-500' : 'text-emerald-700 font-medium'}`}>
          {hit.acknowledged ? '✓ Acknowledged' : 'Unacknowledged'}
        </span>
        {!hit.acknowledged && (
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={onAck}>
            <Check className="h-3 w-3 mr-1" />
            Acknowledge
          </Button>
        )}
      </div>
    </div>
  )
}
