'use client'
import { useState } from 'react'

interface Props {
  initial?: { weight_kg?: number; body_fat_pct?: number; alcohol_units?: number; training_time?: string | null; workout_type?: string | null }
  onSave: (data: { weight_kg: number; body_fat_pct: number; alcohol_units?: number }) => void
  onClose: () => void
}

const WORKOUT_TYPES = [
  { value: '', label: '— Wochenplan —' },
  { value: 'push', label: 'Push (Kraft)' },
  { value: 'pull', label: 'Pull (Kraft)' },
  { value: 'legs', label: 'Legs (Kraft)' },
  { value: 'strength', label: 'Kraft' },
  { value: 'zone2', label: 'Zone 2 (Lauf)' },
  { value: 'vo2max', label: 'VO2max / Intervalle' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'mobility', label: 'Mobilität' },
  { value: 'rest', label: 'Ruhetag' },
]

export default function DailyInputModal({ initial, onSave, onClose }: Props) {
  const [weight, setWeight] = useState(String(initial?.weight_kg ?? ''))
  const [fat, setFat] = useState(String(initial?.body_fat_pct ?? ''))
  const [alcohol, setAlcohol] = useState(String(initial?.alcohol_units ?? '0'))
  const [trainingTime, setTrainingTime] = useState(initial?.training_time?.slice(0, 5) ?? '')
  const [workoutType, setWorkoutType] = useState(initial?.workout_type ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const w = parseFloat(weight)
    const f = parseFloat(fat)
    const a = parseInt(alcohol) || 0
    if (isNaN(w) || w < 30 || w > 250) { setError('Gewicht ungültig (30–250 kg)'); return }
    if (isNaN(f) || f < 3  || f > 60)  { setError('KFA ungültig (3–60%)'); return }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/daily-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: w, body_fat_pct: f, alcohol_units: a,
          training_time: trainingTime || null,
          workout_type: workoutType || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onSave({ weight_kg: w, body_fat_pct: f, alcohol_units: a })
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  // Live-Vorschau
  const w = parseFloat(weight)
  const f = parseFloat(fat)
  const lean = (!isNaN(w) && !isNaN(f)) ? Math.round(w * (1 - f/100) * 10)/10 : null
  const bmr  = lean ? Math.round(370 + 21.6 * lean) : null
  const alcoholUnits = parseInt(alcohol) || 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-input-title"
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div className="card w-full max-w-sm space-y-5">
        <div className="flex items-center justify-between">
          <h2 id="daily-input-title" className="text-lg font-bold text-slate-100">Tageseingabe</h2>
          <button
            onClick={onClose}
            aria-label="Dialog schließen"
            className="text-slate-400 hover:text-slate-100 text-xl leading-none"
          >✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="input-weight" className="stat-label block mb-1.5">Körpergewicht (kg)</label>
            <input
              id="input-weight"
              type="number" step="0.1" min="30" max="250"
              className="input-field w-full"
              placeholder="91.0"
              value={weight}
              onChange={e => setWeight(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="input-fat" className="stat-label block mb-1.5">Körperfettanteil (%)</label>
            <input
              id="input-fat"
              type="number" step="0.1" min="3" max="60"
              className="input-field w-full"
              placeholder="18.8"
              value={fat}
              onChange={e => setFat(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="input-alcohol" className="stat-label block mb-1.5">
              Alkohol (Einheiten gestern)
              <span className="text-slate-500 font-normal ml-1.5">1 Einheit ≈ 0,3L Bier / 0,2L Wein</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="input-alcohol"
                type="number" step="1" min="0" max="20"
                className="input-field w-24"
                value={alcohol}
                onChange={e => setAlcohol(e.target.value)}
              />
              <span className="text-sm text-slate-400">Einheiten</span>
            </div>
            {alcoholUnits > 0 && (
              <p className="text-xs text-amber-400 mt-1">
                Alkohol stört Testosteron, Schlaf und Muskelproteinsynthese.
                {alcoholUnits >= 3 ? ' Readiness-Warnung aktiv.' : ''}
              </p>
            )}
          </div>

          {/* Trainingszeit heute (Override – sonst gilt der Wochenplan) */}
          <div>
            <label htmlFor="input-workout-type" className="stat-label block mb-1.5">
              Training heute
              <span className="text-slate-500 font-normal ml-1.5">überschreibt Wochenplan für heute</span>
            </label>
            <div className="flex items-center gap-2">
              <select
                id="input-workout-type"
                className="input-field flex-1 min-w-0"
                value={workoutType}
                onChange={e => setWorkoutType(e.target.value)}
              >
                {WORKOUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input
                id="input-training-time"
                type="time"
                aria-label="Trainingszeit heute"
                className="input-field w-28 shrink-0 disabled:opacity-30"
                value={trainingTime}
                disabled={workoutType === '' || workoutType === 'rest' || workoutType === 'mobility'}
                onChange={e => setTrainingTime(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Pre-/Post-Workout-Mahlzeiten richten sich nach dieser Zeit.
            </p>
          </div>
        </div>

        {/* Live-Vorschau */}
        {lean !== null && bmr !== null && (
          <div className="bg-white/5 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Magermasse</span>
              <span className="font-semibold text-slate-200">{lean} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">BMR (Katch-McArdle)</span>
              <span className="font-semibold text-slate-200">{bmr} kcal</span>
            </div>
          </div>
        )}

        {error && <p className="text-low text-sm">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Abbrechen</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Speichern…' : 'Speichern & Makros berechnen'}
          </button>
        </div>
      </div>
    </div>
  )
}
