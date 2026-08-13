'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, CornerDownLeft, Command, Workflow, Network, Layers, Zap } from 'lucide-react'
import type { UseCase } from '@/lib/vision/types'
import { USE_CASES, LEVEL_META } from '@/lib/vision/use-cases'
import { FLOW_NODES } from '@/lib/vision/agent-flow'

interface CommandItem {
  id: string
  label: string
  hint: string
  group: 'use-case' | 'flow-node' | 'tab' | 'action'
  icon: typeof Search
  action: () => void
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectUseCase: (id: string) => void
  onSelectFlowNode: (nodeId: string) => void
  onSwitchTab: (tab: string) => void
}

/**
 * CommandPalette — ⌘K / Ctrl+K palette to jump to any use case or flow node.
 */
export function CommandPalette({ open, onOpenChange, onSelectUseCase, onSelectFlowNode, onSwitchTab }: Props) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const items = useMemo<CommandItem[]>(() => {
    const ucItems: CommandItem[] = USE_CASES.map((uc) => ({
      id: `uc-${uc.id}`,
      label: uc.nameEn,
      hint: `${LEVEL_META[uc.level].label} · T${uc.tier} · ${uc.ruleType.replace('_', ' ')}`,
      group: 'use-case',
      icon: Zap,
      action: () => { onSelectUseCase(uc.id); onSwitchTab('flow'); onOpenChange(false) },
    }))
    const nodeItems: CommandItem[] = FLOW_NODES.map((n) => ({
      id: `node-${n.id}`,
      label: n.label,
      hint: n.stage + ' · ' + n.type,
      group: 'flow-node',
      icon: Workflow,
      action: () => { onSelectFlowNode(n.id); onSwitchTab('flow'); onOpenChange(false) },
    }))
    const tabItems: CommandItem[] = [
      { id: 'tab-flow', label: 'Agent Decision Flow', hint: 'switch tab', group: 'tab', icon: Workflow, action: () => { onSwitchTab('flow'); onOpenChange(false) } },
      { id: 'tab-network', label: 'Correlation Network', hint: 'switch tab', group: 'tab', icon: Network, action: () => { onSwitchTab('network'); onOpenChange(false) } },
      { id: 'tab-compare', label: 'Compare Use Cases', hint: 'switch tab', group: 'tab', icon: Layers, action: () => { onSwitchTab('compare'); onOpenChange(false) } },
    ]
    return [...ucItems, ...nodeItems, ...tabItems]
  }, [onSelectUseCase, onSelectFlowNode, onSwitchTab, onOpenChange])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return items
    return items.filter((it) => (it.label + ' ' + it.hint + ' ' + it.group).toLowerCase().includes(q))
  }, [items, query])

  // Reset active index whenever the query changes (event-driven via onChange below).

  useEffect(() => {
    if (open) {
      // Defer focus to next tick so the input is mounted.
      const id = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [open])

  // Clear the query whenever the palette opens (event-driven, not effect-driven).
  const handleOpen = useCallback(() => setQuery(''), [])

  // Update query + reset active index together (avoids setState-in-effect).
  const updateQuery = useCallback((v: string) => {
    setQuery(v)
    setActiveIndex(0)
  }, [])

  const execute = useCallback((item: CommandItem) => {
    item.action()
  }, [])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIndex]) execute(filtered[activeIndex]) }
    else if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false) }
  }, [filtered, activeIndex, execute, onOpenChange])

  // scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // group items
  const grouped = useMemo(() => {
    const g: Record<string, CommandItem[]> = {}
    filtered.forEach((it, i) => {
      const key = it.group
      if (!g[key]) g[key] = []
      g[key].push({ ...it, _idx: i } as CommandItem)
    })
    return g
  }, [filtered])

  const GROUP_LABEL: Record<string, string> = {
    'use-case': 'Use cases',
    'flow-node': 'Flow stages',
    tab: 'Navigate',
    action: 'Actions',
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
            onKeyDown={onKeyDown}
          >
            {/* search input */}
            <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-3">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                ref={inputRef}
                value={query}
                onFocus={handleOpen}
                onChange={(e) => updateQuery(e.target.value)}
                placeholder="Jump to use case, flow stage, or tab…"
                className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <kbd className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-400">esc</kbd>
            </div>
            {/* results */}
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">No matches for "{query}"</div>
              ) : (
                Object.entries(grouped).map(([group, list]) => (
                  <div key={group} className="mb-1">
                    <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-slate-500 font-semibold">{GROUP_LABEL[group] ?? group}</div>
                    {list.map((it) => {
                      const idx = (it as CommandItem & { _idx: number })._idx
                      const Icon = it.icon
                      const active = idx === activeIndex
                      return (
                        <button
                          key={it.id}
                          data-idx={idx}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => execute(it)}
                          className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                            active ? 'bg-sky-500/15 text-sky-100' : 'text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          <span className={`grid place-items-center h-6 w-6 rounded-md ${active ? 'bg-sky-500/20' : 'bg-slate-800'}`}>
                            <Icon className={`h-3 w-3 ${active ? 'text-sky-300' : 'text-slate-400'}`} />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm truncate">{it.label}</span>
                            <span className="block text-[10px] font-mono text-slate-500 truncate">{it.hint}</span>
                          </span>
                          {active && <CornerDownLeft className="h-3 w-3 text-sky-300" />}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
            {/* footer */}
            <div className="border-t border-slate-800 px-3 py-2 flex items-center justify-between text-[9px] font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <Command className="h-3 w-3" /> + K to toggle · ↑↓ navigate · ↵ select
              </span>
              <span>{filtered.length} results</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
