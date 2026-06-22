'use client'
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
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
        })
      }
    })
    fetch('/api/garmin/credentials').then(r => r.json()).then(setGarminStatus)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

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
    const payload: Record<string, unknown> = { current_phase: form.current_phase }
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
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'cut', label: 'Schnitt', desc: '−20% TDEE' },
            { key: 'maintenance', label: 'Erhalt', desc: '±0 kcal' },
            { key: 'bulk', label: 'Aufbau', desc: '+10% TDEE' },
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
    </div>
  )
}
