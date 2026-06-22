'use client'
import { useEffect, useState, useCallback } from 'react'

interface CalibrationData {
  ready: boolean
  entries_logged: number
  entries_needed: number
  current_tdee: number | null
  last_calibrated: string | null
  preview: {
    weight_avg_week1: number
    weight_avg_week2: number
    delta_kg: number
  } | null
  last_calibration: {
    tdee_adjustment_kcal: number
    new_tdee_kcal: number
    calibration_date: string
  } | null
}

export default function TDEECalibration() {
  const [data, setData] = useState<CalibrationData | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string>('')

  const load = useCallback(async () => {
    const res = await fetch('/api/calibration')
    setData(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  async function runCalibration() {
    setRunning(true)
    setResult('')
    const res = await fetch('/api/calibration', { method: 'POST' })
    const d = await res.json()
    if (d.adjusted) {
      setResult(`TDEE angepasst: ${d.old_tdee} → ${d.new_tdee} kcal (${d.adjustment > 0 ? '+' : ''}${d.adjustment} kcal)`)
    } else {
      setResult(d.message ?? d.error ?? 'Fehler')
    }
    setRunning(false)
    load()
  }

  if (!data) return <div className="card animate-pulse h-28" />

  const lastDate = data.last_calibrated
    ? new Date(data.last_calibrated).toLocaleDateString('de-DE')
    : null

  const lastAdj = data.last_calibration?.tdee_adjustment_kcal ?? null

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">TDEE-Kalibrierung</h3>
        {lastDate && (
          <span className="text-xs text-slate-500">Letzte Anpassung: {lastDate}</span>
        )}
      </div>

      {/* Aktueller TDEE */}
      <div className="flex items-center gap-4">
        <div>
          <div className="stat-label">Aktueller TDEE</div>
          <div className="text-2xl font-black text-slate-100">
            {data.current_tdee ? `${data.current_tdee} kcal` : '–'}
          </div>
          {lastAdj !== null && (
            <div className={`text-xs mt-0.5 ${lastAdj > 0 ? 'text-moderate' : 'text-prime'}`}>
              Letzte Änderung: {lastAdj > 0 ? '+' : ''}{lastAdj} kcal
            </div>
          )}
        </div>

        {data.preview && (
          <div className="flex-1 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="stat-label">Woche 1 Ø</div>
              <div className="font-bold text-slate-200">{data.preview.weight_avg_week1} kg</div>
            </div>
            <div>
              <div className="stat-label">Woche 2 Ø</div>
              <div className="font-bold text-slate-200">{data.preview.weight_avg_week2} kg</div>
            </div>
            <div>
              <div className="stat-label">Delta</div>
              <div className={`font-bold ${data.preview.delta_kg < 0 ? 'text-prime' : 'text-moderate'}`}>
                {data.preview.delta_kg > 0 ? '+' : ''}{data.preview.delta_kg} kg
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fortschritt-Bar */}
      {!data.ready && (
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Daten gesammelt</span>
            <span>{data.entries_logged}/14 Tage</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-prime rounded-full transition-all"
              style={{ width: `${(data.entries_logged / 14) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Noch {data.entries_needed} Tage Gewichtseingaben nötig
          </p>
        </div>
      )}

      {result && (
        <p className="text-sm text-prime font-medium">{result}</p>
      )}

      <button
        onClick={runCalibration}
        disabled={!data.ready || running}
        className="btn-primary w-full disabled:opacity-40 text-sm"
      >
        {running ? 'Wird kalibriert…' : data.ready ? 'Kalibrierung jetzt ausführen' : `${data.entries_needed} Tage fehlen noch`}
      </button>

      <p className="text-xs text-slate-500 leading-relaxed">
        Vergleicht 7-Tage-Mittel Woche 1 vs. Woche 2. Bei Abweichung &gt;100 kcal/Tag wird der TDEE automatisch nachjustiert.
        Dein Körpergewicht ist die einzige Ground Truth.
      </p>
    </div>
  )
}
