'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Check, Workflow, Network, GitCompare, Radio } from 'lucide-react'

interface Step {
  title: string
  body: string
  icon: typeof Workflow
  accent: string
  tab?: string
}

const STEPS: Step[] = [
  {
    title: 'Agent Decision Flow',
    body: 'Watch the agent\'s 9-stage loop (Observe → Validate → Policy → Judge → Propose → Approve → Execute → Verify) light up as it perceives, reasons, branches by tier, and takes action. Press Play to animate the trace.',
    icon: Workflow,
    accent: '#fbbf24',
    tab: 'flow',
  },
  {
    title: 'Correlation Network',
    body: 'Explore the force-directed graph of entities detected across 4 camera feeds. Nodes are sized by detection count, colored by kind, and connected by correlation score. Click any entity for detail. Switch feeds and filter by kind.',
    icon: Network,
    accent: '#38bdf8',
    tab: 'network',
  },
  {
    title: 'Compare Use Cases',
    body: 'Contrast two agent runs side-by-side. The decision diff panel highlights exactly where the paths diverge — different tiers, branches, or outcomes — so you can see how the agent adapts its reasoning per scenario.',
    icon: GitCompare,
    accent: '#a78bfa',
    tab: 'compare',
  },
  {
    title: 'Live Detection Stream',
    body: 'Start live mode to stream simulated 1 Hz detections from the 4 feeds. The heartbeat pulses green while live. Export the stream as CSV for your records. Press ? anytime for keyboard shortcuts, ⌘K to jump anywhere.',
    icon: Radio,
    accent: '#f87171',
    tab: 'flow',
  },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSwitchTab: (tab: string) => void
}

export function OnboardingTour({ open, onOpenChange, onSwitchTab }: Props) {
  const [step, setStep] = useState(0)

  // When the tour opens, jump to the first step's tab. The step itself
  // resets to 0 via the `key` prop on the parent (remount on open).
  useEffect(() => {
    if (open) onSwitchTab(STEPS[0].tab!)
  }, [open, onSwitchTab])

  const next = useCallback(() => {
    if (step < STEPS.length - 1) {
      const n = step + 1
      setStep(n)
      if (STEPS[n].tab) onSwitchTab(STEPS[n].tab!)
    } else {
      onOpenChange(false)
    }
  }, [step, onSwitchTab, onOpenChange])

  const prev = useCallback(() => {
    if (step > 0) {
      const p = step - 1
      setStep(p)
      if (STEPS[p].tab) onSwitchTab(STEPS[p].tab!)
    }
  }, [step, onSwitchTab])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, next, prev, onOpenChange])

  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-4 right-4 z-[55] w-[340px] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        >
          {/* progress bar */}
          <div className="h-1 bg-slate-800">
            <motion.div
              className="h-full"
              style={{ background: current.accent }}
              initial={false}
              animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center h-9 w-9 rounded-lg" style={{ background: current.accent + '22' }}>
                  <Icon className="h-4 w-4" style={{ color: current.accent }} />
                </span>
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">
                    Tour · step {step + 1} of {STEPS.length}
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 leading-tight">{current.title}</h3>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="grid place-items-center h-6 w-6 rounded-md border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition"
                aria-label="Skip tour"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">{current.body}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === step ? 20 : 6,
                      background: i === step ? current.accent : '#334155',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {step > 0 && (
                  <button
                    onClick={prev}
                    className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-mono text-slate-400 hover:text-slate-200 transition"
                  >
                    <ChevronLeft className="h-3 w-3" /> Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-mono font-semibold text-slate-950 transition"
                  style={{ background: current.accent }}
                >
                  {isLast ? <><Check className="h-3 w-3" /> Done</> : <>{'Next'} <ChevronRight className="h-3 w-3" /></>}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
