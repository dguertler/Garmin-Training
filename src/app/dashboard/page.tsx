'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import ReadinessScore from '@/components/ReadinessScore'
import MacroRings from '@/components/MacroRings'
import MealPlan from '@/components/MealPlan'
import HRVChart from '@/components/HRVChart'
import SleepBars from '@/components/SleepBars'
import StepsWidget from '@/components/StepsWidget'
import WeekPlanCard from '@/components/WeekPlanCard'
import SyncStatus from '@/components/SyncStatus'
import DailyInputModal from '@/components/DailyInputModal'
import TDEECalibration from '@/components/TDEECalibration'
import DeloadCountdown from '@/components/DeloadCountdown'

interface DashboardData {
  today: string
  readiness: {
    score: number | null
    level: string
    color: string
    recommended_workout_type?: string
    recommendation_reason?: string
    factors?: {
      hrv_vs_baseline_pct: number | null
      sleep_score: number | null
      body_battery_morning: number | null
      hrv_status: string | null
      training_status: string | null
    }
    trend?: Array<{ date: string; score: number | null; level: string; color: string }>
  }
  garmin: Record<string, unknown> | null
  body: {
    weight_kg: number
    body_fat_pct: number
    lean_mass_kg: number
    bmr_kcal: number
  } | null
  nutrition: {
    calories_target: number
    protein_target_g: number
    carbs_target_g: number
    fat_target_g: number
    meal_plan: unknown[]
    tdee_kcal?: number
    is_training_day?: boolean
    is_refeed_day?: boolean
  } | null
  sleep7: Array<{
    metric_date: string
    sleep_score: number | null
    sleep_duration_seconds: number | null
    sleep_deep_seconds: number | null
    sleep_rem_seconds: number | null
    sleep_light_seconds: number | null
  }>
  steps: { today: number | null; goal: number; avg7: number | null; neat_baseline: number | null; neat_warning: boolean }
  weightTrend: Array<{ date: string; weight: number; trend: number | null }>
  weekPlan: Array<Record<string, unknown>>
  concurrent_warning: string | null
  syncStatus: Record<string, unknown> | null
  gear: Array<{ gear_name: string; distance_km: number; warning: boolean }>
  garmin30d: Array<{
    date: string
    resting_heart_rate: number | null
    vo2max: number | null
    fitness_age: number | null
    steps_total: number | null
    calories_total: number | null
    calories_active: number | null
  }>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [readinessTrend, setReadinessTrend] = useState<Array<{ date: string; score: number | null; level: string; color: string }>>([])
  const [alcoholWarning, setAlcoholWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showInput, setShowInput] = useState(false)
  const [garminConnected, setGarminConnected] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dashRes, readRes, garminRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/readiness'),
        fetch('/api/garmin/credentials'),
      ])
      const [dash, read, garmin] = await Promise.all([dashRes.json(), readRes.json(), garminRes.json()])
      setData(dash)
      if (read.trend) setReadinessTrend(read.trend)
      if (read.alcohol_warning) setAlcoholWarning(read.alcohol_warning)
      setGarminConnected(garmin.connected ?? false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400 animate-pulse">Daten werden geladen…</div>
      </div>
    )
  }

  const r = data?.readiness
  const g = data?.garmin as Record<string, unknown> | null

  return (
    <div className="space-y-5">
      {/* Garmin-Setup-Banner */}
      {garminConnected === false && (
        <div className="card border-amber-500/40 bg-amber-500/5 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-amber-300">Garmin Connect nicht verbunden</div>
            <div className="text-xs text-slate-400 mt-0.5">Verbinde dein Garmin-Konto, um Readiness, HRV und Aktivitätsdaten zu synchronisieren.</div>
          </div>
          <Link href="/settings" className="text-xs font-medium text-amber-300 border border-amber-500/40 rounded-lg px-3 py-1.5 hover:bg-amber-500/10 transition-all flex-shrink-0">
            Verbinden
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">
            {new Date(data?.today ?? '').toLocaleDateString('de-DE', {
              weekday: 'long', day: 'numeric', month: 'long'
            })}
          </h1>
          {data?.body && (
            <p className="text-sm text-slate-400 mt-0.5">
              {data.body.weight_kg} kg · {data.body.body_fat_pct}% KFA · {data.body.lean_mass_kg} kg Mager
            </p>
          )}
        </div>
        {data?.syncStatus && <SyncStatus status={data.syncStatus as Parameters<typeof SyncStatus>[0]['status']} />}
      </div>

      {/* Deload-Warnung */}
      {data?.weekPlan?.some((d: Record<string, unknown>) => d.is_deload_week) && (
        <div className="card border-moderate/40 bg-moderate/5 text-moderate text-sm font-medium">
          Deload-Woche – Volumen −40%, Intensität −20%
        </div>
      )}

      {/* Top Row: Readiness + Makros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {r && (
          <ReadinessScore
            score={r.score}
            level={(r.level as 'prime' | 'moderate' | 'low' | 'unknown') ?? 'unknown'}
            color={r.color ?? '#64748b'}
            recommendation={r.recommended_workout_type ?? 'unknown'}
            reason={r.recommendation_reason ?? ''}
            factors={{
              hrv_vs_baseline_pct: r.factors?.hrv_vs_baseline_pct ?? null,
              sleep_score: r.factors?.sleep_score ?? null,
              body_battery_morning: r.factors?.body_battery_morning ?? null,
              hrv_status: r.factors?.hrv_status ?? null,
              training_status: r.factors?.training_status ?? null,
            }}
            alcoholWarning={alcoholWarning}
          />
        )}
        <MacroRings
          nutrition={data?.nutrition ?? null}
          onOpenInput={() => setShowInput(true)}
        />
      </div>

      {/* Readiness-Trend + Schlaf */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <HRVChart
          trend={readinessTrend}
          baselineLow={g?.hrv_baseline_low as number | null}
          baselineHigh={g?.hrv_baseline_high as number | null}
          lastNight={g?.hrv_last_night as number | null}
        />
        <SleepBars data={data?.sleep7 ?? []} />
      </div>

      {/* Schritte + Garmin-Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StepsWidget
          today={data?.steps.today ?? null}
          goal={data?.steps.goal ?? 8000}
          avg7={data?.steps.avg7 ?? null}
          neatBaseline={data?.steps.neat_baseline}
          neatWarning={data?.steps.neat_warning}
          values={(data?.garmin30d ?? []).map(r => r.steps_total)}
        />
        <TrendStatCard
          label="VO2max"
          value={lastKnown(data?.garmin30d ?? [], 'vo2max')}
          unit="ml/kg/min"
          values={(data?.garmin30d ?? []).map(r => r.vo2max)}
          color="#22c55e"
        />
        <TrendStatCard
          label="Ruhepuls"
          value={lastKnown(data?.garmin30d ?? [], 'resting_heart_rate')}
          unit="bpm"
          values={(data?.garmin30d ?? []).map(r => r.resting_heart_rate)}
          color="#60a5fa"
          invertGood
        />
        <TrendStatCard
          label="Fitness-Alter"
          value={lastKnown(data?.garmin30d ?? [], 'fitness_age')}
          unit="J"
          values={(data?.garmin30d ?? []).map(r => r.fitness_age)}
          color="#a78bfa"
          invertGood
        />
      </div>

      {/* Kalorien */}
      {(data?.garmin30d ?? []).some(r => r.calories_total) && (
        <CalorieCard data={data?.garmin30d ?? []} />
      )}

      {/* Concurrent-Training-Warnung */}
      {data?.concurrent_warning && (
        <div className="card border-amber-500/40 bg-amber-500/5 text-sm text-amber-300">
          <span className="font-semibold">Concurrent Training: </span>
          {data.concurrent_warning}
        </div>
      )}

      {/* Wochenplan */}
      <WeekPlanCard days={data?.weekPlan as Parameters<typeof WeekPlanCard>[0]['days'] ?? []} />

      {/* Mahlzeitenplan */}
      <MealPlan
        meals={data?.nutrition?.meal_plan as Parameters<typeof MealPlan>[0]['meals'] ?? null}
        isTrainingDay={data?.nutrition?.is_training_day ?? false}
      />

      {/* Gear-Warnungen */}
      {data?.gear?.filter(g => g.warning).map(g => (
        <div key={g.gear_name} className="card-sm border-low/40 bg-low/5 text-sm">
          <span className="text-low font-semibold">Schuhe fast abgelaufen: </span>
          {g.gear_name} · {g.distance_km} km ({'>'}90% Limit)
        </div>
      ))}

      {/* Deload-Countdown + TDEE-Kalibrierung */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <DeloadCountdown />
        <TDEECalibration />
      </div>

      {/* Daily Input Modal */}
      {showInput && (
        <DailyInputModal
          initial={{ weight_kg: data?.body?.weight_kg, body_fat_pct: data?.body?.body_fat_pct }}
          onSave={() => load()}
          onClose={() => setShowInput(false)}
        />
      )}
    </div>
  )
}

type Garmin30dRow = {
  date: string
  resting_heart_rate: number | null
  vo2max: number | null
  fitness_age: number | null
  steps_total: number | null
  calories_total: number | null
  calories_active: number | null
}

function lastKnown(rows: Garmin30dRow[], key: keyof Garmin30dRow): string {
  const val = [...rows].reverse().find(r => r[key] != null)?.[key]
  return val != null ? String(val) : '–'
}

function MiniSparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const nonNull = values.filter((v): v is number => v !== null)
  if (nonNull.length < 2) return null
  const min = Math.min(...nonNull)
  const max = Math.max(...nonNull)
  const range = max - min || 1
  const w = 100, h = 28
  const allIdxs = values.map((v, i) => ({ v, i })).filter(({ v }) => v !== null) as { v: number; i: number }[]
  const pts = allIdxs.map(({ v, i }) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1 opacity-70">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

function TrendStatCard({ label, value, unit, values, color, invertGood }: {
  label: string; value: string; unit?: string
  values: (number | null)[]; color: string; invertGood?: boolean
}) {
  const nonNull = values.filter((v): v is number => v !== null)
  const trend = nonNull.length >= 2 ? nonNull[nonNull.length - 1] - nonNull[0] : null
  const trendGood = trend !== null ? (invertGood ? trend < 0 : trend > 0) : null
  return (
    <div className="card-sm flex flex-col gap-0.5">
      <span className="stat-label">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-100">{value}</span>
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
        {trend !== null && (
          <span className={`text-xs ml-auto font-medium ${trendGood ? 'text-prime' : 'text-low'}`}>
            {trend > 0 ? '+' : ''}{trend % 1 === 0 ? trend : trend.toFixed(1)}
          </span>
        )}
      </div>
      <MiniSparkline values={values} color={color} />
    </div>
  )
}

function CalorieCard({ data }: { data: Garmin30dRow[] }) {
  const last14 = data.slice(-14)
  const maxCal = Math.max(...last14.map(r => r.calories_total ?? 0)) || 1
  const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const withCal = last14.filter(r => r.calories_total)
  const avgTotal = withCal.length
    ? Math.round(withCal.reduce((s, r) => s + (r.calories_total ?? 0), 0) / withCal.length)
    : null
  const avgActive = withCal.length
    ? Math.round(withCal.reduce((s, r) => s + (r.calories_active ?? 0), 0) / withCal.length)
    : null
  return (
    <div className="card space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-200 text-sm">Kalorienverbrauch (14 Tage)</h3>
        {avgTotal && (
          <span className="text-xs text-slate-400">
            Ø <span className="text-slate-200 font-semibold">{avgTotal.toLocaleString('de')}</span> kcal/Tag
            {avgActive ? <span className="text-slate-500"> ({avgActive.toLocaleString('de')} aktiv)</span> : null}
          </span>
        )}
      </div>
      <div className="flex items-end gap-1 h-20">
        {last14.map((r, i) => {
          const total = r.calories_total ?? 0
          const active = r.calories_active ?? 0
          const d = new Date(r.date)
          const wd = WEEKDAY[d.getDay()]
          const dayLabel = `${wd} ${d.getDate()}.${d.getMonth() + 1}.`
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-xs bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {total} kcal ({active} aktiv)
              </div>
              <div className="w-full flex flex-col justify-end" style={{ height: '56px' }}>
                <div
                  className="w-full bg-slate-600 rounded-sm"
                  style={{ height: `${total ? (total / maxCal) * 100 : 0}%` }}
                >
                  <div
                    className="w-full bg-prime rounded-sm"
                    style={{ height: `${total ? (active / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-[8px] text-slate-500 leading-tight text-center">{wd}</span>
              <span className="text-[8px] text-slate-600 leading-tight text-center">{d.getDate()}.{d.getMonth() + 1}.</span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-prime inline-block" />Aktiv</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-slate-600 inline-block" />Gesamt</span>
      </div>
    </div>
  )
}
