'use client'
import { useState } from 'react'
import Link from 'next/link'
import StrengthLogger from '@/components/StrengthLogger'
import PolarizedZonesChart from '@/components/PolarizedZonesChart'

const TYPES = [
  { key: 'push' as const, label: 'Push',           icon: '🤸', desc: 'Brust · Schulter · Trizeps' },
  { key: 'pull' as const, label: 'Pull',           icon: '🏋️', desc: 'Rücken · Bizeps' },
  { key: 'legs' as const, label: 'Legs & Core',    icon: '🦵', desc: 'Beine · Rumpf' },
]

export default function StrengthPage() {
  const [selected, setSelected] = useState<'push' | 'pull' | 'legs' | null>(null)

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelected(null)}
            className="btn-ghost text-sm"
          >
            ← Zurück
          </button>
          <h1 className="text-lg font-bold text-slate-100">
            {TYPES.find(t => t.key === selected)?.icon}{' '}
            {TYPES.find(t => t.key === selected)?.label}
          </h1>
        </div>
        <StrengthLogger workoutType={selected} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Krafttraining</h1>
        <p className="text-slate-400 text-sm mt-1">Workout auswählen</p>
      </div>

      <div className="space-y-3">
        {TYPES.map(t => (
          <button
            key={t.key}
            onClick={() => setSelected(t.key)}
            className="w-full card hover:border-prime/50 hover:bg-white/5 transition-all text-left"
          >
            <div className="flex items-center gap-4">
              <span className="text-3xl">{t.icon}</span>
              <div>
                <div className="font-semibold text-slate-200">{t.label}</div>
                <div className="text-sm text-slate-400">{t.desc}</div>
              </div>
              <span className="ml-auto text-slate-500">→</span>
            </div>
          </button>
        ))}
      </div>

      {/* Progressions-Ladder Übersicht */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-200">Progressionslevel</h2>
        <Link href="/strength/progression" className="text-xs text-prime hover:underline">Vollständige Leiter →</Link>
      </div>
      <ProgressionOverview />

      {/* 80/20 Zonenverteilung */}
      <PolarizedZonesChart />
    </div>
  )
}

function ProgressionOverview() {
  const [prog, setProg] = useState<Array<{
    movement_pattern: string
    current_skill_level: number
    current_exercise: string
    progression_criteria_met: boolean
  }> | null>(null)

  if (!prog) {
    // Lazy load
    fetch('/api/strength').then(r => r.json()).then(d => setProg(d.progression))
    return <div className="card animate-pulse h-24 bg-surface-card" />
  }

  const PATTERN_LABEL: Record<string, string> = {
    pullup: '💪 Klimmzug', dip: '🤲 Dips', push: '🤸 Push', leg: '🦵 Beine'
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold text-slate-200">Progressionslevel</h2>
      <div className="grid grid-cols-2 gap-3">
        {prog.map(p => (
          <div key={p.movement_pattern}
            className={`card-sm ${p.progression_criteria_met ? 'border-prime/50' : ''}`}>
            <div className="text-xs font-semibold text-slate-400">
              {PATTERN_LABEL[p.movement_pattern] ?? p.movement_pattern}
            </div>
            <div className="text-sm font-medium text-slate-200 mt-1">{p.current_exercise}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">Level {p.current_skill_level}</span>
              {p.progression_criteria_met && <span className="badge-prime">↑</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
