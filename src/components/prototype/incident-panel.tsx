'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Check, X, Clock, AlertCircle, RefreshCw, Shield } from 'lucide-react'
import {
  createIncident,
  transitionIncident,
  canTransition,
  requiresApproval,
  isAutoAllowedOnGhPages,
  getIdempotencyKey,
  checkIdempotency,
  recordActionExecution,
  orderActionsSequentially,
  computeOutcome,
  getProfileCapabilities,
  detectProfile,
  type Incident,
  type IncidentState,
  type ActionExecution,
} from '@/lib/incident-state-machine'
import type { ActionName } from '@/lib/agent'

/**
 * IncidentPanel — operator UI for the Round 5 incident state machine.
 *
 * Shows:
 *   - Current capability profile (GH Pages / secure service / dev)
 *   - All incidents with their current state
 *   - State transition trail (audit log)
 *   - Pending approval actions
 *   - Idempotent action execution status
 *
 * This panel demonstrates the 12-state sequential machine and the
 * approval workflow required for external actions (email, escalate).
 */
export function IncidentPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [profile, setProfile] = useState(() => detectProfile())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newCameraId, setNewCameraId] = useState('camA')
  const [newUseCaseId, setNewUseCaseId] = useState('intrusion')

  const capabilities = getProfileCapabilities(profile)

  const refresh = useCallback(() => {
    setProfile(detectProfile())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createNewIncident = useCallback(() => {
    const inc = createIncident(newCameraId, newUseCaseId)
    setIncidents(prev => [inc, ...prev])
    setSelectedId(inc.id)
  }, [newCameraId, newUseCaseId])

  const advanceState = useCallback((id: string, targetState: IncidentState) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id !== id) return inc
      if (!canTransition(inc.state, targetState)) return inc
      try {
        return transitionIncident(inc, targetState, `Manual transition to ${targetState}`, 'operator')
      } catch {
        return inc
      }
    }))
  }, [])

  const executeAction = useCallback((incidentId: string, action: ActionName) => {
    setIncidents(prev => prev.map(inc => {
      if (inc.id !== incidentId) return inc
      // Check idempotency
      const existing = checkIdempotency(inc, action)
      if (existing?.status === 'succeeded') {
        return inc  // idempotent — already done
      }
      // Simulate execution (in real system, this would call the action handler)
      const { incident: updated, execution } = recordActionExecution(inc, action, 'succeeded', {
        response: { simulated: true, profile },
      })
      const outcome = computeOutcome(updated, action, execution)
      if (outcome.nextState !== updated.state && canTransition(updated.state, outcome.nextState)) {
        return transitionIncident(updated, outcome.nextState, outcome.reason, 'system')
      }
      return updated
    }))
  }, [profile])

  const selectedIncident = incidents.find(i => i.id === selectedId)

  // ─── State badge colors ───
  const stateColors: Record<IncidentState, string> = {
    observed: 'bg-zinc-100 text-zinc-800',
    candidate: 'bg-blue-100 text-blue-800',
    evidence_validated: 'bg-indigo-100 text-indigo-800',
    policy_evaluated: 'bg-purple-100 text-purple-800',
    action_proposed: 'bg-amber-100 text-amber-800',
    pending_approval: 'bg-orange-100 text-orange-800',
    executing: 'bg-cyan-100 text-cyan-800',
    outcome_verification: 'bg-teal-100 text-teal-800',
    succeeded: 'bg-emerald-100 text-emerald-800',
    failed: 'bg-rose-100 text-rose-800',
    compensating: 'bg-yellow-100 text-yellow-800',
    closed: 'bg-zinc-200 text-zinc-600',
  }

  return (
    <div className="space-y-3 p-3" data-testid="incident-panel">
      {/* Header — capability profile */}
      <div className="border-b pb-2">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-emerald-600" />
          <h3 className="font-serif text-sm text-zinc-950">Incident State Machine</h3>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1">{capabilities.badge}</p>
      </div>

      {/* Create new incident */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label htmlFor="incident-camera" className="text-[10px] text-zinc-500">Camera</label>
          <Input
            id="incident-camera"
            value={newCameraId}
            onChange={(e) => setNewCameraId(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="incident-use-case" className="text-[10px] text-zinc-500">Use Case</label>
          <Input
            id="incident-use-case"
            value={newUseCaseId}
            onChange={(e) => setNewUseCaseId(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
        <Button size="sm" className="h-7 text-xs" onClick={createNewIncident}>
          New Incident
        </Button>
      </div>

      {/* Incidents list */}
      <ScrollArea className="h-[300px] rounded-md border">
        <div className="divide-y">
          {incidents.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-500">
              No incidents. Click &ldquo;New Incident&rdquo; to create one and observe the 12-state machine.
            </div>
          ) : (
            incidents.map(inc => (
              <div
                key={inc.id}
                className={`p-2 cursor-pointer hover:bg-zinc-50 ${selectedId === inc.id ? 'bg-emerald-50' : ''}`}
                onClick={() => setSelectedId(inc.id)}
              >
                <div className="flex items-center gap-2">
                  <Badge className={`text-[9px] h-4 ${stateColors[inc.state]}`}>
                    {inc.state.replace(/_/g, ' ')}
                  </Badge>
                  <span className="text-[10px] font-mono text-zinc-500">{inc.id.slice(0, 12)}</span>
                  <span className="text-[10px] text-zinc-400">·</span>
                  <span className="text-[10px] text-zinc-500">{inc.cameraId}</span>
                  <span className="text-[10px] text-zinc-400">·</span>
                  <span className="text-[10px] text-zinc-500">{inc.useCaseId}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Selected incident detail */}
      {selectedIncident && (
        <div className="border rounded-md p-2 space-y-2">
          <div className="text-[11px] font-semibold text-zinc-950">
            Incident {selectedIncident.id.slice(0, 16)}
          </div>

          {/* State transition trail */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">State Trail:</div>
            <div className="flex flex-wrap gap-1">
              {selectedIncident.transitions.length === 0 ? (
                <span className="text-[10px] text-zinc-400 italic">No transitions yet</span>
              ) : (
                selectedIncident.transitions.map((t, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Badge className="text-[8px] h-3.5 bg-zinc-100 text-zinc-600">{t.from}</Badge>
                    <span className="text-[8px] text-zinc-400">→</span>
                    <Badge className={`text-[8px] h-3.5 ${stateColors[t.to]}`}>{t.to}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Available transitions */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Available Transitions:</div>
            <div className="flex flex-wrap gap-1">
              {(['candidate', 'evidence_validated', 'policy_evaluated', 'action_proposed',
                 'pending_approval', 'executing', 'outcome_verification', 'succeeded',
                 'failed', 'compensating', 'closed'] as IncidentState[])
                .filter(s => canTransition(selectedIncident.state, s))
                .map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className="h-5 text-[9px]"
                    onClick={() => advanceState(selectedIncident.id, s)}
                  >
                    → {s.replace(/_/g, ' ')}
                  </Button>
                ))}
              {(['candidate', 'evidence_validated', 'policy_evaluated', 'action_proposed',
                 'pending_approval', 'executing', 'outcome_verification', 'succeeded',
                 'failed', 'compensating', 'closed'] as IncidentState[])
                .filter(s => canTransition(selectedIncident.state, s)).length === 0 && (
                <span className="text-[10px] text-zinc-400 italic">
                  {selectedIncident.state === 'closed' ? 'Terminal state' : 'No transitions available'}
                </span>
              )}
            </div>
          </div>

          {/* Action execution */}
          <div>
            <div className="text-[10px] text-zinc-500 mb-1">Actions (idempotent):</div>
            <div className="flex flex-wrap gap-1">
              {(['badge', 'log_hit', 'snapshot', 'generate_report', 'send_email', 'escalate', 'llm_judge'] as ActionName[])
                .map(action => {
                  const exec = checkIdempotency(selectedIncident, action)
                  const needsApproval = requiresApproval(action)
                  const autoAllowed = isAutoAllowedOnGhPages(action)
                  return (
                    <Button
                      key={action}
                      size="sm"
                      variant={exec?.status === 'succeeded' ? 'outline' : 'default'}
                      className={`h-5 text-[9px] ${exec?.status === 'succeeded' ? 'bg-emerald-50 text-emerald-700' : ''}`}
                      disabled={exec?.status === 'succeeded'}
                      onClick={() => executeAction(selectedIncident.id, action)}
                      title={
                        exec?.status === 'succeeded' ? 'Already executed (idempotent)' :
                        needsApproval ? 'Requires approval' :
                        autoAllowed ? 'Auto-allowed' : 'Manual'
                      }
                    >
                      {exec?.status === 'succeeded' && <Check className="h-2 w-2 mr-0.5" />}
                      {needsApproval && <Clock className="h-2 w-2 mr-0.5" />}
                      {action}
                    </Button>
                  )
                })}
            </div>
            <div className="text-[9px] text-zinc-400 mt-1">
              ✓ = executed (idempotent) · 🕐 = requires approval
            </div>
          </div>

          {/* Last outcome */}
          {selectedIncident.lastOutcome && (
            <div className="text-[10px] text-zinc-600 border-t pt-1">
              <span className="font-semibold">Last outcome:</span>{' '}
              {selectedIncident.lastOutcome.action} →{' '}
              <Badge className={`text-[8px] h-3.5 ${
                selectedIncident.lastOutcome.status === 'succeeded' ? 'bg-emerald-100 text-emerald-800' :
                selectedIncident.lastOutcome.status === 'failed' ? 'bg-rose-100 text-rose-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {selectedIncident.lastOutcome.status}
              </Badge>
              {' '}· attempts: {selectedIncident.lastOutcome.retryCount}
            </div>
          )}
        </div>
      )}

      {/* Sequential judge gating reminder */}
      <div className="text-[9px] text-zinc-400 italic border-t pt-2">
        Judge runs BEFORE escalate — section 20 forbids parallel execution.
        Order: {orderActionsSequentially(['escalate', 'llm_judge', 'send_email', 'badge']).join(' → ')}
      </div>
    </div>
  )
}
