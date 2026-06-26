'use client'
import { useEffect, useState } from 'react'
import { PHASE_PRESETS, cardioInfo, getPhasePreset, type PhasePreset } from '@/lib/phases'

const GROUPS: { label: string; phase: PhasePreset['phase'] }[] = [
  { label: 'Abnehmen (Cut)', phase: 'cut' },
  { label: 'Erhalt', phase: 'maintenance' },
  { label: 'Aufbau (Bulk)', phase: 'bulk' },
  { label: 'Aerobe Basis', phase: 'baseline_building' },
]

export default function PhaseAdvisor({ onChanged }: { onChanged?: (presetKey: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(d => {
      const p = d.profile
      const key = p?.phase_preset ?? getPhasePreset(null, p?.current_phase ?? 'cut').key
      setSelected(key)
      setLoaded(true)
    })
  }, [])

  async function choose(key: string) {
    setSelected(key)
    setSaved(false)
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase_preset: key }),
    })
    setSaving(false)
    setSaved(true)
    onChanged?.(key)
  }

  const active = selected ? getPhasePreset(selected) : null

  return (
    <div className="card space-y-4">
      <div>
        <h2 className="font-semibold text-slate-200">Trainingsphase &amp; Ernährungs-Ratgeber</h2>
        <p className="text-xs text-slate-400 mt-1">
          Wähle die Intensität deiner Phase. Kalorien, Protein/Fett-Schutz und Trainingsfreigabe passen sich automatisch an.
        </p>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500 animate-pulse">Lade Phase…</p>
      ) : (
        <div className="space-y-4">
          {GROUPS.map(group => {
            const presets = PHASE_PRESETS.filter(p => p.phase === group.phase)
            return (
              <div key={group.phase} className="space-y-1.5">
                <div className="text-xs uppercase tracking-wide text-slate-500">{group.label}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {presets.map(p => {
                    const isActive = selected === p.key
                    return (
                      <button
                        key={p.key}
                        onClick={() => choose(p.key)}
                        aria-pressed={isActive}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isActive ? 'bg-white/10' : 'border-white/10 hover:border-white/20'
                        }`}
                        style={isActive ? { borderColor: p.color, boxShadow: `inset 0 0 0 1px ${p.color}55` } : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                          <span className="font-medium text-slate-200 text-sm">{p.label}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{p.short}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {active && <PhaseAdvisorDetail preset={active} />}

      {saving && <p className="text-xs text-slate-500">Speichere…</p>}
      {saved && !saving && <p className="text-xs text-prime">Phase gespeichert ✓ – Makros &amp; Mahlzeitenplan aktualisiert.</p>}
    </div>
  )
}

export function PhaseAdvisorDetail({ preset }: { preset: PhasePreset }) {
  const c = cardioInfo(preset.cardio)
  return (
    <div
      className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: `${preset.color}40`, background: `${preset.color}0d` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-slate-100">{preset.label}</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${preset.color}22`, color: preset.color }}>
          {preset.deltaKcal === 0 ? '±0' : preset.deltaKcal > 0 ? `+${preset.deltaKcal}` : preset.deltaKcal} kcal
        </span>
        <span className="text-xs text-slate-400">{preset.expectedRate}</span>
        {preset.maxWeeks != null && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
            max. {preset.maxWeeks} Wochen
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <Metric label="Protein" value={`${preset.proteinPerKg} g/kg`} />
        <Metric label="Fett-Floor" value={`${preset.minFatPerKg} g/kg`} />
      </div>

      <AdviceRow icon="🧬" title="Hormone" text={preset.hormone} />
      <AdviceRow icon="⚖️" title="Körper · Fett & Muskeln" text={preset.body} />
      <AdviceRow icon="🏃" title={`Training · ${c.label}`} text={preset.training} />
      <div className="text-xs text-slate-400 pl-7 -mt-1">{c.detail}</div>
      {preset.warning && (
        <div className="flex gap-2 items-start rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
          <span className="shrink-0">⚠️</span>
          <p className="text-xs text-red-300/90">{preset.warning}</p>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 py-2">
      <div className="stat-label">{label}</div>
      <div className="text-sm font-bold text-slate-100">{value}</div>
    </div>
  )
}

function AdviceRow({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <div>
        <div className="text-xs font-semibold text-slate-200">{title}</div>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{text}</p>
      </div>
    </div>
  )
}
