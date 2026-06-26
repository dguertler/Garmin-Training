'use client'
import { useEffect, useState } from 'react'

interface Entry { time: string; type: string }
type Schedule = Record<string, Entry>

// JS getDay(): 0=So … 6=Sa. Anzeige beginnt mit Montag.
const DAYS: { dow: string; label: string }[] = [
  { dow: '1', label: 'Montag' },
  { dow: '2', label: 'Dienstag' },
  { dow: '3', label: 'Mittwoch' },
  { dow: '4', label: 'Donnerstag' },
  { dow: '5', label: 'Freitag' },
  { dow: '6', label: 'Samstag' },
  { dow: '0', label: 'Sonntag' },
]

const TYPES: { value: string; label: string; training: boolean }[] = [
  { value: '', label: '— frei —', training: false },
  { value: 'push', label: 'Push (Kraft)', training: true },
  { value: 'pull', label: 'Pull (Kraft)', training: true },
  { value: 'legs', label: 'Legs (Kraft)', training: true },
  { value: 'strength', label: 'Kraft', training: true },
  { value: 'zone2', label: 'Zone 2 (Lauf)', training: true },
  { value: 'vo2max', label: 'VO2max / Intervalle', training: true },
  { value: 'cardio', label: 'Cardio', training: true },
  { value: 'mobility', label: 'Mobilität', training: false },
  { value: 'rest', label: 'Ruhetag', training: false },
]

function defaultTime() { return '18:00' }

export default function TrainingScheduleEditor({ onSaved }: { onSaved?: () => void }) {
  const [schedule, setSchedule] = useState<Schedule>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/training-schedule').then(r => r.json()).then(d => {
      const s: Schedule = {}
      if (d.schedule) {
        for (const [k, v] of Object.entries(d.schedule as Record<string, { time?: string | null; type?: string | null }>)) {
          s[k] = { time: v.time ?? '', type: v.type ?? '' }
        }
      }
      setSchedule(s)
      setLoaded(true)
    })
  }, [])

  function setType(dow: string, type: string) {
    setSaved(false)
    setSchedule(prev => {
      const next = { ...prev }
      if (!type) {
        delete next[dow]
      } else {
        next[dow] = { type, time: prev[dow]?.time || defaultTime() }
      }
      return next
    })
  }

  function setTime(dow: string, time: string) {
    setSaved(false)
    setSchedule(prev => ({ ...prev, [dow]: { type: prev[dow]?.type || 'strength', time } }))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch('/api/training-schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedule }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      onSaved?.()
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-semibold text-slate-200">Trainingskalender</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Trainingszeit pro Wochentag festlegen — der Mahlzeitenplan legt Pre-/Post-Workout-Mahlzeiten automatisch darum herum.
        </p>
      </div>

      {!loaded ? (
        <p className="text-sm text-slate-500 animate-pulse">Lade Plan…</p>
      ) : (
        <div className="space-y-1.5">
          {DAYS.map(({ dow, label }) => {
            const entry = schedule[dow]
            const type = entry?.type ?? ''
            const meta = TYPES.find(t => t.value === type)
            const isTraining = meta?.training ?? false
            return (
              <div key={dow} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2">
                <span className="text-xs font-medium text-slate-300 w-20 shrink-0">{label}</span>
                <select
                  value={type}
                  onChange={e => setType(dow, e.target.value)}
                  aria-label={`${label} Trainingsart`}
                  className="input-field flex-1 min-w-0 text-sm py-1.5"
                >
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <input
                  type="time"
                  value={entry?.time ?? ''}
                  onChange={e => setTime(dow, e.target.value)}
                  disabled={!isTraining}
                  aria-label={`${label} Trainingszeit`}
                  className="input-field w-24 shrink-0 text-sm py-1.5 disabled:opacity-30"
                />
              </div>
            )
          })}
        </div>
      )}

      <button onClick={save} disabled={saving || !loaded} className="btn-primary w-full">
        {saving ? 'Speichere…' : 'Trainingsplan speichern'}
      </button>
      {saved && <p className="text-xs text-prime text-center">Gespeichert ✓ – Mahlzeiten-Timing aktualisiert.</p>}
    </div>
  )
}
