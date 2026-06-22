'use client'
import { useState, useEffect, useCallback } from 'react'

interface SetEntry {
  id: string
  movement_pattern: string
  exercise_name: string
  skill_level: number
  set_number: number
  reps: number
  added_weight_kg: number
  rir: number
}

interface ProgressionStatus {
  movement_pattern: string
  current_skill_level: number
  current_exercise: string
  progression_criteria_met: boolean
  advancement_criteria: string
}

const WORKOUT_MOVEMENTS: Record<string, string[]> = {
  push: ['push'],
  pull: ['pullup', 'pull'],
  legs: ['leg'],
}

const PATTERN_LABEL: Record<string, string> = {
  pullup: 'Klimmzug',
  dip:    'Dips',
  push:   'Push',
  pull:   'Rudern',
  leg:    'Beine',
}

function uid() { return Math.random().toString(36).slice(2) }

export default function StrengthLogger({ workoutType }: { workoutType: 'push' | 'pull' | 'legs' }) {
  const [sets, setSets] = useState<SetEntry[]>([])
  const [progression, setProgression] = useState<ProgressionStatus[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [rating, setRating] = useState(3)

  // Letzte Session laden und vorbelegen
  const loadLastSession = useCallback(async () => {
    const res = await fetch(`/api/strength/last-session?type=${workoutType}`)
    const data = await res.json()
    if (data.session?.sets?.length) {
      setSets(data.session.sets.map((s: Omit<SetEntry, 'id'>) => ({ ...s, id: uid() })))
    } else {
      // Erste Session: Standard-Sätze aus Progressions-Ladder
      setSets(getDefaultSets(workoutType))
    }
  }, [workoutType])

  useEffect(() => {
    loadLastSession()
    fetch('/api/strength').then(r => r.json()).then(d => setProgression(d.progression ?? []))
  }, [loadLastSession])

  function addSet(pattern: string) {
    const existing = sets.filter(s => s.movement_pattern === pattern)
    const last = existing[existing.length - 1]
    setSets(prev => [...prev, {
      id: uid(),
      movement_pattern: pattern,
      exercise_name: last?.exercise_name ?? PATTERN_LABEL[pattern] ?? pattern,
      skill_level: last?.skill_level ?? 1,
      set_number: existing.length + 1,
      reps: last?.reps ?? 8,
      added_weight_kg: last?.added_weight_kg ?? 0,
      rir: last?.rir ?? 2,
    }])
  }

  function removeSet(id: string) {
    setSets(prev => prev.filter(s => s.id !== id))
  }

  function updateSet(id: string, field: keyof SetEntry, delta: number | string) {
    setSets(prev => prev.map(s => {
      if (s.id !== id) return s
      if (typeof delta === 'number') {
        const val = (s[field] as number) + delta
        const min = field === 'reps' ? 1 : field === 'rir' ? 0 : field === 'added_weight_kg' ? 0 : 0
        const max = field === 'rir' ? 5 : 999
        return { ...s, [field]: Math.min(max, Math.max(min, val)) }
      }
      return { ...s, [field]: delta }
    }))
  }

  async function handleSave() {
    if (!sets.length) return
    setSaving(true)
    try {
      await fetch('/api/strength', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workout_type: workoutType, sets, subjective_rating: rating }),
      })
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const patterns = WORKOUT_MOVEMENTS[workoutType] ?? []

  return (
    <div className="space-y-4">
      {/* Progressions-Status */}
      {progression.filter(p => patterns.includes(p.movement_pattern)).map(p => (
        <div key={p.movement_pattern} className={`card-sm flex items-center justify-between
          ${p.progression_criteria_met ? 'border-prime/50 bg-prime/5' : ''}`}>
          <div>
            <div className="text-sm font-semibold text-slate-200">
              {PATTERN_LABEL[p.movement_pattern]} – Level {p.current_skill_level}
            </div>
            <div className="text-xs text-slate-400">{p.current_exercise}</div>
            <div className="text-xs text-slate-500 mt-0.5">Kriterium: {p.advancement_criteria}</div>
          </div>
          {p.progression_criteria_met && (
            <div className="badge-prime shrink-0">Aufstieg möglich!</div>
          )}
        </div>
      ))}

      {/* Satz-Einträge */}
      {patterns.map(pattern => {
        const patternSets = sets.filter(s => s.movement_pattern === pattern)
        return (
          <div key={pattern} className="card space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-slate-200">{PATTERN_LABEL[pattern] ?? pattern}</h4>
              <button
                onClick={() => addSet(pattern)}
                className="text-xs text-prime hover:text-prime-dark font-semibold transition-colors"
              >
                + Satz
              </button>
            </div>

            {patternSets.length === 0 && (
              <p className="text-xs text-slate-500">Noch keine Sätze.</p>
            )}

            {patternSets.map((set, i) => (
              <SetRow key={set.id} set={set} index={i}
                onChange={(field, delta) => updateSet(set.id, field, delta)}
                onRemove={() => removeSet(set.id)}
              />
            ))}
          </div>
        )
      })}

      {/* Session-Bewertung */}
      <div className="card-sm">
        <div className="stat-label mb-2">Session-Bewertung</div>
        <div className="flex gap-2">
          {[1,2,3,4,5].map(n => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={`text-xl transition-transform ${n <= rating ? 'scale-110' : 'opacity-30'}`}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      {saved ? (
        <div className="card-sm text-center text-prime font-semibold">
          Session gespeichert!
        </div>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving || !sets.length}
          className="btn-primary w-full disabled:opacity-50"
        >
          {saving ? 'Speichern…' : 'Session speichern'}
        </button>
      )}
    </div>
  )
}

function SetRow({
  set, index, onChange, onRemove
}: {
  set: SetEntry
  index: number
  onChange: (field: keyof SetEntry, delta: number | string) => void
  onRemove: () => void
}) {
  const rirColor = set.rir === 0 ? 'text-low' :
                   set.rir === 1 ? 'text-moderate' : 'text-prime'

  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
      {/* Set-Nummer */}
      <span className="stat-label text-center w-6">{index + 1}</span>

      {/* Wiederholungen */}
      <StepField label="Wdh" value={set.reps} step={1}
        onChange={d => onChange('reps', d)} />

      {/* Zusatzlast */}
      <StepField label="kg+" value={set.added_weight_kg} step={2.5}
        onChange={d => onChange('added_weight_kg', d)} />

      {/* RIR */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="stat-label">RIR</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange('rir', -1)}
            className="w-6 h-6 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">–</button>
          <span className={`w-5 text-center font-bold text-sm ${rirColor}`}>{set.rir}</span>
          <button onClick={() => onChange('rir', 1)}
            className="w-6 h-6 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">+</button>
        </div>
      </div>

      {/* Löschen */}
      <button onClick={onRemove} className="text-slate-600 hover:text-low text-sm transition-colors">✕</button>
    </div>
  )
}

