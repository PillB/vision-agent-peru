'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, X, Zap, Gauge, Radio, Maximize2, Type } from 'lucide-react'
import { useLocalStorage } from '@/lib/vision/use-local-storage'

export interface DashboardSettings {
  defaultSpeed: number
  startWithLiveMode: boolean
  flowCollapsed: boolean
  presentationMode: boolean
}

const DEFAULTS: DashboardSettings = {
  defaultSpeed: 1,
  startWithLiveMode: false,
  flowCollapsed: false,
  presentationMode: false,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: DashboardSettings
  onChange: (s: DashboardSettings) => void
}

/**
 * SettingsPanel — a slide-over that lets the VP configure dashboard behavior.
 * Settings persist to localStorage so the dashboard restores the same way
 * on the next visit (good for repeat demos).
 */
export function SettingsPanel({ open, onOpenChange, settings, onChange }: Props) {
  const update = <K extends keyof DashboardSettings>(key: K, value: DashboardSettings[K]) => {
    onChange({ ...settings, [key]: value })
  }

  // Close on Escape — the motion backdrop catches clicks, but keyboard users
  // need a way out without reaching for the X button.
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onOpenChange(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-slate-950 border-l border-slate-800 shadow-2xl overflow-y-auto"
          >
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Settings className="h-4 w-4 text-amber-400" /> Settings
                </h2>
                <button
                  onClick={() => onOpenChange(false)}
                  className="grid place-items-center h-8 w-8 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                Configure the dashboard for your presentation. Settings persist to this browser so your setup is restored on the next visit.
              </p>

              {/* Default playback speed */}
              <SettingRow icon={Gauge} label="Default playback speed" desc="Speed used when a new agent trace starts.">
                <div className="flex items-center gap-1">
                  {[0.5, 1, 2].map((s) => (
                    <button
                      key={s}
                      onClick={() => update('defaultSpeed', s)}
                      className={`rounded px-2.5 py-1 text-[11px] font-mono font-semibold transition ${
                        settings.defaultSpeed === s ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </SettingRow>

              {/* Start with live mode */}
              <SettingRow icon={Radio} label="Start with live mode" desc="Automatically stream detections when the dashboard loads.">
                <Toggle checked={settings.startWithLiveMode} onChange={(v) => update('startWithLiveMode', v)} />
              </SettingRow>

              {/* Flow collapsed by default */}
              <SettingRow icon={Maximize2} label="Monitoring view by default" desc="Start with the flow canvas collapsed to focus on the side panels.">
                <Toggle checked={settings.flowCollapsed} onChange={(v) => update('flowCollapsed', v)} />
              </SettingRow>

              {/* Presentation mode */}
              <SettingRow icon={Type} label="Presentation mode" desc="Larger fonts + boosted contrast for projector / bright-room demos.">
                <Toggle checked={settings.presentationMode} onChange={(v) => update('presentationMode', v)} />
              </SettingRow>

              {/* Reset */}
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={() => onChange(DEFAULTS)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/60 py-2 text-xs font-mono text-slate-400 hover:text-rose-300 hover:border-rose-500/40 transition"
                >
                  Reset to defaults
                </button>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-amber-400" /> Active configuration
                </div>
                <div className="text-[10px] font-mono text-slate-400 space-y-0.5">
                  <div>speed: <span className="text-amber-300">{settings.defaultSpeed}×</span></div>
                  <div>live on load: <span className={settings.startWithLiveMode ? 'text-emerald-300' : 'text-slate-500'}>{String(settings.startWithLiveMode)}</span></div>
                  <div>monitoring view: <span className={settings.flowCollapsed ? 'text-emerald-300' : 'text-slate-500'}>{String(settings.flowCollapsed)}</span></div>
                  <div>presentation: <span className={settings.presentationMode ? 'text-emerald-300' : 'text-slate-500'}>{String(settings.presentationMode)}</span></div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function SettingRow({ icon: Icon, label, desc, children }: { icon: typeof Settings; label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="grid place-items-center h-7 w-7 rounded-md bg-slate-800 shrink-0 mt-0.5">
          <Icon className="h-3.5 w-3.5 text-slate-300" />
        </span>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-200">{label}</div>
          <div className="text-[10px] text-slate-500 leading-snug mt-0.5">{desc}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-amber-500' : 'bg-slate-700'}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? 'left-4' : 'left-0.5'}`}
      />
    </button>
  )
}

export { DEFAULTS as DEFAULT_SETTINGS }
