'use client'
import { useEffect, useState, useCallback } from 'react'

interface CalibrationData {
  ready: boolean
  windowDays: number
  weightDays: number
  intakeDays: number
  intakeSource: 'logged' | 'planned' | null
  meanIntakeKcal: number | null
  weeklyRateKg: number | null
  empiricalTdee: number | null
  garminEstimateTdee: number | null
  currentTdee: number | null
  reason?: string
  last_calibrated: string | null
  last_calibration: {
    tdee_adjustment_kcal: number
    new_tdee_kcal: number
    calibration_date: string
  } | null
}

const MIN_WEIGHT_DAYS = 14
const MIN_INTAKE_DAYS = 10

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
    setResult(d.message ?? d.error ?? 'Fehler')
    setRunning(false)
    load()
  }

  if (!data) return <div className="card animate-pulse h-28" />

  const lastDate = data.last_calibrated
    ? new Date(data.last_calibrated).toLocaleDateString('de-DE')
    : null

  const rate = data.weeklyRateKg
  const diff = data.empiricalTdee != null && data.garminEstimateTdee != null
    ? data.empiricalTdee - data.garminEstimateTdee
    : null

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">TDEE-Kalibrierung</h3>
        {lastDate && <span className="text-xs text-slate-500">Zuletzt: {lastDate}</span>}
      </div>

      {/* Aktueller (kalibrierter) TDEE */}
      <div>
        <div className="stat-label">Aktueller TDEE (Ground Truth)</div>
        <div className="text-2xl font-black text-slate-100">
          {data.currentTdee ? `${data.currentTdee} kcal` : data.empiricalTdee ? `~${data.empiricalTdee} kcal` : '–'}
        </div>
      </div>

      {/* Empirisch vs. Garmin-Schätzung */}
      {(data.empiricalTdee != null || data.garminEstimateTdee != null) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 p-2.5">
            <div className="stat-label">Empirisch (Bilanz)</div>
            <div className="font-bold text-slate-100">{data.empiricalTdee != null ? `${data.empiricalTdee} kcal` : '–'}</div>
            {data.intakeSource && (
              <div className="text-[10px] text-slate-500 mt-0.5">
                {data.intakeSource === 'logged' ? 'aus Food-Log' : 'aus Plan (geschätzt)'}
              </div>
            )}
          </div>
          <div className="rounded-lg bg-white/5 p-2.5">
            <div className="stat-label">Garmin-Schätzung</div>
            <div className="font-bold text-slate-300">{data.garminEstimateTdee != null ? `${data.garminEstimateTdee} kcal` : '–'}</div>
            {diff != null && (
              <div className={`text-[10px] mt-0.5 ${diff < 0 ? 'text-prime' : 'text-moderate'}`}>
                {diff > 0 ? '+' : ''}{diff} kcal Abweichung
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gewichts-Trend */}
      {rate != null && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Gewichts-Trend (geglättet)</span>
          <span className={`font-bold ${rate < 0 ? 'text-prime' : rate > 0 ? 'text-moderate' : 'text-slate-300'}`}>
            {rate > 0 ? '+' : ''}{rate.toFixed(2)} kg/Woche
          </span>
        </div>
      )}

      {/* Fortschritt bis genug Daten */}
      {!data.ready && (
        <div className="space-y-2">
          <Progress label="Gewichts-Tage" have={data.weightDays} need={MIN_WEIGHT_DAYS} />
          <Progress label="Food-Log-Tage" have={data.intakeDays} need={MIN_INTAKE_DAYS} />
          {data.reason && <p className="text-xs text-slate-500">{data.reason}</p>}
        </div>
      )}

      {result && <p className="text-sm text-prime font-medium">{result}</p>}

      <button
        onClick={runCalibration}
        disabled={!data.ready || running}
        className="btn-primary w-full disabled:opacity-40 text-sm"
      >
        {running ? 'Wird kalibriert…' : data.ready ? 'Jetzt kalibrieren' : 'Mehr Daten sammeln'}
      </button>

      <p className="text-xs text-slate-500 leading-relaxed">
        Echter TDEE = Ø Zufuhr − Gewichts-Trend × 7700 kcal/kg, über {data.windowDays} Tage geglättet.
        Läuft automatisch wöchentlich. Garmin liefert nur die Anfangsschätzung — Waage + Food-Log sind die Wahrheit.
      </p>
    </div>
  )
}

function Progress({ label, have, need }: { label: string; have: number; need: number }) {
  const pct = Math.min((have / need) * 100, 100)
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span>{Math.min(have, need)}/{need}</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-prime rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
