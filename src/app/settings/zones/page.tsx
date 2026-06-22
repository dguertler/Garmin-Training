'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Profile {
  lthr: number | null
  hr_zone1_low: number | null
  hr_zone1_high: number | null
  hr_zone2_low: number | null
  hr_zone2_high: number | null
  hr_zone3_low: number | null
  hr_zone3_high: number | null
  hr_zone4_low: number | null
  hr_zone4_high: number | null
  hr_zone5_low: number | null
  hr_zone5_high: number | null
  hr_zones_source: string | null
}

function calcPaceZone(vo2max: number, lthr: number, zoneIndex: number): { low: string; high: string } {
  // Vdot-Annäherung: Lauftempo aus VO2max + prozentuale LTHR-Zonen
  // Zone-Intensitäten als % der LTHR → Pace via VO2max-Formel
  const ZONE_PCT = [
    [0.60, 0.72],  // Z1
    [0.72, 0.82],  // Z2
    [0.82, 0.89],  // Z3
    [0.89, 0.97],  // Z4
    [0.97, 1.05],  // Z5
  ]

  const [lo, hi] = ZONE_PCT[zoneIndex] ?? [0.8, 0.9]

  // Vereinfachte VO2max → Pace-Konvertierung (Noakes-Formel)
  // Pace in m/min: speed = VO2 / 0.209 × 1000 → Sekunden/km
  function vo2ToPace(pctVO2: number): number {
    const vo2 = vo2max * pctVO2
    const speedMperMin = (vo2 - 3.5) / 0.1 // grobe Annäherung
    if (speedMperMin <= 0) return 0
    return Math.round(1000 / speedMperMin * 60)
  }

  // LTHR → %VO2max: LTHR-Zone entspricht ca. Zone2 = 72-82% LTHR = ~70-80% VO2max
  // Korrekturfaktor: HR% * 0.95 ≈ VO2%
  const lo_vo2 = lo * 0.95
  const hi_vo2 = hi * 0.95

  const loSec = vo2ToPace(hi_vo2) // invertiert – höher VO2 = schneller = weniger s/km
  const hiSec = vo2ToPace(lo_vo2)

  function fmtPace(s: number): string {
    if (s <= 0 || s > 900) return '–:–'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return { low: fmtPace(loSec), high: fmtPace(hiSec) }
}

const ZONE_LABELS = [
  { label: 'Zone 1', desc: 'Recovery', color: '#22c55e' },
  { label: 'Zone 2', desc: 'Aerob (80/20-Fokus)', color: '#86efac' },
  { label: 'Zone 3', desc: 'Tempo', color: '#f59e0b' },
  { label: 'Zone 4', desc: 'Schwelle', color: '#f97316' },
  { label: 'Zone 5', desc: 'VO2max', color: '#ef4444' },
]

export default function ZonesPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [vo2max, setVo2max] = useState('')
  const [lthrInput, setLthrInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then((d: { profile: Profile }) => {
      setProfile(d.profile)
      if (d.profile?.lthr) setLthrInput(d.profile.lthr.toString())
    })
    // VO2max aus Garmin-Daten laden
    fetch('/api/trends').then(r => r.json()).then(d => {
      if (d.summary?.vo2_max_current) setVo2max(d.summary.vo2_max_current.toString())
    })
  }, [])

  async function handleSave() {
    if (!lthrInput) return
    setSaving(true)
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lthr: Number(lthrInput) }),
    })
    setSaving(false)
    setSaved(true)
    const d = await fetch('/api/profile').then(r => r.json())
    setProfile(d.profile)
  }

  const lthr = Number(lthrInput || profile?.lthr || 0)
  const vo2 = Number(vo2max)
  const hasBothInputs = lthr > 0

  const hrZones = lthr > 0 ? [
    { low: Math.round(lthr * 0.60), high: Math.round(lthr * 0.72) },
    { low: Math.round(lthr * 0.72), high: Math.round(lthr * 0.82) },
    { low: Math.round(lthr * 0.82), high: Math.round(lthr * 0.89) },
    { low: Math.round(lthr * 0.89), high: Math.round(lthr * 0.97) },
    { low: Math.round(lthr * 0.97), high: Math.round(lthr * 1.05) },
  ] : Array.from({ length: 5 }, (_, i) => ({
    low: [profile?.hr_zone1_low, profile?.hr_zone2_low, profile?.hr_zone3_low, profile?.hr_zone4_low, profile?.hr_zone5_low][i] ?? null,
    high: [profile?.hr_zone1_high, profile?.hr_zone2_high, profile?.hr_zone3_high, profile?.hr_zone4_high, profile?.hr_zone5_high][i] ?? null,
  }))

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="text-slate-400 hover:text-slate-200 text-sm">← Einstellungen</Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-slate-100">Lauf-Pace-Zonen</h1>
        <p className="text-sm text-slate-400 mt-1">Berechnet aus LTHR + VO2max (Garmin-Daten)</p>
      </div>

      {/* Eingaben */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-slate-200">Eingabewerte</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">LTHR (bpm)</label>
            <input
              type="number"
              className="input-field w-full"
              placeholder="z.B. 168"
              value={lthrInput}
              onChange={e => setLthrInput(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">VO2max (ml/kg/min)</label>
            <input
              type="number"
              className="input-field w-full"
              placeholder="z.B. 48"
              value={vo2max}
              onChange={e => setVo2max(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">Aus Garmin automatisch geladen</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !lthrInput}
          className="btn-primary w-full"
        >
          {saving ? 'Wird gespeichert…' : 'LTHR speichern & Zonen aktualisieren'}
        </button>
        {saved && <p className="text-xs text-prime text-center">Gespeichert ✓ – HR-Zonen aktualisiert</p>}
        {profile?.hr_zones_source && (
          <p className="text-xs text-slate-500">Aktuelle Quelle: {profile.hr_zones_source}</p>
        )}
      </div>

      {/* Zonen-Tabelle */}
      {hasBothInputs && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-slate-200">Zonen-Übersicht</h2>
          <div className="space-y-2">
            {ZONE_LABELS.map((z, i) => {
              const hr = hrZones[i]
              const pace = (vo2 > 0 && lthr > 0) ? calcPaceZone(vo2, lthr, i) : null

              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                  <div className="w-2 h-12 rounded-full flex-shrink-0" style={{ background: z.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-200">{z.label}</div>
                    <div className="text-xs text-slate-400">{z.desc}</div>
                  </div>
                  <div className="text-right space-y-1">
                    {hr.low && hr.high && (
                      <div className="text-sm font-semibold text-slate-100">
                        {hr.low}–{hr.high} <span className="text-xs font-normal text-slate-400">bpm</span>
                      </div>
                    )}
                    {pace && (
                      <div className="text-xs text-slate-400">
                        {pace.low}–{pace.high} <span>min/km</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {!vo2 && (
            <p className="text-xs text-slate-500">
              Tipp: Synchronisiere Garmin-Daten um VO2max-Pace-Zonen automatisch zu berechnen.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
