'use client'
import { useEffect, useState } from 'react'
import RacePredictionWidget from '@/components/RacePredictionWidget'
import WeightChart from '@/components/WeightChart'

interface TrendsData {
  garmin_trend: Array<{
    metric_date: string
    vo2_max: number | null
    resting_heart_rate: number | null
  }>
  weight_trend: Array<{
    entry_date: string
    weight_kg: number
    body_fat_pct: number | null
    lean_mass_kg: number | null
    trend_kg: number | null
  }>
  weekly_metrics: Array<{
    week_start: string
    endurance_score: number | null
    hill_score: number | null
  }>
  race_predictions: Array<{
    distance_label: string
    predicted_time_seconds: number
    race_date: string
    vo2_max_estimate: number | null
  }>
  summary: {
    vo2_max_current: number | null
    vo2_max_delta_4w: number | null
    resting_hr_current: number | null
    weight_current: number | null
    weight_trend_7d: number | null
    body_fat_current: number | null
    lean_mass_current: number | null
    endurance_score: number | null
    hill_score: number | null
  }
}

function SparkLine({ values, color = '#22c55e' }: { values: number[]; color?: string }) {
  if (values.length < 2) return <div className="h-12 text-xs text-slate-500">Zu wenig Daten</div>
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 200
  const h = 48
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  )
}

function StatCard({ label, value, delta, unit }: { label: string; value: string | null; delta?: number | null; unit?: string }) {
  return (
    <div className="card-sm space-y-1">
      <div className="stat-label">{label}</div>
      <div className="text-2xl font-black text-slate-100">
        {value ?? '–'}{value && unit ? <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span> : ''}
      </div>
      {delta !== undefined && delta !== null && (
        <div className={`text-xs font-medium ${delta > 0 ? 'text-prime' : delta < 0 ? 'text-low' : 'text-slate-400'}`}>
          {delta > 0 ? '+' : ''}{delta} (4W)
        </div>
      )}
    </div>
  )
}

export default function TrendsClient() {
  const [data, setData] = useState<TrendsData | null>(null)

  useEffect(() => {
    fetch('/api/trends').then(r => r.json()).then(setData)
  }, [])

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-slate-100">Langzeit-Trends</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="card-sm animate-pulse h-20" />)}
        </div>
      </div>
    )
  }

  const s = data.summary
  const vo2Values = data.garmin_trend.filter(g => g.vo2_max !== null).map(g => g.vo2_max as number)
  const hrValues = data.garmin_trend.filter(g => g.resting_heart_rate !== null).map(g => g.resting_heart_rate as number)
  const weightValues = data.weight_trend.map(w => w.weight_kg)
  const weightTrendValues = data.weight_trend.filter(w => w.trend_kg !== null).map(w => w.trend_kg as number)
  const enduranceValues = data.weekly_metrics.filter(w => w.endurance_score !== null).map(w => w.endurance_score as number)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Langzeit-Trends</h1>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="VO2max" value={s.vo2_max_current?.toString() ?? null} delta={s.vo2_max_delta_4w} unit="ml/kg/min" />
        <StatCard label="Resting HR" value={s.resting_hr_current?.toString() ?? null} unit="bpm" />
        <StatCard label="Körpergewicht" value={s.weight_current?.toFixed(1) ?? null} unit="kg" />
        <StatCard label="KFA" value={s.body_fat_current?.toFixed(1) ?? null} unit="%" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Lean Mass" value={s.lean_mass_current?.toFixed(1) ?? null} unit="kg" />
        <StatCard label="Endurance Score" value={s.endurance_score?.toString() ?? null} />
        <StatCard label="Hill Score" value={s.hill_score?.toString() ?? null} />
        <StatCard
          label="Gewicht-Trend (7T)"
          value={s.weight_trend_7d?.toFixed(2) ?? null}
          unit="kg"
        />
      </div>

      {/* Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vo2Values.length >= 2 && (
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm">VO2max (90 Tage)</h3>
              <span className="text-prime font-bold">{s.vo2_max_current}</span>
            </div>
            <SparkLine values={vo2Values} color="#22c55e" />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Min: {Math.min(...vo2Values)}</span>
              <span>Max: {Math.max(...vo2Values)}</span>
            </div>
          </div>
        )}

        {hrValues.length >= 2 && (
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm">Resting HR (90 Tage)</h3>
              <span className="text-slate-200 font-bold">{s.resting_hr_current} bpm</span>
            </div>
            <SparkLine values={hrValues} color="#60a5fa" />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Min: {Math.min(...hrValues)} bpm</span>
              <span>Max: {Math.max(...hrValues)} bpm</span>
            </div>
          </div>
        )}

        {weightValues.length >= 2 && (
          <WeightChart data={data.weight_trend} height={160} />
        )}

        {enduranceValues.length >= 2 && (
          <div className="card space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-200 text-sm">Endurance Score</h3>
              <span className="text-slate-200 font-bold">{s.endurance_score}</span>
            </div>
            <SparkLine values={enduranceValues} color="#f59e0b" />
          </div>
        )}
      </div>

      {/* Race Predictions */}
      <RacePredictionWidget predictions={data.race_predictions} />
    </div>
  )
}
