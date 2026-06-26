'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import MealPlan from '@/components/MealPlan'
import DailyInputModal from '@/components/DailyInputModal'
import WeightChart from '@/components/WeightChart'
import CarbCycleCalendar from '@/components/CarbCycleCalendar'
import TrainingScheduleEditor from '@/components/TrainingScheduleEditor'
import { PhaseAdvisorDetail } from '@/components/PhaseAdvisor'
import { calcWeightTrend } from '@/lib/nutrition'
import { getPhasePreset } from '@/lib/phases'

interface NutritionData {
  today: {
    weight_kg: number
    body_fat_pct: number
    lean_mass_kg: number
    bmr_kcal: number
    calories_target: number
    protein_target_g: number
    carbs_target_g: number
    fat_target_g: number
    meal_plan: unknown[]
    tdee_kcal: number
    is_training_day: boolean
    is_refeed_day: boolean
    training_time: string | null
    workout_type: string | null
  } | null
  history: Array<{
    entry_date: string
    weight_kg: number
    body_fat_pct: number
    lean_mass_kg: number
  }>
  profile?: { current_phase: string; phase_preset: string | null } | null
}

export default function NutritionPage() {
  const [data, setData] = useState<NutritionData | null>(null)
  const [showInput, setShowInput] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/daily-input')
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`API-Fehler ${res.status}: ${text.slice(0, 200)}`)
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error('Ernährungsdaten konnten nicht geladen werden:', e)
      setError(e instanceof Error ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-slate-400 animate-pulse">Lade Ernährungsdaten…</div>
    </div>
  )

  if (error) return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-100">Ernährung</h1>
      <div className="card space-y-3">
        <p className="text-red-400 font-semibold">Fehler beim Laden</p>
        <p className="text-slate-400 text-sm font-mono break-all">{error}</p>
        <button onClick={load} className="btn-primary text-sm">Erneut versuchen</button>
      </div>
    </div>
  )

  const t = data?.today
  const activePreset = data?.profile
    ? getPhasePreset(
        data.profile.phase_preset,
        (data.profile.current_phase ?? 'cut') as 'cut' | 'bulk' | 'maintenance' | 'baseline_building',
      )
    : null
  // meal_plan kann als Array (JSONB) oder String (TEXT) aus der DB kommen
  const mealPlanData = Array.isArray(t?.meal_plan)
    ? (t.meal_plan as Parameters<typeof MealPlan>[0]['meals'])
    : typeof t?.meal_plan === 'string'
      ? (() => { try { return JSON.parse(t.meal_plan as string) } catch { return null } })()
      : null

  // Gewichtsverlauf aufsteigend sortieren (API liefert DESC)
  const historyAsc = data?.history ? [...data.history].reverse() : []
  const weightTrendMap = historyAsc.length
    ? new Map(calcWeightTrend(historyAsc.map(h => ({ date: h.entry_date, weight: h.weight_kg }))).map(e => [e.date, e.trend]))
    : new Map<string, number | null>()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Ernährung</h1>
        <div className="flex items-center gap-2">
          <Link href="/nutrition/log" className="btn-ghost text-sm">Log</Link>
          <Link href="/nutrition/templates" className="btn-ghost text-sm">Templates</Link>
          <button onClick={() => setShowInput(true)} className="btn-primary text-sm">
            Gewicht eingeben
          </button>
        </div>
      </div>

      {/* Tages-Stats */}
      {t ? (
        <div className="card space-y-4">
          <div className="flex flex-wrap gap-3 justify-between">
            <InfoBlock label="Gewicht"    value={`${t.weight_kg ?? '–'} kg`} />
            <InfoBlock label="KFA"        value={`${t.body_fat_pct ?? '–'}%`} />
            <InfoBlock label="Magermasse" value={`${t.lean_mass_kg ?? '–'} kg`} />
            <InfoBlock label="BMR"        value={`${t.bmr_kcal ?? '–'} kcal`} />
            <InfoBlock label="TDEE est."  value={t.tdee_kcal != null ? `${Math.round(t.tdee_kcal)} kcal` : '–'} />
            <InfoBlock label="Ziel"       value={t.calories_target != null ? `${t.calories_target} kcal` : '–'} />
          </div>

          {/* Makro-Balken */}
          {t.calories_target != null && (
            <div className="space-y-2 pt-2">
              <MacroBar label="Protein"       value={t.protein_target_g ?? 0} max={300} color="#22c55e" unit="g" />
              <MacroBar label="Kohlenhydrate" value={t.carbs_target_g ?? 0}   max={400} color="#3b82f6" unit="g" />
              <MacroBar label="Fett"          value={t.fat_target_g ?? 0}     max={120} color="#f59e0b" unit="g" />
            </div>
          )}

          <div className="flex gap-2">
            {t.is_training_day && <span className="badge-prime">Trainingstag</span>}
            {t.is_refeed_day   && <span className="badge-moderate">Refeed +50g Carbs</span>}
            {!t.is_training_day && <span className="badge-gray">Ruhetag −70g Carbs</span>}
          </div>
        </div>
      ) : (
        <div className="card text-center space-y-3">
          <p className="text-slate-400">Noch keine Eingabe für heute.</p>
          <button onClick={() => setShowInput(true)} className="btn-primary">
            Gewicht + KFA eingeben
          </button>
        </div>
      )}

      {/* Aktive Phase – Ratgeber-Kurzfassung */}
      {activePreset && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-200">Aktive Phase</h2>
            <Link href="/settings" className="text-xs text-slate-400 hover:text-slate-200">Phase ändern →</Link>
          </div>
          <PhaseAdvisorDetail preset={activePreset} />
        </div>
      )}

      {/* Mahlzeitenplan */}
      <MealPlan
        meals={mealPlanData}
        isTrainingDay={t?.is_training_day ?? false}
        trainingTime={t?.training_time ?? null}
        workoutType={t?.workout_type ?? null}
      />

      {/* Trainingskalender – Zeiten setzen, Mahlzeiten passen sich an */}
      <TrainingScheduleEditor onSaved={load} />

      {/* Gewichtsverlauf-Chart */}
      {historyAsc.length ? (
        <WeightChart
          data={historyAsc.map(d => ({
            ...d,
            trend_kg: weightTrendMap.get(d.entry_date) ?? null,
          }))}
          height={160}
        />
      ) : null}

      {/* Carb-Cycling-Kalender */}
      <CarbCycleCalendar />

      {/* Nährstoff-Timing Guide */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-slate-200">Nährstoff-Timing</h2>
        <div className="space-y-2 text-xs text-slate-400">
          {[
            ['⚡ Pre-Workout', 'Leicht verdauliche Carbs, kein Fett (verlangsamt Verdauung)'],
            ['🏃 Zone-2 nüchtern', 'Im Cut möglich – verbessert Fettoxidation'],
            ['🍗 Post-Workout', '20–40g Protein innerhalb ~2h (kein 30-Minuten-Stress)'],
            ['⏰ Protein-Timing', 'Alle ~3h, je 30–45g für optimale MPS-Stimulation'],
            ['🌙 Pre-Sleep', '30–40g Casein = +22% nächtliche Muskelproteinsynthese'],
            ['🍺 Alkohol', 'Stört Testosteron, Schlaf und MPS – als Störvariable markieren'],
          ].map(([title, desc]) => (
            <div key={title as string} className="flex gap-2">
              <span className="font-semibold text-slate-300 shrink-0 w-36">{title}</span>
              <span>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {showInput && (
        <DailyInputModal
          initial={{
            weight_kg: t?.weight_kg,
            body_fat_pct: t?.body_fat_pct,
            training_time: t?.training_time,
            workout_type: t?.workout_type,
          }}
          onSave={() => load()}
          onClose={() => setShowInput(false)}
        />
      )}
    </div>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="stat-label">{label}</div>
      <div className="text-base font-bold text-slate-100">{value}</div>
    </div>
  )
}

function MacroBar({ label, value, max, color, unit }: {
  label: string; value: number; max: number; color: string; unit: string
}) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-400 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-semibold shrink-0 w-16 text-right" style={{ color }}>
        {Math.round(value)}{unit}
      </span>
    </div>
  )
}
