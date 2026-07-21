'use client'

import { useEffect } from 'react'
import { usePrototypeStore, CAMERA_SOURCES } from '@/lib/store'
import { USE_CASES, LEVEL_LABELS, type CapabilityLevel } from '@/lib/use-cases'
import { hasSpecializedModel, getSpecializedModelInfo } from '@/lib/specialized-models'
import { getPixelAnomalyType } from '@/lib/pixel-anomaly'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Shield, Users, Car, Flame, Package, Mountain, Droplet, Activity, Zap, Brain, MessageSquare, Moon, List, AlertTriangle, SprayCan } from 'lucide-react'

const ICONS: Record<string, React.ReactNode> = {
  shield: <Shield className="h-3.5 w-3.5" />,
  users: <Users className="h-3.5 w-3.5" />,
  car: <Car className="h-3.5 w-3.5" />,
  flame: <Flame className="h-3.5 w-3.5" />,
  package: <Package className="h-3.5 w-3.5" />,
  mountain: <Mountain className="h-3.5 w-3.5" />,
  droplet: <Droplet className="h-3.5 w-3.5" />,
  activity: <Activity className="h-3.5 w-3.5" />,
  zap: <Zap className="h-3.5 w-3.5" />,
  brain: <Brain className="h-3.5 w-3.5" />,
  message: <MessageSquare className="h-3.5 w-3.5" />,
  moon: <Moon className="h-3.5 w-3.5" />,
  list: <List className="h-3.5 w-3.5" />,
  alert: <AlertTriangle className="h-3.5 w-3.5" />,
  spraycan: <SprayCan className="h-3.5 w-3.5" />,
}

const LEVEL_ORDER: CapabilityLevel[] = ['traditional', 'mldl', 'cognitive', 'agentic']

export function UseCaseSelector() {
  const activeUseCaseId = usePrototypeStore((s) => s.activeUseCaseId)
  const setActiveUseCase = usePrototypeStore((s) => s.setActiveUseCase)
  const setActiveCamera = usePrototypeStore((s) => s.setActiveCamera)
  const capabilityLevel = usePrototypeStore((s) => s.capabilityLevel)
  const setCapabilityLevel = usePrototypeStore((s) => s.setCapabilityLevel)

  const activeUseCase = USE_CASES.find((uc) => uc.id === activeUseCaseId)

  // Expose USE_CASES + CAMERA_SOURCES on window for the dev-only test hook
  // (see src/lib/store.ts → window.__visionStore.setActiveUseCase).
  // Runs once on mount; safe to re-run.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // @ts-expect-error dev tooling
      window.__USE_CASES__ = USE_CASES
      // @ts-expect-error dev tooling
      window.__CAMERA_SOURCES__ = CAMERA_SOURCES
    }
  }, [])

  /** Auto-switch to the best camera for the selected use case. */
  function selectUseCase(useCaseId: string) {
    const uc = USE_CASES.find(u => u.id === useCaseId)
    if (!uc) return
    setActiveUseCase(useCaseId)
    setCapabilityLevel(uc.level)
    // Find the best camera for this use case
    const bestCamera = CAMERA_SOURCES.find(c => c.useCases?.includes(useCaseId))
    if (bestCamera) {
      setActiveCamera(bestCamera.id)
    }
  }

  return (
    <div className="space-y-2">
      {/* ELI5 hint */}
      <div className="rounded-md bg-emerald-50 border border-emerald-100 px-3 py-1.5 text-[10px] text-zinc-600 leading-relaxed">
        💡 <strong>¿Cómo usar esto?</strong> Elija un <strong>caso de uso</strong> (qué quiere detectar) y un
        <strong> nivel de capacidad</strong> (qué tan autónomo es el sistema):
        <span className="text-zinc-500"> Tradicional = solo reglas</span> ·
        <span className="text-zinc-600"> ML/DL = detecta con IA</span> ·
        <span className="text-amber-600"> Cognitiva = describe con IA</span> ·
        <span className="text-emerald-700"> Autónoma = decide y actúa solo</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
      {/* Use case selector */}
      <Select value={activeUseCaseId} onValueChange={(v) => selectUseCase(v)}>
        <SelectTrigger className="w-[280px] h-9 bg-white">
          <SelectValue placeholder="Select use case" />
        </SelectTrigger>
        <SelectContent>
          {USE_CASES.map((uc) => (
            <SelectItem key={uc.id} value={uc.id}>
              <span className="flex items-center gap-2">
                {ICONS[uc.icon]}
                <span className="font-medium">{uc.name}</span>
                <Badge variant="outline" className="text-[9px] ml-1">{uc.category === 'disaster' ? 'Desastre' : 'Comercial'}</Badge>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Four-level capability switcher */}
      <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-0.5">
        {LEVEL_ORDER.map((level) => {
          const label = LEVEL_LABELS[level]
          const isActive = capabilityLevel === level
          const hex = `#${label.color}`
          return (
            <button
              key={level}
              onClick={() => setCapabilityLevel(level)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition ${
                isActive ? 'text-white' : 'text-zinc-600 hover:text-zinc-900'
              }`}
              style={isActive ? { backgroundColor: hex } : {}}
              title={label.en}
            >
              {label.es}
            </button>
          )
        })}
      </div>

      {/* Active use case description */}
      {activeUseCase && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          <span className="font-mono">Regla:</span>
          <span>{activeUseCase.ruleType}</span>
          <span>·</span>
          <span>Nivel: {LEVEL_LABELS[activeUseCase.level].es}</span>
          {hasSpecializedModel(activeUseCase.id) && (
            <Badge className="text-[9px] h-4 px-1 bg-purple-100 text-purple-800 hover:bg-purple-100">
              🤗 HF Model: {getSpecializedModelInfo(activeUseCase.id)?.modelName}
            </Badge>
          )}
          {!hasSpecializedModel(activeUseCase.id) && getPixelAnomalyType(activeUseCase.id) && (
            <Badge className="text-[9px] h-4 px-1 bg-blue-100 text-blue-800 hover:bg-blue-100">
              📊 Pixel: {getPixelAnomalyType(activeUseCase.id)}
            </Badge>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
