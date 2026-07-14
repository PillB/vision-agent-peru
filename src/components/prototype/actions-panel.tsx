'use client'

import { ListChecks, Mail, FileText, Zap, Camera, Brain, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { usePrototypeStore } from '@/lib/store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

const ACTION_META: Record<string, { icon: React.ReactNode; label: string; tone: string }> = {
  log_tick: { icon: <ListChecks className="h-3 w-3" />, label: 'Log tick', tone: 'zinc' },
  badge: { icon: <Zap className="h-3 w-3" />, label: 'Badge', tone: 'amber' },
  snapshot: { icon: <Camera className="h-3 w-3" />, label: 'Snapshot', tone: 'emerald' },
  log_hit: { icon: <ListChecks className="h-3 w-3" />, label: 'Log hit', tone: 'amber' },
  send_email: { icon: <Mail className="h-3 w-3" />, label: 'Send email', tone: 'emerald' },
  generate_report: { icon: <FileText className="h-3 w-3" />, label: 'Generate report', tone: 'emerald' },
  escalate: { icon: <Zap className="h-3 w-3" />, label: 'Escalate', tone: 'rose' },
  llm_judge: { icon: <Brain className="h-3 w-3" />, label: 'LLM judge', tone: 'emerald' },
  acknowledge: { icon: <CheckCircle2 className="h-3 w-3" />, label: 'Acknowledge', tone: 'zinc' },
  silence: { icon: <Mail className="h-3 w-3" />, label: 'Silence', tone: 'zinc' },
}

const STATUS_META: Record<string, React.ReactNode> = {
  pending: <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />,
  success: <CheckCircle2 className="h-3 w-3 text-emerald-600" />,
  failed: <XCircle className="h-3 w-3 text-rose-600" />,
  skipped: <span className="h-3 w-3 inline-block text-zinc-400 text-xs">—</span>,
}

export function ActionsPanel() {
  const actionLog = usePrototypeStore((s) => s.actionLog)

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Action audit trail</h3>
        </div>
        <Badge variant="outline" className="text-xs font-mono">{actionLog.length}</Badge>
      </div>
      <ScrollArea className="flex-1 max-h-[300px] pr-2">
        {actionLog.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            No actions executed yet.
            <br />
            <span className="text-zinc-500">The agent will populate this as anomalies are detected.</span>
          </div>
        ) : (
          <div className="space-y-1">
            {actionLog.map((entry) => {
              const meta = ACTION_META[entry.action.name] ?? { icon: <ListChecks className="h-3 w-3" />, label: entry.action.name, tone: 'zinc' }
              return (
                <div key={entry.id} className="rounded-md border border-zinc-100 bg-zinc-50/50 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-zinc-600 flex-shrink-0">{meta.icon}</span>
                      <span className="font-medium text-zinc-950 truncate">{meta.label}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">T{entry.action.tier}</Badge>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {STATUS_META[entry.status]}
                      <span className="text-[10px] font-mono text-zinc-400">
                        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                    </div>
                  </div>
                  {entry.message && (
                    <div className="text-[10px] text-zinc-600 font-mono leading-snug pl-5 break-words">
                      {entry.message}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
