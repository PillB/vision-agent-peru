'use client'

import { useEffect, useMemo, useState } from 'react'
import { Cpu, ChevronDown, ChevronRight, Zap, HardDrive, Shield, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'


import { getCompatibleModels, getDefaultModel, type ModelOption } from '@/lib/models/registry'
import { usePrototypeStore } from '@/lib/store'

/**
 * Model Selector — lets the user choose which model(s) to use for the active use case.
 *
 * Shows a dropdown of all compatible models with:
 * - Pros/cons
 * - Model size (MB)
 * - Inference speed (fast/medium/slow)
 * - License
 * - Whether it produces bounding boxes
 *
 * The user must select at least one model. The selection persists per use case.
 */
export function ModelSelector() {
  const activeUseCaseId = usePrototypeStore((s) => s.activeUseCaseId)
  const setSelectedModelIds = usePrototypeStore((s) => s.setSelectedModelIds)
  const [expanded, setExpanded] = useState(false)
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null)

  // When use case changes, reset selection to default
  // Using useState with a key-like pattern: store both useCase and selection
  const [selectionState, setSelectionState] = useState<{ useCaseId: string; modelIds: Set<string> }>({
    useCaseId: '',
    modelIds: new Set(),
  })

  useEffect(() => {
    if (!activeUseCaseId || selectionState.useCaseId === activeUseCaseId) return
    const defaultModel = getDefaultModel(activeUseCaseId)
    const newSet = defaultModel
      ? new Set([defaultModel.id])
      : new Set(getCompatibleModels(activeUseCaseId)
        .filter(model => model.adapterImplemented && model.browserReady)
        .slice(0, 1)
        .map(model => model.id))
    setSelectionState({ useCaseId: activeUseCaseId, modelIds: newSet })
    setSelectedModelIds(Array.from(newSet))
  }, [activeUseCaseId, selectionState, setSelectedModelIds])

  const effectiveSelection = useMemo(() => (
    selectionState.useCaseId === activeUseCaseId ? selectionState.modelIds : new Set<string>()
  ), [activeUseCaseId, selectionState])

  if (!activeUseCaseId) return null

  const compatibleModels = getCompatibleModels(activeUseCaseId)
  if (compatibleModels.length <= 1) return null // No choice to offer

  const toggleModel = (modelId: string) => {
    const candidate = compatibleModels.find(model => model.id === modelId)
    if (!candidate?.adapterImplemented || !candidate.browserReady) return
    setSelectionState(prev => {
      const next = new Set(prev.modelIds)
      if (next.has(modelId)) {
        if (next.size > 1) next.delete(modelId)
      } else {
        next.add(modelId)
      }
      // Push to store so detection pipeline can read it
      setSelectedModelIds(Array.from(next))
      return { useCaseId: activeUseCaseId, modelIds: next }
    })
  }

  const speedIcon = (speed: string) => {
    if (speed === 'fast') return <Zap className="h-3 w-3 text-emerald-500" />
    if (speed === 'medium') return <Zap className="h-3 w-3 text-amber-500" />
    return <Zap className="h-3 w-3 text-rose-500" />
  }

  const speedLabel = (speed: string) => {
    if (speed === 'fast') return '~0.5-1s'
    if (speed === 'medium') return '~2-3s'
    return '~5-10s'
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-white">
      {/* Header — click to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-50 transition"
      >
        <div className="flex items-center gap-1.5">
          {expanded ? <ChevronDown className="h-3 w-3 text-zinc-500" /> : <ChevronRight className="h-3 w-3 text-zinc-500" />}
          <Cpu className="h-3 w-3 text-emerald-600" />
          <span className="text-xs font-medium text-zinc-700">Model selection</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1">
            {effectiveSelection.size}/{compatibleModels.length}
          </Badge>
        </div>
        <span className="text-[10px] text-zinc-500">
          {effectiveSelection.size === 1
            ? compatibleModels.find(m => effectiveSelection.has(m.id))?.label
            : `${effectiveSelection.size} models selected`}
        </span>
      </button>

      {/* Model list — collapsible */}
      {expanded && (
        <div className="border-t border-zinc-100 px-2 py-2 space-y-1.5 max-h-[300px] overflow-y-auto">
          <div className="text-[9px] text-zinc-500 mb-1">
            Select at least one model. Multiple models run as an ensemble (MoE).
          </div>
          {compatibleModels.map((model) => {
            const isSelected = effectiveSelection.has(model.id)
            const isExpandedDetail = expandedModelId === model.id

            return (
              <div key={model.id} className={`rounded-md border ${isSelected ? 'border-emerald-300 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
                {/* Model row — click to select/deselect */}
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!model.adapterImplemented || !model.browserReady}
                    aria-label={`Use ${model.label}`}
                    onChange={() => toggleModel(model.id)}
                    className="h-3 w-3 accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    onClick={() => setExpandedModelId(isExpandedDetail ? null : model.id)}
                    className="flex-1 flex items-center gap-1.5 text-left"
                  >
                    {isExpandedDetail ? <ChevronDown className="h-2.5 w-2.5 text-zinc-400" /> : <ChevronRight className="h-2.5 w-2.5 text-zinc-400" />}
                    <span className="text-xs font-medium text-zinc-950">{model.label}</span>
                  </button>
                  {/* Quick stats badges */}
                  <div className="flex items-center gap-1">
                    {speedIcon(model.inferenceSpeed)}
                    <span className="text-[9px] text-zinc-500">{speedLabel(model.inferenceSpeed)}</span>
                    <HardDrive className="h-2.5 w-2.5 text-zinc-400 ml-1" />
                    <span className="text-[9px] text-zinc-500">{model.sizeMB === 0 ? '0MB' : `${model.sizeMB}MB`}</span>
                  </div>
                </div>

                {/* Expanded detail — pros/cons */}
                {isExpandedDetail && (
                  <div className="px-3 pb-2 space-y-1">
                    {/* License + bboxes + adapter status */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-[8px] h-3.5 px-1">
                        <Shield className="h-2 w-2 mr-0.5" />
                        {model.license}
                      </Badge>
                      {model.producesBboxes ? (
                        <Badge className="text-[8px] h-3.5 px-1 bg-emerald-100 text-emerald-800">Bounding boxes</Badge>
                      ) : (
                        <Badge className="text-[8px] h-3.5 px-1 bg-amber-100 text-amber-800">Whole-frame only</Badge>
                      )}
                      {/* D9 fix: show adapter implementation status */}
                      {model.adapterImplemented === false && (
                        <Badge className="text-[8px] h-3.5 px-1 bg-zinc-200 text-zinc-700">
                          Adapter pending
                        </Badge>
                      )}
                      {model.adapterImplemented === true && (
                        <Badge className="text-[8px] h-3.5 px-1 bg-blue-100 text-blue-800">
                          Adapter ready
                        </Badge>
                      )}
                    </div>
                    {/* Pros */}
                    <div className="text-[9px] text-zinc-600">
                      <span className="font-semibold text-emerald-700">Pros:</span>{' '}
                      {model.pros.join(' · ')}
                    </div>
                    {/* Cons */}
                    <div className="text-[9px] text-zinc-600">
                      <span className="font-semibold text-rose-700">Cons:</span>{' '}
                      {model.cons.join(' · ')}
                    </div>
                    {/* Notes */}
                    <div className="text-[9px] text-zinc-500 italic">{model.notes}</div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Footer with total size estimate */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
            <span className="text-[9px] text-zinc-500">
              Total download: ~{Array.from(effectiveSelection).reduce((sum, id) => {
                const m = compatibleModels.find(m => m.id === id)
                return sum + (m?.sizeMB || 0)
              }, 0)}MB
            </span>
            {effectiveSelection.size === 1 && (
              <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                <AlertCircle className="h-2.5 w-2.5" />
                Single model — no ensemble
              </span>
            )}
            {effectiveSelection.size >= 2 && (
              <span className="text-[9px] text-emerald-600 flex items-center gap-0.5">
                <Cpu className="h-2.5 w-2.5" />
                Ensemble mode ({effectiveSelection.size} models)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
