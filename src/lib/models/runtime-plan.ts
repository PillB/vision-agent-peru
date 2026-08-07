import { getModelById } from './registry'

export interface RuntimeAdapterPlan {
  id: string
  rank: number
  task: string
  revision: string
}

export function resolveRuntimePlan(selectedIds: string[], useCaseId: string): {
  useCaseId: string
  adapters: RuntimeAdapterPlan[]
  unavailable: string[]
} {
  const adapters: RuntimeAdapterPlan[] = []
  const unavailable: string[] = []

  selectedIds.forEach((id, rank) => {
    const model = getModelById(id)
    if (!model || !model.adapterImplemented || !model.browserReady) {
      unavailable.push(id)
      return
    }
    adapters.push({
      id,
      rank,
      task: model.task,
      revision: model.revision ?? 'unversioned',
    })
  })

  return { useCaseId, adapters, unavailable }
}
