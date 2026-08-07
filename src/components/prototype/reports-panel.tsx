'use client'

import { useState } from 'react'
import { FileText, Download, ChevronRight } from 'lucide-react'
import { usePrototypeStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'

export function ReportsPanel() {
  const reports = usePrototypeStore((s) => s.reports)
  const [openId, setOpenId] = useState<string | null>(null)

  const downloadReport = (id: string, markdown: string) => {
    const blob = new Blob([markdown], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `incident-report-${id}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-zinc-950">Incident reports</h3>
        </div>
        <Badge variant="outline" className="text-xs font-mono">{reports.length}</Badge>
      </div>
      {/* ELI5 hint */}
      <div className="mb-3 rounded-md bg-zinc-50 border border-zinc-100 px-2.5 py-1.5 text-[10px] text-zinc-500 leading-relaxed">
        💡 <strong>¿Qué es esto?</strong> Cuando ocurre un incidente crítico (Tier 3), el agente
        genera automáticamente un reporte en lenguaje natural con: resumen, línea de tiempo,
        acciones tomadas, evidencia y recomendaciones. Haga clic en un reporte para expandirlo.
      </div>
      <ScrollArea className="flex-1 max-h-[260px] pr-2">
        {reports.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-400">
            <FileText className="h-6 w-6 mx-auto mb-2 text-zinc-300" />
            No reports generated yet.
            <br />
            <span className="text-zinc-500">Auto-generated on Tier 3 incidents, or trigger manually from an alert.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="rounded-lg border border-zinc-200 overflow-hidden">
                <button
                  className="w-full p-3 text-left hover:bg-zinc-50 transition flex items-center justify-between gap-2"
                  onClick={() => setOpenId(openId === r.id ? null : r.id)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${r.tier === 3 ? 'bg-rose-600' : 'bg-amber-500'}`} />
                      <span className="text-xs font-semibold text-zinc-950 truncate">{r.cameraLabel}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono">T{r.tier}</Badge>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      {new Date(r.createdAt).toLocaleString('en-US', { hour12: false })} · peak {r.peakCount} · z={r.peakZScore.toFixed(2)}
                    </div>
                  </div>
                  <ChevronRight className={`h-3.5 w-3.5 text-zinc-400 transition ${openId === r.id ? 'rotate-90' : ''}`} />
                </button>
                {openId === r.id && (
                  <div className="border-t border-zinc-200 p-3 bg-zinc-50/50">
                    <div className="prose prose-sm max-w-none text-xs">
                      <ReactMarkdown>{r.summary}</ReactMarkdown>
                    </div>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-[10px]"
                        onClick={() => downloadReport(r.id, r.summary)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download .md
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
