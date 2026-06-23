'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface Profile {
  current_phase: string
  lthr: number | null
  daily_steps_goal: number | null
  tdee_kcal_current: number | null
  hr_zone1_low: number | null
  hr_zone2_low: number | null
  hr_zone2_high: number | null
  hr_zone3_low: number | null
  hr_zone4_low: number | null
  hr_zone5_low: number | null
  hr_zone5_high: number | null
  hr_zones_source: string | null
  garmin_username: string | null
  weeks_since_deload: number
  last_deload_date: string | null
  name: string
  email: string
}

interface ProfileData {
  profile: Profile | null
  lastInput: { weight_kg: number; body_fat_pct: number; entry_date: string } | null
  syncStatus: { status: string; finished_at: string } | null
}

interface GarminStatus {
  connected: boolean
  status: string
  garmin_username: string | null
  last_refreshed_at: string | null
  error_message: string | null
  last_sync: { status: string; finished_at: string | null } | null
}

export default function SettingsClient() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [form, setForm] = useState({
    lthr: '',
    daily_steps_goal: '',
    current_phase: 'cut',
    sex: 'male',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Goals
  const [goals, setGoals] = useState({
    target_weight_kg: '', target_body_fat_pct: '',
    weekly_strength_sessions: '3', weekly_cardio_sessions: '2',
    target_date: '',
  })
  const [goalsSaved, setGoalsSaved] = useState(false)

  // Garmin credentials
  const [garminStatus, setGarminStatus] = useState<GarminStatus | null>(null)
  const [garminForm, setGarminForm] = useState({ email: '', password: '' })
  const [garminSaving, setGarminSaving] = useState(false)
  const [garminMsg, setGarminMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then((d: ProfileData) => {
      setData(d)
      if (d.profile) {
        setForm({
          lthr: d.profile.lthr?.toString() ?? '',
          daily_steps_goal: d.profile.daily_steps_goal?.toString() ?? '8000',
          current_phase: d.profile.current_phase ?? 'cut',
          sex: (d.profile as Record<string, unknown>).sex as string ?? 'male',
        })
      }
    })
    fetch('/api/garmin/credentials').then(r => r.json()).then(setGarminStatus)
    fetch('/api/profile/goals').then(r => r.json()).then(d => {
      if (d.goals) setGoals({
        target_weight_kg: d.goals.target_weight_kg?.toString() ?? '',
        target_body_fat_pct: d.goals.target_body_fat_pct?.toString() ?? '',
        weekly_strength_sessions: d.goals.weekly_strength_sessions?.toString() ?? '3',
        weekly_cardio_sessions: d.goals.weekly_cardio_sessions?.toString() ?? '2',
        target_date: d.goals.target_date ?? '',
      })
    })
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  async function handleGoalsSave() {
    setGoalsSaved(false)
    await fetch('/api/profile/goals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_weight_kg: goals.target_weight_kg ? Number(goals.target_weight_kg) : null,
        target_body_fat_pct: goals.target_body_fat_pct ? Number(goals.target_body_fat_pct) : null,
        weekly_strength_sessions: Number(goals.weekly_strength_sessions),
        weekly_cardio_sessions: Number(goals.weekly_cardio_sessions),
        target_date: goals.target_date || null,
      }),
    })
    setGoalsSaved(true)
  }

  async function handleGarminSave() {
    setGarminSaving(true)
    setGarminMsg(null)
    const res = await fetch('/api/garmin/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ garmin_email: garminForm.email, garmin_password: garminForm.password }),
    })
    const json = await res.json()
    setGarminSaving(false)
    if (!res.ok) {
      setGarminMsg({ type: 'err', text: json.error ?? 'Fehler beim Speichern' })
      return
    }
    setGarminMsg({ type: 'ok', text: json.message })
    setGarminForm({ email: '', password: '' })
    // Sync-Status alle 5s pollen bis fertig
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const s: GarminStatus = await fetch('/api/garmin/credentials').then(r => r.json())
      setGarminStatus(s)
      if (s.last_sync?.status !== 'running') {
        if (pollRef.current) clearInterval(pollRef.current)
        if (s.last_sync?.status === 'error') {
          setGarminMsg({ type: 'err', text: 'Sync fehlgeschlagen – Credentials prüfen.' })
        } else if (s.last_sync?.status === 'done') {
          setGarminMsg({ type: 'ok', text: 'Sync erfolgreich. Daten werden geladen.' })
        }
      }
    }, 5000)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const payload: Record<string, unknown> = { current_phase: form.current_phase, sex: form.sex }
    if (form.lthr) payload.lthr = Number(form.lthr)
    if (form.daily_steps_goal) payload.daily_steps_goal = Number(form.daily_steps_goal)

    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    setSaved(true)
    // Profil neu laden
    const res = await fetch('/api/profile')
    setData(await res.json())
  }

  const p = data?.profile

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Einstellungen</h1>

      {/* Profil-Info */}
      {p && (
        <div className="card space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">👤</span>
            <div>
              <div className="font-semibold text-slate-200">{p.name}</div>
              <div className="text-xs text-slate-400">{p.email}</div>
            </div>
          </div>
        </div>
      )}

      {/* Trainingsphase */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-200">Trainingsphase</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { key: 'cut', label: 'Schnitt', desc: '−20% TDEE' },
            { key: 'maintenance', label: 'Erhalt', desc: '±0 kcal' },
            { key: 'bulk', label: 'Aufbau', desc: '+10% TDEE' },
            { key: 'baseline_building', label: 'Baseline', desc: 'Zone-2-Fokus' },
          ].map(phase => (
            <button
              key={phase.key}
              onClick={() => setForm(f => ({ ...f, current_phase: phase.key }))}
              className={`p-3 rounded-xl border transition-all text-left ${
                form.current_phase === phase.key
                  ? 'border-prime bg-prime/10'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="font-medium text-slate-200 text-sm">{phase.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{phase.desc}</div>
            </button>
          ))}
        </div>
        {form.current_phase === 'baseline_building' && (
          <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Baseline Building: Zone-2-Wochenplan (Mo/Mi/Fr Zone 2, Di/Do/Sa Mobilität). Kein Deload-Trigger – aerobe Basis aufbauen.
          </p>
        )}
        {p && (
          <p className="text-xs text-slate-500">
            Aktuelle Phase: <span className="text-slate-300">{p.current_phase}</span>
            {p.weeks_since_deload > 0 && ` · ${p.weeks_since_deload} Wochen seit letztem Deload`}
          </p>
        )}
      </div>

      {/* LTHR + HR-Zonen */}
      <div className="card space-y-4">
        <div>
          <h2 className="font-semibold text-slate-200">Laktatschwelle (LTHR)</h2>
          <p className="text-xs text-slate-400 mt-1">
            HR beim Laktatschwellen-Test (Garmin LTHR oder 1h-Maximalleistung). Alle 5 Zonen werden automatisch berechnet.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="input-field w-32"
            placeholder="z.B. 168"
            value={form.lthr}
            onChange={e => setForm(f => ({ ...f, lthr: e.target.value }))}
          />
          <span className="text-sm text-slate-400">bpm</span>
        </div>

        {/* Zonenvorschau */}
        {(form.lthr || p?.lthr) && (
          <div className="space-y-1.5">
            {(() => {
              const lthr = Number(form.lthr || p?.lthr)
              const zones = [
                { label: 'Zone 1 (Recovery)',  low: Math.round(lthr * 0.60), high: Math.round(lthr * 0.72), color: '#22c55e' },
                { label: 'Zone 2 (Aerob)',      low: Math.round(lthr * 0.72), high: Math.round(lthr * 0.82), color: '#86efac' },
                { label: 'Zone 3 (Tempo)',      low: Math.round(lthr * 0.82), high: Math.round(lthr * 0.89), color: '#f59e0b' },
                { label: 'Zone 4 (Schwelle)',   low: Math.round(lthr * 0.89), high: Math.round(lthr * 0.97), color: '#f97316' },
                { label: 'Zone 5 (VO2max)',     low: Math.round(lthr * 0.97), high: Math.round(lthr * 1.05), color: '#ef4444' },
              ]
              return zones.map(z => (
                <div key={z.label} className="flex items-center gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color }} />
                  <span className="text-slate-300 w-36">{z.label}</span>
                  <span className="text-slate-400">{z.low}–{z.high} bpm</span>
                </div>
              ))
            })()}
            <p className="text-xs text-slate-500 mt-1">
              Quelle: {p?.hr_zones_source === 'lthr' ? 'LTHR-berechnet' : p?.hr_zones_source ?? 'noch nicht gesetzt'}
            </p>
          </div>
        )}
      </div>

      {/* Biologisches Geschlecht */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-slate-200">Profil</h2>
        <label className="block">
          <span className="text-xs text-slate-400 mb-1.5 block">Biologisches Geschlecht</span>
          <div className="flex gap-2">
            {[
              { key: 'male', label: 'Männlich' },
              { key: 'female', label: 'Weiblich' },
              { key: 'other', label: 'Divers' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setForm(f => ({ ...f, sex: s.key }))}
                className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                  form.sex === s.key
                    ? 'border-prime bg-prime/10 text-slate-100'
                    : 'border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </label>
        {form.sex === 'female' && (
          <p className="text-xs text-slate-400 bg-white/5 rounded-lg px-3 py-2">
            Für Frauen empfehlen wir als Einstieg die Phase <strong className="text-slate-300">Baseline</strong> – Zone-2-Fokus zum Aufbau aerober Kapazität vor dem Krafttraining.
          </p>
        )}
      </div>

      {/* Schritte-Ziel */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-slate-200">Tagesziel Schritte</h2>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="input-field w-32"
            placeholder="8000"
            value={form.daily_steps_goal}
            onChange={e => setForm(f => ({ ...f, daily_steps_goal: e.target.value }))}
          />
          <span className="text-sm text-slate-400">Schritte/Tag</span>
        </div>
        <p className="text-xs text-slate-500">
          NEAT-Warnung wird ausgelöst wenn 7-Tage-Mittel &gt;15% unter dem Vormonats-Durchschnitt liegt.
        </p>
      </div>

      {/* Letztes Körpergewicht */}
      {data?.lastInput && (
        <div className="card-sm">
          <div className="stat-label">Letzte Gewichtseingabe</div>
          <div className="text-slate-200 mt-1">
            {data.lastInput.weight_kg} kg · {data.lastInput.body_fat_pct}% KFA ·{' '}
            {new Date(data.lastInput.entry_date).toLocaleDateString('de-DE')}
          </div>
        </div>
      )}

      {/* TDEE */}
      {p?.tdee_kcal_current && (
        <div className="card-sm">
          <div className="stat-label">Aktueller TDEE</div>
          <div className="text-2xl font-black text-slate-100 mt-1">{p.tdee_kcal_current} kcal</div>
          <p className="text-xs text-slate-500 mt-1">
            Wird durch 14-Tage-Kalibrierung automatisch angepasst (Dashboard → TDEE-Kalibrierung).
          </p>
        </div>
      )}

      {/* Ziele */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-200">Meine Ziele</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-slate-400 mb-1 block">Zielgewicht</span>
            <div className="flex items-center gap-1">
              <input type="number" className="input-field w-full" placeholder="75.0"
                value={goals.target_weight_kg}
                onChange={e => setGoals(g => ({ ...g, target_weight_kg: e.target.value }))} />
              <span className="text-xs text-slate-500">kg</span>
            </div>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400 mb-1 block">Ziel-KFA</span>
            <div className="flex items-center gap-1">
              <input type="number" className="input-field w-full" placeholder="15.0"
                value={goals.target_body_fat_pct}
                onChange={e => setGoals(g => ({ ...g, target_body_fat_pct: e.target.value }))} />
              <span className="text-xs text-slate-500">%</span>
            </div>
          </label>
          <label className="block">
            <span className="text-xs text-slate-400 mb-1 block">Kraft/Woche</span>
            <input type="number" min="0" max="7" className="input-field w-full"
              value={goals.weekly_strength_sessions}
              onChange={e => setGoals(g => ({ ...g, weekly_strength_sessions: e.target.value }))} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-400 mb-1 block">Cardio/Woche</span>
            <input type="number" min="0" max="7" className="input-field w-full"
              value={goals.weekly_cardio_sessions}
              onChange={e => setGoals(g => ({ ...g, weekly_cardio_sessions: e.target.value }))} />
          </label>
        </div>
        <label className="block">
          <span className="text-xs text-slate-400 mb-1 block">Zieldatum</span>
          <input type="date" className="input-field w-full"
            value={goals.target_date}
            onChange={e => setGoals(g => ({ ...g, target_date: e.target.value }))} />
        </label>
        <button onClick={handleGoalsSave} className="btn-primary w-full">Ziele speichern</button>
        {goalsSaved && <p className="text-xs text-prime text-center">Ziele gespeichert ✓</p>}
      </div>

      {/* Garmin-Verbindung */}
      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-200">Garmin Connect</h2>
            <p className="text-xs text-slate-400 mt-1">
              E-Mail und Passwort werden einmalig zum Token-Erstellen verwendet. Das Passwort wird nicht gespeichert.
            </p>
          </div>
          {garminStatus && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
              garminStatus.connected
                ? 'bg-prime/20 text-prime'
                : garminStatus.status === 'error'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-slate-700 text-slate-400'
            }`}>
              {garminStatus.connected ? 'Verbunden' : garminStatus.status === 'error' ? 'Fehler' : 'Nicht verbunden'}
            </span>
          )}
        </div>

        {garminStatus?.connected && (
          <div className="text-xs text-slate-400 space-y-0.5">
            <div>Konto: <span className="text-slate-300">{garminStatus.garmin_username}</span></div>
            {garminStatus.last_sync && (
              <div>
                Letzter Sync:{' '}
                <span className={garminStatus.last_sync.status === 'done' ? 'text-prime' : garminStatus.last_sync.status === 'running' ? 'text-amber-400' : 'text-red-400'}>
                  {garminStatus.last_sync.status === 'running' ? 'läuft…' : garminStatus.last_sync.finished_at ? new Date(garminStatus.last_sync.finished_at).toLocaleString('de-DE') : '—'}
                </span>
              </div>
            )}
            {garminStatus.error_message && (
              <div className="text-red-400 mt-1">{garminStatus.error_message}</div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <input
            type="email"
            className="input-field w-full"
            placeholder="Garmin-E-Mail"
            value={garminForm.email}
            onChange={e => setGarminForm(f => ({ ...f, email: e.target.value }))}
            autoComplete="off"
          />
          <input
            type="password"
            className="input-field w-full"
            placeholder="Garmin-Passwort"
            value={garminForm.password}
            onChange={e => setGarminForm(f => ({ ...f, password: e.target.value }))}
            autoComplete="new-password"
          />
        </div>
        <button
          onClick={handleGarminSave}
          disabled={garminSaving || !garminForm.email || !garminForm.password}
          className="btn-primary w-full"
        >
          {garminSaving ? 'Verbinde…' : garminStatus?.connected ? 'Token erneuern' : 'Mit Garmin verbinden'}
        </button>
        {garminMsg && (
          <p className={`text-sm text-center ${garminMsg.type === 'ok' ? 'text-prime' : 'text-red-400'}`}>
            {garminMsg.text}
          </p>
        )}
      </div>

      {/* Speichern */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full"
      >
        {saving ? 'Wird gespeichert…' : 'Einstellungen speichern'}
      </button>

      {saved && (
        <p className="text-sm text-prime text-center">Gespeichert ✓{form.lthr ? ' · HR-Zonen aktualisiert' : ''}</p>
      )}

      {/* Daten-Export */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-slate-200">Daten-Export</h2>
        <p className="text-xs text-slate-400">CSV-Dateien für Excel / Numbers</p>
        <div className="flex flex-wrap gap-2">
          {[
            { type: 'weight',    label: 'Gewichtsverlauf' },
            { type: 'readiness', label: 'Readiness-Verlauf' },
            { type: 'strength',  label: 'Krafttraining' },
          ].map(ex => (
            <a
              key={ex.type}
              href={`/api/export/csv?type=${ex.type}`}
              download
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:border-white/20 hover:text-slate-100 transition-all"
            >
              {ex.label} ↓
            </a>
          ))}
        </div>
        <div className="pt-1 border-t border-white/5">
          <a
            href="/api/export/full"
            download
            className="text-xs px-3 py-1.5 rounded-lg border border-prime/30 text-prime hover:border-prime/60 transition-all inline-block"
          >
            Vollständiger JSON-Export (ZIP) ↓
          </a>
          <p className="text-xs text-slate-500 mt-1">
            Enthält alle Daten: Profil, Gewicht, Readiness, Training, Mahlzeiten, Garmin-Metriken
          </p>
        </div>
      </div>

      {/* Quicklinks */}
      <div className="flex gap-3">
        <Link href="/settings/zones" className="flex-1 card-sm text-center text-sm text-slate-400 hover:text-slate-200 transition-all">
          Lauf-Pace-Zonen →
        </Link>
        <Link href="/onboarding" className="flex-1 card-sm text-center text-sm text-slate-400 hover:text-slate-200 transition-all">
          Einrichtungs-Wizard →
        </Link>
      </div>
    </div>
  )
}