function StepField({
  label, value, step, onChange
}: {
  label: string; value: number; step: number
  onChange: (delta: number) => void
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="stat-label">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(-step)}
          className="w-7 h-7 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">–</button>
        <span className="w-10 text-center font-bold text-slate-100 text-sm">
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
        <button onClick={() => onChange(step)}
          className="w-7 h-7 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 text-sm">+</button>
      </div>
    </div>
  )
}

function getDefaultSets(workoutType: string): SetEntry[] {
  const defaults: Record<string, Array<Omit<SetEntry, 'id'>>> = {
    push: [
      { movement_pattern: 'push', exercise_name: 'Push-up', skill_level: 1,
        set_number: 1, reps: 10, added_weight_kg: 0, rir: 2 },
      { movement_pattern: 'push', exercise_name: 'Push-up', skill_level: 1,
        set_number: 2, reps: 10, added_weight_kg: 0, rir: 2 },
      { movement_pattern: 'push', exercise_name: 'Push-up', skill_level: 1,
        set_number: 3, reps: 10, added_weight_kg: 0, rir: 2 },
    ],
    pull: [
      { movement_pattern: 'pullup', exercise_name: 'Bodyweight Pull-up', skill_level: 3,
        set_number: 1, reps: 6, added_weight_kg: 0, rir: 2 },
      { movement_pattern: 'pullup', exercise_name: 'Bodyweight Pull-up', skill_level: 3,
        set_number: 2, reps: 6, added_weight_kg: 0, rir: 2 },
      { movement_pattern: 'pullup', exercise_name: 'Bodyweight Pull-up', skill_level: 3,
        set_number: 3, reps: 6, added_weight_kg: 0, rir: 2 },
    ],
    legs: [
      { movement_pattern: 'leg', exercise_name: 'Bulgarian Split Squat', skill_level: 2,
        set_number: 1, reps: 10, added_weight_kg: 0, rir: 2 },
      { movement_pattern: 'leg', exercise_name: 'Bulgarian Split Squat', skill_level: 2,
        set_number: 2, reps: 10, added_weight_kg: 0, rir: 2 },
      { movement_pattern: 'leg', exercise_name: 'Bulgarian Split Squat', skill_level: 2,
        set_number: 3, reps: 10, added_weight_kg: 0, rir: 2 },
    ],
  }
  return (defaults[workoutType] ?? []).map(s => ({ ...s, id: uid() }))
}
