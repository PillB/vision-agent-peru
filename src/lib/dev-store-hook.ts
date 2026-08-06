/**
 * Dev-only store hook — exposes the Zustand store on window.__visionStore
 * for Playwright tests and interactive debugging.
 *
 * ⚠️ This file MUST be dev-only. It is loaded via dynamic import from
 * `src/app/page.tsx` ONLY when `process.env.NODE_ENV !== 'production'`.
 * Next.js's production build tree-shakes the dynamic import out, so this
 * hook never ships to GitHub Pages.
 *
 * Tests should NOT rely on this hook for production-preview validation.
 * Use the formal Playwright Test suite (scripts/playwright/ui.spec.ts)
 * which drives the actual UI controls.
 */

import { usePrototypeStore } from './store'
import { USE_CASES } from './use-cases'
import { CAMERA_SOURCES } from './store'

export function installDevStoreHook(): void {
  if (typeof window === 'undefined') return
  // @ts-expect-error — augmenting window for dev tooling
  window.__USE_CASES__ = USE_CASES
  // @ts-expect-error — augmenting window for dev tooling
  window.__CAMERA_SOURCES__ = CAMERA_SOURCES

  // @ts-expect-error — augmenting window for dev tooling
  window.__visionStore = {
    getState: usePrototypeStore.getState,
    setState: usePrototypeStore.setState,
    subscribe: usePrototypeStore.subscribe,
    // Convenience helpers — these replicate the React component's logic so
    // tests get the same side-effects (camera auto-switch, capability level
    // sync) without going through the UI.
    setActiveUseCase: (id: string) => {
      const store = usePrototypeStore.getState()
      store.setActiveUseCase(id)
      const uc = USE_CASES.find((u) => u.id === id)
      if (uc?.level) store.setCapabilityLevel(uc.level)
      const bestCam = CAMERA_SOURCES.find((c) => c.useCases?.includes(id))
      if (bestCam) store.setActiveCamera(bestCam.id)
    },
    setActiveCamera: (id: string) => usePrototypeStore.getState().setActiveCamera(id),
    setCapabilityLevel: (lvl: string) => usePrototypeStore.getState().setCapabilityLevel(lvl as any),
    setRunning: (r: boolean) => usePrototypeStore.getState().setRunning(r),
    setLlmJudgeEnabled: (b: boolean) => usePrototypeStore.getState().setLlmJudgeEnabled(b),
    setSelectedModelIds: (ids: string[]) => usePrototypeStore.getState().setSelectedModelIds(ids),
  }
}
