'use client'

import { usePrototypeStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Users, Car, Info, Clock, Eye } from 'lucide-react'

/**
 * Identity Panel — shows persistent tracked identities (persons + vehicles).
 *
 * ELI5 (Para no técnicos):
 * "Este panel muestra la 'memoria' del sistema. Cada persona o vehículo que
 * aparece en el video recibe un ID único que se mantiene incluso si salen
 * y vuelven a entrar. Es como una lista de visitantes: el sistema anota
 * quién entró, a qué hora, y cuántas veces lo vio."
 *
 * Technical:
 * Displays the global identity gallery maintained by GlobalIdentityManager.
 * Each identity has: globalId, type (person/vehicle), first/last seen,
 * observation count, dominant color swatch, and optional plate string.
 */
export function IdentityPanel() {
  const identities = usePrototypeStore((s) => s.trackedIdentities)

  const persons = identities.filter((i) => i.type === 'person')
  const vehicles = identities.filter((i) => i.type === 'vehicle')

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Identidades Rastreadas</h3>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] font-mono">{persons.length} 👤</Badge>
          <Badge variant="outline" className="text-[10px] font-mono">{vehicles.length} 🚗</Badge>
        </div>
      </div>

      {/* ELI5 explanation */}
      <div className="mb-3 rounded-md bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-zinc-600 leading-relaxed">
        <Info className="h-3 w-3 text-emerald-500 inline mr-1" />
        <strong>¿Qué es esto?</strong> Cada persona o vehículo recibe un ID único.
        El sistema los recuerda incluso si salen del cuadro y vuelven — como una
        lista de visitantes con hora de entrada y salida.
      </div>

      <ScrollArea className="flex-1 max-h-[280px] pr-2">
        {identities.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            <Eye className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
            Sin identidades rastreadas aún.
            <br />
            <span className="text-zinc-500">Inicie el análisis para comenzar el rastreo.</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {identities.slice(0, 30).map((id) => (
              <div
                key={id.globalId}
                className="rounded-md border border-zinc-100 bg-zinc-50/50 p-2 flex items-center gap-2"
              >
                {/* Color swatch */}
                <div
                  className="h-6 w-6 rounded-full flex-shrink-0 border border-zinc-200"
                  style={{ backgroundColor: `rgb(${id.dominantColor[0]}, ${id.dominantColor[1]}, ${id.dominantColor[2]})` }}
                  title="Color dominante (apariencia)"
                />

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
                      {id.globalId.slice(0, 12)}
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

      {/* Legend */}
      <div className="mt-3 pt-2 border-t border-zinc-100 text-[10px] text-zinc-400 space-y-1">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border border-zinc-200" />
          <span>Color dominante — ayuda a distinguir personas/vehículos</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-2.5 w-2.5" />
          <span>Última vez visto · número de observaciones</span>
        </div>
      </div>
    </div>
  )
}
