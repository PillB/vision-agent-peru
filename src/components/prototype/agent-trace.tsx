'use client'

import { Brain, Cog, RotateCw } from 'lucide-react'
import { usePrototypeStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

export function AgentTrace() {
  const trace = usePrototypeStore((s) => s.agentTrace)
  const agentReasoning = usePrototypeStore((s) => s.agentReasoning)
  const currentTier = usePrototypeStore((s) => s.currentTier)
  const agentCycleCount = usePrototypeStore((s) => s.agentCycleCount)
  const llmJudgeEnabled = usePrototypeStore((s) => s.llmJudgeEnabled)
  const setLlmJudgeEnabled = usePrototypeStore((s) => s.setLlmJudgeEnabled)
  const agentConfig = usePrototypeStore((s) => s.agentConfig)
  const setAgentConfig = usePrototypeStore((s) => s.setAgentConfig)
  const pushTrace = usePrototypeStore((s) => s.pushTrace)

  const tierColor = currentTier === 3 ? 'bg-rose-600' : currentTier === 2 ? 'bg-amber-500' : currentTier === 1 ? 'bg-amber-400' : 'bg-emerald-500'
  const tierLabel = currentTier === 3 ? 'CRITICAL' : currentTier === 2 ? 'ANOMALY' : currentTier === 1 ? 'WATCH' : 'NOMINAL'

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Agent reasoning</h3>
        </div>
        <div className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded text-white ${tierColor}`}>
          Tier {currentTier} · {tierLabel}
        </div>
      </div>
      {/* ELI5 hint */}
      <div className="mb-3 rounded-md bg-zinc-50 border border-zinc-100 px-2.5 py-1.5 text-[10px] text-zinc-500 leading-relaxed">
        💡 <strong>¿Qué hace el agente?</strong> En cada ciclo: percibe (detecta), razona (decide si es anomalía),
        actúa (snapshot/email/reporte) y reflexiona (juez LLM filtra falsos positivos).
        El <strong>Tier</strong> indica la severidad: 0=normal, 1=vigilancia, 2=anomalía, 3=crítico.
      </div>

      {/* Live status line */}
      <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 mb-3">
        <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Current cycle</div>
        <div className="text-xs text-zinc-950 font-mono leading-snug break-words">{agentReasoning}</div>
        <div className="mt-2 flex items-center gap-3 text-[10px] text-zinc-500">
          <span>Cycle #{agentCycleCount}</span>
          <span className="flex items-center gap-1">
            <RotateCw className="h-3 w-3" />
            1 Hz
          </span>
        </div>
      </div>

      {/* LLM judge toggle */}
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-2.5 mb-3">
        <div>
          <div className="text-xs font-medium text-zinc-950">LLM-as-judge</div>
          <div className="text-[10px] text-zinc-500">Filter false positives at Tier 3</div>
        </div>
        <Switch checked={llmJudgeEnabled} onCheckedChange={setLlmJudgeEnabled} />
      </div>

      {/* Tier 2 threshold slider */}
      <div className="rounded-lg border border-zinc-200 p-2.5 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Tier 2 threshold (z)</span>
          <span className="font-mono text-xs text-zinc-950">{agentConfig.t2Z.toFixed(1)}</span>
        </div>
        <Slider
          value={[agentConfig.t2Z]}
          onValueChange={(v) => setAgentConfig({ t2Z: v[0] })}
          min={1.5}
          max={4}
          step={0.1}
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
          <span>1.5 (sensitive)</span>
          <span>4.0 (strict)</span>
        </div>
      </div>

      {/* Tier 3 threshold slider */}
      <div className="rounded-lg border border-zinc-200 p-2.5 mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">Tier 3 threshold (z)</span>
          <span className="font-mono text-xs text-zinc-950">{agentConfig.t3Z.toFixed(1)}</span>
        </div>
        <Slider
          value={[agentConfig.t3Z]}
          onValueChange={(v) => setAgentConfig({ t3Z: v[0] })}
          min={2.5}
          max={5}
          step={0.1}
        />
        <div className="flex items-center justify-between text-[10px] text-zinc-400 mt-1">
          <span>2.5 (sensitive)</span>
          <span>5.0 (strict)</span>
        </div>
      </div>

      {/* Trace */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500 flex items-center gap-1">
          <Cog className="h-3 w-3" />
          Reasoning trace
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="h-5 text-[10px]"
          onClick={() => pushTrace('--- trace cleared ---')}
        >
          Clear
        </Button>
      </div>
      <ScrollArea className="flex-1 max-h-[260px] pr-2">
        <div className="space-y-0.5 font-mono text-[10px] leading-relaxed">
          {trace.length === 0 ? (
            <div className="text-zinc-400 italic py-4 text-center">No cycles yet. Start analysis.</div>
          ) : (
            trace.map((line, i) => (
              <div key={i} className={`px-1.5 py-0.5 rounded ${i === 0 ? 'bg-emerald-50 text-emerald-900' : 'text-zinc-600'}`}>
                {line}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
