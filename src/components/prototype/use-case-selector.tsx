'use client'

import { usePrototypeStore } from '@/lib/store'
import { USE_CASES, LEVEL_LABELS, type CapabilityLevel } from '@/lib/use-cases'
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
  const capabilityLevel = usePrototypeStore((s) => s.capabilityLevel)
  const setCapabilityLevel = usePrototypeStore((s) => s.setCapabilityLevel)

  const activeUseCase = USE_CASES.find((uc) => uc.id === activeUseCaseId)

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Use case selector */}
      <Select value={activeUseCaseId} onValueChange={(v) => { setActiveUseCase(v); const uc = USE_CASES.find(u => u.id === v); if (uc) setCapabilityLevel(uc.level) }}>
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
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-mono">Regla:</span>
          <span>{activeUseCase.ruleType}</span>
          <span>·</span>
          <span>Nivel: {LEVEL_LABELS[activeUseCase.level].es}</span>
        </div>
      )}
    </div>
  )
}
