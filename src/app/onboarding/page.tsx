'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

type Step = 1 | 2 | 3 | 4

interface FormState {
  // Step 1
  weight_kg: string
  body_fat_pct: string
  // Step 2
  lthr: string
  // Step 3
  current_phase: string
  daily_steps_goal: string
  // Step 4
  garmin_email: string
  garmin_password: string
}

const PHASE_OPTIONS = [
  { key: 'cut',         label: 'Schnitt',  desc: 'Kaloriendefizit −20%' },
  { key: 'maintenance', label: 'Erhalt',   desc: 'Kalorienmaintenance' },
  { key: 'bulk',        label: 'Aufbau',   desc: 'Kalorienüberschuss +10%' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>({
    weight_kg: '', body_fat_pct: '',
    lthr: '',
    current_phase: 'cut', daily_steps_goal: '8000',
    garmin_email: '', garmin_password: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [syncJobId, setSyncJobId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function set(k: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }))
  }

  async function handleNext() {
    if (step < 4) {
      setStep((s) => (s + 1) as Step)
      return
    }
    // Step 4 – finalize
    setSaving(true)
    setMsg(null)

    // 1. Profil aktualisieren (Phase, Schritte, LTHR)
    const profilePayload: Record<string, unknown> = {
      current_phase: form.current_phase,
      daily_steps_goal: Number(form.daily_steps_goal) || 8000,
    }
    if (form.lthr) profilePayload.lthr = Number(form.lthr)

    const profileRes = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profilePayload),
    })
    if (!profileRes.ok) {
      setSaving(false)
      setMsg({ type: 'err', text: 'Profil konnte nicht gespeichert werden.' })
      return
    }

    // 2. Körpergewicht eintragen
    if (form.weight_kg) {
      await fetch('/api/daily-input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight_kg: Number(form.weight_kg),
          body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null,
        }),
      })
    }

    // 3. Garmin-Credentials speichern + Sync auslösen
    if (form.garmin_email && form.garmin_password) {
      const garminRes = await fetch('/api/garmin/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmin_email: form.garmin_email,
          garmin_password: form.garmin_password,
        }),
      })
      const garminJson = await garminRes.json()
      if (garminRes.ok) {
        setSyncJobId(garminJson.job_id)
        setSyncStatus('running')
        // Sync-Status pollen
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(async () => {
          const s = await fetch('/api/garmin/credentials').then(r => r.json())
          const status = s.last_sync?.status
          setSyncStatus(status ?? null)
          if (status !== 'running') {
            if (pollRef.current) clearInterval(pollRef.current)
            if (status === 'done') {
              setSaving(false)
              setTimeout(() => router.push('/dashboard'), 1500)
            } else {
              setSaving(false)
              setMsg({ type: 'err', text: 'Garmin-Sync fehlgeschlagen – Credentials prüfen.' })
            }
          }
        }, 4000)
        return
      }
    }

    setSaving(false)
    router.push('/dashboard')
  }

  const lthr = Number(form.lthr)
  const zones = lthr > 0 ? [
    { label: 'Zone 1', low: Math.round(lthr * 0.60), high: Math.round(lthr * 0.72), color: '#22c55e' },
    { label: 'Zone 2', low: Math.round(lthr * 0.72), high: Math.round(lthr * 0.82), color: '#86efac' },
    { label: 'Zone 3', low: Math.round(lthr * 0.82), high: Math.round(lthr * 0.89), color: '#f59e0b' },
    { label: 'Zone 4', low: Math.round(lthr * 0.89), high: Math.round(lthr * 0.97), color: '#f97316' },
    { label: 'Zone 5', low: Math.round(lthr * 0.97), high: Math.round(lthr * 1.05), color: '#ef4444' },
  ] : []

  const steps: { num: Step; label: string }[] = [
    { num: 1, label: 'Körper' },
    { num: 2, label: 'Zonen' },
    { num: 3, label: 'Phase' },
    { num: 4, label: 'Garmin' },
  ]

  const canProceed = (): boolean => {
    if (step === 1) return !!form.weight_kg
    if (step === 4) return !saving
    return true
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-100">Einrichtung</h1>
          <p className="text-sm text-slate-400 mt-1">Schritt {step} von 4</p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {steps.map(s => (
            <div
              key={s.num}
              className={`flex items-center gap-1.5 transition-all ${step >= s.num ? 'opacity-100' : 'opacity-30'}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step > s.num ? 'bg-prime text-black' :
                step === s.num ? 'bg-prime/30 border border-prime text-prime' :
                'bg-slate-700 text-slate-400'
              }`}>
                {step > s.num ? '✓' : s.num}
              </div>
              <span className={`text-xs hidden sm:block ${step === s.num ? 'text-slate-300' : 'text-slate-500'}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="card space-y-5">
          {/* Step 1: Gewicht + KFA */}
          {step === 1 && (
            <>
              <div>
                <h2 className="font-semibold text-slate-200 text-lg">Körperdaten</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Werden für TDEE- und Kalorienberechnung verwendet.
                </p>
              </div>
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-slate-400 mb-1 block">Körpergewicht *</span>
                  <div className="flex items-center gap-2">
                    <input type="number" className="input-field w-full" placeholder="80.5" value={form.weight_kg} onChange={set('weight_kg')} />
                    <span className="text-sm text-slate-400 flex-shrink-0">kg</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-400 mb-1 block">Körperfettanteil (optional)</span>
                  <div className="flex items-center gap-2">
                    <input type="number" className="input-field w-full" placeholder="18" value={form.body_fat_pct} onChange={set('body_fat_pct')} />
                    <span className="text-sm text-slate-400 flex-shrink-0">%</span>
                  </div>
                </label>
              </div>
              {form.weight_kg && form.body_fat_pct && (
                <div className="text-xs text-slate-400 bg-slate-800/50 rounded-lg p-3 space-y-1">
                  <div>Mager-Masse: <span className="text-slate-200">{(Number(form.weight_kg) * (1 - Number(form.body_fat_pct) / 100)).toFixed(1)} kg</span></div>
                  <div>Katch-McArdle BMR: <span className="text-slate-200">{Math.round(370 + 21.6 * Number(form.weight_kg) * (1 - Number(form.body_fat_pct) / 100))} kcal</span></div>
                </div>
              )}
            </>
          )}

          {/* Step 2: LTHR */}
          {step === 2 && (
            <>
              <div>
                <h2 className="font-semibold text-slate-200 text-lg">Laktatschwelle (LTHR)</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Deine Herzfrequenz an der Laktatschwelle. Alle 5 Trainingszonen werden daraus berechnet. Wenn du sie nicht kennst, lass das Feld leer – Garmin-Zonen werden dann verwendet.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  className="input-field w-32"
                  placeholder="z.B. 168"
                  value={form.lthr}
                  onChange={set('lthr')}
                />
                <span className="text-sm text-slate-400">bpm</span>
              </div>
              {zones.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-500 font-medium">Berechnete Zonen:</p>
                  {zones.map(z => (
                    <div key={z.label} className="flex items-center gap-3 text-xs">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: z.color }} />
                      <span className="text-slate-300 w-16">{z.label}</span>
                      <span className="text-slate-400">{z.low}–{z.high} bpm</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Step 3: Phase + Schritte */}
          {step === 3 && (
            <>
              <div>
                <h2 className="font-semibold text-slate-200 text-lg">Trainingsphase</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Bestimmt dein Kalorienbudget und die Readiness-Schwellen.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {PHASE_OPTIONS.map(phase => (
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
              <label className="block">
                <span className="text-xs text-slate-400 mb-1 block">Tagesziel Schritte</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    className="input-field w-36"
                    value={form.daily_steps_goal}
                    onChange={set('daily_steps_goal')}
                  />
                  <span className="text-sm text-slate-400">Schritte/Tag</span>
                </div>
              </label>
            </>
          )}

          {/* Step 4: Garmin */}
          {step === 4 && (
            <>
              <div>
                <h2 className="font-semibold text-slate-200 text-lg">Garmin Connect</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Deine Garmin-Zugangsdaten werden einmalig zum Erstellen eines OAuth-Tokens verwendet. Das Passwort wird danach nicht gespeichert.
                </p>
              </div>
              <div className="space-y-3">
                <input
                  type="email"
                  className="input-field w-full"
                  placeholder="garmin@email.com"
                  value={form.garmin_email}
                  onChange={set('garmin_email')}
                  autoComplete="off"
                />
                <input
                  type="password"
                  className="input-field w-full"
                  placeholder="Garmin-Passwort"
                  value={form.garmin_password}
                  onChange={set('garmin_password')}
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-slate-500">
                Du kannst diesen Schritt auch überspringen – Garmin lässt sich jederzeit unter Einstellungen verbinden.
              </p>

              {/* Sync-Status-Anzeige */}
              {syncStatus === 'running' && (
                <div className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-xl p-3">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-sm text-amber-300">Garmin-Daten werden synchronisiert…</span>
                </div>
              )}
              {syncStatus === 'done' && (
                <div className="bg-prime/10 border border-prime/30 rounded-xl p-3 text-sm text-prime">
                  Sync erfolgreich – weiterleiten zum Dashboard…
                </div>
              )}
              {msg?.type === 'err' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400">
                  {msg.text}
                </div>
              )}
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <button
              onClick={() => setStep(s => (s - 1) as Step)}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 text-sm font-medium hover:border-white/20 transition-all"
            >
              Zurück
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving || syncStatus === 'running'}
            className="flex-1 btn-primary py-3"
          >
            {saving && syncStatus === 'running' ? 'Synchronisiere…' :
             step === 4 && !form.garmin_email ? 'Überspringen' :
             step === 4 ? 'Verbinden & starten' :
             'Weiter'}
          </button>
        </div>
      </div>
    </div>
  )
}
