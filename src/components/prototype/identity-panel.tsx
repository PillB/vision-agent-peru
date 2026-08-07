'use client'

import { usePrototypeStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Users, Car, Info, Clock, Eye } from 'lucide-react'

/**
 * Local tracks exist only inside the active feed and reset on source change.
 * They are continuity hints, not identities or cross-video associations.
 */
export function IdentityPanel() {
  const identities = usePrototypeStore((s) => s.appearanceTracks)

  const persons = identities.filter((i) => i.type === 'person')
  const vehicles = identities.filter((i) => i.type === 'vehicle')

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Local tracks</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono">{persons.length} 👤</Badge>
          <Badge variant="outline" className="text-[10px] font-mono">{vehicles.length} 🚗</Badge>
        </div>
      </div>

      {/* ELI5 explanation */}
      <div className="mb-3 rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-zinc-600 leading-relaxed">
        <Info className="h-3 w-3 text-emerald-500 inline mr-1" />
        <strong>Alcance:</strong> cada ID representa continuidad aproximada dentro
        de este video. Se reinicia al cambiar de fuente y nunca establece identidad.
      </div>

      <ScrollArea className="flex-1 max-h-[280px] pr-2">
        {identities.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            <Eye className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
            Sin pistas locales todavía.
            <br />
            <span className="text-zinc-500">Inicie el análisis para comenzar el rastreo.</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {identities.slice(0, 30).map((id) => (
              <div
                key={id.trackId}
                className="rounded-md border border-zinc-100 bg-zinc-50/50 p-2 flex items-center gap-2"
              >
                {/* Type icon */}
                {id.type === 'person' ? (
                  <Users className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                ) : (
                  <Car className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                )}

                {/* ID + details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-950 truncate">
                      {id.trackId.slice(0, 12)}
                    </span>
                    {id.plateString && (
                      <Badge className="text-[9px] h-4 px-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                        {id.plateString}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{id.observations} obs · {new Date(id.lastSeen).toLocaleTimeString('en-US', { hour12: false })}</span>
                  </div>
                </div>

                {/* Observation count */}
                <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">
                  {id.observations}x
                </Badge>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Scope */}
      <div className="mt-3 pt-2 border-t border-zinc-100 text-[10px] text-zinc-400 space-y-1">
        <div className="flex items-center gap-2">
          <Clock className="h-2.5 w-2.5" />
          <span>Continuidad local aproximada · revisión humana requerida</span>
        </div>
      </div>
    </div>
  )
}
