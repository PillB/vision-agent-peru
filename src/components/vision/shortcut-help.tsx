'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard } from 'lucide-react'

interface Shortcut {
  keys: string[]
  label: string
  group: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['Space'], label: 'Play / pause agent trace', group: 'Playback' },
  { keys: ['←'], label: 'Step backward one stage', group: 'Playback' },
  { keys: ['→'], label: 'Step forward one stage', group: 'Playback' },
  { keys: ['R'], label: 'Reset trace to start', group: 'Playback' },
  { keys: ['N'], label: 'Generate next agent cycle', group: 'Playback' },
  { keys: ['⌘', 'K'], label: 'Open command palette (jump to use case / flow node / tab)', group: 'Navigation' },
  { keys: [','], label: 'Toggle settings panel', group: 'Navigation' },
  { keys: ['Esc'], label: 'Close inspector / palette / help / settings', group: 'Navigation' },
  { keys: ['?'], label: 'Toggle this shortcut help', group: 'Navigation' },
  { keys: ['Enter', 'Space'], label: 'Inspect focused flow node (when keyboard-focused)', group: 'Flow graph' },
  { keys: ['Tab'], label: 'Move keyboard focus between flow nodes', group: 'Flow graph' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutHelp({ open, onOpenChange }: Props) {
  const groups = Array.from(new Set(SHORTCUTS.map((s) => s.group)))

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-amber-400" /> Keyboard shortcuts
              </h2>
              <button
                onClick={() => onOpenChange(false)}
                className="grid place-items-center h-7 w-7 rounded-md border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition"
                aria-label="Close shortcut help"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {groups.map((group) => (
                <div key={group}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2">{group}</div>
                  <div className="space-y-1.5">
                    {SHORTCUTS.filter((s) => s.group === group).map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-slate-300">{s.label}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          {s.keys.map((k, j) => (
                            <kbd
                              key={j}
                              className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-200 min-w-[24px] text-center"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-800 px-4 py-2.5 text-[10px] font-mono text-slate-500 text-center">
              Press <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-slate-300">?</kbd> anywhere to toggle this help
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
