'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, AlertTriangle, FileVideo, Upload, Database } from 'lucide-react'
import { parseQuery, checkSensitiveTerms, type ParsedQuery } from '@/lib/query-parser'
import { listEvidence, searchEvidence, type EvidenceRecord, type SearchResult } from '@/lib/evidence'

/**
 * NLSearchPanel — operator UI for Round 3 natural-language evidence search.
 *
 * Features:
 *   - Natural-language query input (Spanish + English)
 *   - Transparent parse display (recognized, ignored, rejected terms)
 *   - Sensitive-term rejection with clear explanation
 *   - Search results with score + matched-on indicator
 *   - Indexed video count + storage status
 *
 * This panel implements section 15 (NL query behavior) and section 9.3
 * (Search Evidence destination) of the Solarize system prompt.
 */
export function NLSearchPanel() {
  const [query, setQuery] = useState('')
  const [parsed, setParsed] = useState<ParsedQuery | null>(null)
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const all = await listEvidence()
      setEvidence(all)
    } catch (err) {
      console.error('[NLSearchPanel] refresh failed:', err)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleParse = useCallback(() => {
    if (!query.trim()) {
      setParsed(null)
      return
    }
    setParsed(parseQuery(query))
  }, [query])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) {
      setResults(null)
      return
    }
    setLoading(true)
    try {
      const p = parseQuery(query)
      setParsed(p)
      if (p.rejectedTerms.length > 0) {
        // Don't search rejected queries
        setResults([])
        return
      }
      // Search — embeddings not yet generated, falls back to keyword
      const searchResults = await searchEvidence(undefined, p.semanticQuery, 20)
      setResults(searchResults)
    } catch (err) {
      console.error('[NLSearchPanel] search failed:', err)
    } finally {
      setLoading(false)
    }
  }, [query])

  const sensitivityCheck = checkSensitiveTerms(query)

  return (
    <div className="space-y-3 p-3" data-testid="nl-search-panel">
      {/* Header */}
      <div className="border-b pb-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-emerald-600" />
          <h3 className="font-serif text-sm text-zinc-950">Natural-Language Search</h3>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">
          Spanish + English · {evidence.length} evidence record(s) indexed
        </p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <Input
          placeholder='Try: "persona con casaca azul, mochila roja, caminando hacia la salida"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 text-xs"
          data-testid="nl-search-input"
        />
        <Button size="sm" onClick={handleParse} variant="outline">
          Parse
        </Button>
        <Button size="sm" onClick={handleSearch} disabled={loading || !!sensitivityCheck}>
          <Search className="h-3.5 w-3.5 mr-1" />
          Search
        </Button>
      </div>

      {/* Sensitive-term warning */}
      {sensitivityCheck && (
        <div className="rounded-md bg-rose-50 border border-rose-200 p-2 text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Query rejected</p>
            <p className="mt-0.5">{sensitivityCheck}</p>
          </div>
        </div>
      )}

      {/* Parse result */}
      {parsed && parsed.rejectedTerms.length === 0 && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-[11px] text-blue-900">
          <p className="font-semibold mb-1">Parsed query:</p>
          <p>{parsed.explanation}</p>
          {parsed.ignoredTerms.length > 0 && (
            <p className="mt-1 text-[10px] text-blue-700">
              Ignored: {parsed.ignoredTerms.slice(0, 8).join(', ')}
              {parsed.ignoredTerms.length > 8 ? '...' : ''}
            </p>
          )}
        </div>
      )}

      {/* Search results */}
      {results !== null && (
        <div>
          <div className="text-[10px] text-zinc-500 mb-1">
            {results.length} result(s){results.length > 0 && ' (sorted by score)'}
          </div>
          <ScrollArea className="h-[300px] rounded-md border">
            <div className="divide-y">
              {results.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No matching evidence found.
                  {evidence.length === 0 && ' Index some evidence first by running the prototype detection loop.'}
                </div>
              ) : (
                results.map(r => (
                  <div key={r.record.id} className="p-2 hover:bg-zinc-50">
                    <div className="flex items-start gap-2">
                      {r.record.snapshotDataUrl ? (
                        <img
                          src={r.record.snapshotDataUrl}
                          alt="evidence"
                          className="w-16 h-12 object-cover rounded border bg-zinc-100 shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-12 rounded border bg-zinc-100 flex items-center justify-center text-[9px] text-zinc-400 shrink-0">
                          No img
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className="text-[8px] h-3.5 bg-emerald-100 text-emerald-800">
                            {r.record.detection.class}
                          </Badge>
                          <Badge className="text-[8px] h-3.5 bg-zinc-100 text-zinc-700">
                            score: {r.score.toFixed(2)}
                          </Badge>
                          <Badge className={`text-[8px] h-3.5 ${
                            r.matchedOn === 'embedding' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {r.matchedOn}
                          </Badge>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {new Date(r.record.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          {r.record.cameraId} · {r.record.useCaseId}
                        </p>
                        {r.record.note && (
                          <p className="text-[10px] text-zinc-500 italic mt-0.5">&ldquo;{r.record.note}&rdquo;</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Help */}
      <div className="text-[9px] text-zinc-400 border-t pt-2">
        <p className="font-semibold mb-0.5">Privacy boundary (section 3):</p>
        <p>Queries about race, ethnicity, religion, disability, medical status, political views, socioeconomic status, emotion, or subjective criminality are rejected.</p>
        <p className="mt-1">Use observable descriptors: clothing, color, carried object, vehicle, direction, activity.</p>
      </div>
    </div>
  )
}
