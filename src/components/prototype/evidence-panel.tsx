'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Check, Trash2, Download, AlertTriangle, Database } from 'lucide-react'
import {
  listEvidence,
  searchEvidence,
  deleteEvidence,
  confirmEvidence,
  annotateEvidence,
  clearEvidence,
  exportEvidenceJSON,
  evidenceStorageAvailable,
  type EvidenceRecord,
  type SearchResult,
} from '@/lib/evidence'

/**
 * EvidencePanel — operator UI for the evidence search pipeline.
 *
 * Features:
 *   - List all evidence (sorted newest first)
 *   - Natural-language search (cosine sim on CLIP embeddings when available,
 *     keyword fallback)
 *   - Confirm / annotate / delete individual records
 *   - Export all evidence to JSON (download)
 *   - Storage status indicator (IndexedDB available / unavailable)
 *
 * This panel reads from IndexedDB via src/lib/evidence.ts. It does NOT
 * touch the Zustand store — evidence is a separate persistence layer
 * from the live detection loop.
 */
export function EvidencePanel() {
  const [records, setRecords] = useState<EvidenceRecord[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [storageOk, setStorageOk] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const all = await listEvidence()
      setRecords(all)
      setStorageOk(evidenceStorageAvailable())
    } catch (err) {
      console.error('[EvidencePanel] refresh failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    setLoading(true)
    try {
      // Embeddings are not yet generated for stored records — search falls
      // back to keyword matching. When CLIP integration is added, this will
      // automatically use cosine similarity.
      const results = await searchEvidence(undefined, query, 20)
      setSearchResults(results)
    } catch (err) {
      console.error('[EvidencePanel] search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [query])

  const handleConfirm = useCallback(async (id: string) => {
    await confirmEvidence(id)
    await refresh()
  }, [refresh])

  const handleDelete = useCallback(async (id: string) => {
    await deleteEvidence(id)
    await refresh()
  }, [refresh])

  const handleClearAll = useCallback(async () => {
    if (!confirm('Clear ALL evidence? This cannot be undone.')) return
    await clearEvidence()
    await refresh()
  }, [refresh])

  const handleExport = useCallback(async () => {
    const json = await exportEvidenceJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vision-agent-evidence-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleAnnotate = useCallback(async (id: string, noteText: string) => {
    await annotateEvidence(id, noteText)
    await refresh()
  }, [refresh])

  const display = searchResults?.map(r => r.record) ?? records
  const confirmedCount = records.filter(r => r.confirmed).length

  return (
    <div className="space-y-4 p-4" data-testid="evidence-panel">
      {/* Header — storage status + counts + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="font-serif text-base text-zinc-950">Evidence Search</h3>
            <p className="text-[11px] text-zinc-500">
              {records.length} record(s) · {confirmedCount} confirmed ·{' '}
              {storageOk ? 'IndexedDB' : 'In-memory (no persistence)'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={records.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export JSON
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAll} disabled={records.length === 0}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <Input
          placeholder="Search evidence by keyword (e.g., 'fire', 'intrusion', 'person')..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
          data-testid="evidence-search-input"
        />
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4 mr-1.5" />
          Search
        </Button>
        {searchResults && (
          <Button variant="ghost" onClick={() => { setSearchResults(null); setQuery('') }}>
            Clear
          </Button>
        )}
      </div>

      {/* Storage warning */}
      {!storageOk && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">IndexedDB unavailable</p>
            <p className="mt-1">
              Evidence is stored in-memory only and will be lost on page refresh.
              This usually happens in private browsing mode. Use a normal browser
              session for persistent evidence storage.
            </p>
          </div>
        </div>
      )}

      {/* Evidence list */}
      <ScrollArea className="h-[500px] rounded-md border">
        <div className="divide-y">
          {display.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">
              {loading ? 'Loading...' : 'No evidence yet. Run the prototype detection loop to generate evidence.'}
            </div>
          ) : (
            display.map((rec) => (
              <div key={rec.id} className="p-3 hover:bg-zinc-50 transition">
                <div className="flex items-start gap-3">
                  {/* Snapshot thumbnail */}
                  {rec.snapshotDataUrl ? (
                    <img
                      src={rec.snapshotDataUrl}
                      alt={`Evidence ${rec.id}`}
                      className="w-20 h-14 object-cover rounded border bg-zinc-100 shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-14 rounded border bg-zinc-100 flex items-center justify-center text-[10px] text-zinc-400 shrink-0">
                      No image
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-800">
                        {rec.detection.class}
                      </Badge>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {(rec.detection.score * 100).toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-zinc-400">·</span>
                      <span className="text-[10px] text-zinc-500">{rec.useCaseId}</span>
                      <span className="text-[10px] text-zinc-400">·</span>
                      <span className="text-[10px] text-zinc-500">{rec.cameraId}</span>
                      <span className="text-[10px] text-zinc-400">·</span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(rec.timestamp).toLocaleTimeString()}
                      </span>
                      {rec.confirmed && (
                        <Badge className="text-[9px] h-4 bg-blue-100 text-blue-800">
                          <Check className="h-2 w-2 mr-0.5" />
                          Confirmed
                        </Badge>
                      )}
                    </div>

                    {/* Note (if any) */}
                    {rec.note && (
                      <p className="mt-1 text-xs text-zinc-700 italic">&ldquo;{rec.note}&rdquo;</p>
                    )}

                    {/* Action buttons */}
                    <div className="mt-2 flex items-center gap-2">
                      {!rec.confirmed && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          onClick={() => handleConfirm(rec.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Confirm
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => {
                          setSelectedId(selectedId === rec.id ? null : rec.id)
                          setNote(rec.note ?? '')
                        }}
                      >
                        Annotate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-rose-600 hover:text-rose-700"
                        onClick={() => handleDelete(rec.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>

                    {/* Annotation editor */}
                    {selectedId === rec.id && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Add a note (e.g., 'confirmed fire near exit')"
                          className="h-7 text-xs"
                        />
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            handleAnnotate(rec.id, note)
                            setSelectedId(null)
                          }}
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer — count + search-mode indicator */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400">
        <span>
          Showing {display.length} of {records.length} record(s)
          {searchResults && ' (search results)'}
        </span>
        <span className="font-mono">
          {searchResults ? 'Keyword match' : 'Newest first'}
        </span>
      </div>
    </div>
  )
}
