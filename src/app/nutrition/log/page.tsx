'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import MealLogger from '@/components/MealLogger'

interface LogEntry {
  id: string
  meal_slot: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  notes: string | null
  template_id: string | null
}

interface Totals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

interface Target {
  calories_target: number
  protein_target_g: number
  carbs_target_g: number
  fat_target_g: number
  is_training_day: boolean
}

interface DayLog {
  date: string
  logs: LogEntry[]
  totals: Totals
  target: Target | null
  remaining: Totals | null
}

const SLOTS: { key: string; label: string; icon: string }[] = [
  { key: 'breakfast',    label: 'Frühstück',   icon: '🌅' },
  { key: 'pre_workout',  label: 'Pre-Workout', icon: '⚡' },
  { key: 'lunch',        label: 'Mittagessen', icon: '☀️' },
  { key: 'dinner',       label: 'Abendessen',  icon: '🌙' },
  { key: 'pre_sleep',    label: 'Pre-Sleep',   icon: '💤' },
]

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default function NutritionLogPage() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [data, setData] = useState<DayLog | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/meals/log?date=${d}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  const isToday = date === today
  const totals = data?.totals ?? { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  const target = data?.target ?? null

  const calPct = target ? Math.min((totals.calories / target.calories_target) * 100, 100) : 0
  const remaining = data?.remaining

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Mahlzeiten-Log</h1>
        <Link href="/nutrition" className="btn-ghost text-sm">← Ernährung</Link>
      </div>

      {/* Date navigation */}
      <div className="flex items-center justify-between card py-3">
        <button
          onClick={() => setDate(d => addDays(d, -1))}
          className="btn-ghost py-1.5 px-3 text-lg"
          aria-label="Vorheriger Tag"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="font-semibold text-slate-200">{fmtDate(date)}</div>
          {!isToday && (
            <button onClick={() => setDate(today)} className="text-xs text-prime hover:underline mt-0.5">
              Heute
            </button>
          )}
        </div>
        <button
          onClick={() => setDate(d => addDays(d, 1))}
          disabled={isToday}
          className="btn-ghost py-1.5 px-3 text-lg disabled:opacity-30"
          aria-label="Nächster Tag"
        >
          ›
        </button>
      </div>

      {/* Kalorienzusammenfassung */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="stat-label">Kalorien heute</div>
            <div className="text-3xl font-bold text-slate-100">
              {totals.calories}
              {target && <span className="text-lg text-slate-400 font-normal"> / {target.calories_target}</span>}
              <span className="text-base text-slate-400 font-normal ml-1">kcal</span>
            </div>
          </div>
          {target && (
            <div className="text-right">
              {target.is_training_day
                ? <span className="badge-prime text-xs">Trainingstag</span>
                : <span className="badge-gray text-xs">Ruhetag</span>
              }
            </div>
          )}
        </div>

        {/* Kalorien-Fortschrittsbalken */}
        {target && (
          <div className="space-y-1">
            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${calPct}%`,
                  background: calPct >= 100 ? '#ef4444' : calPct >= 85 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
            {remaining && (
              <div className="text-xs text-slate-400 text-right">
                {remaining.calories > 0
                  ? `noch ${remaining.calories} kcal`
                  : `${Math.abs(remaining.calories)} kcal über Ziel`}
              </div>
            )}
          </div>
        )}

        {/* Makro-Übersicht */}
        <div className="grid grid-cols-3 gap-3">
          <MacroBox
            label="Protein"
            value={totals.protein_g}
            target={target?.protein_target_g}
            color="#22c55e"
            unit="g"
          />
          <MacroBox
            label="Carbs"
            value={totals.carbs_g}
            target={target?.carbs_target_g}
            color="#3b82f6"
            unit="g"
          />
          <MacroBox
            label="Fett"
            value={totals.fat_g}
            target={target?.fat_target_g}
            color="#f59e0b"
            unit="g"
          />
        </div>

        {!target && !loading && (
          <p className="text-xs text-slate-500">
            Kein Kalorienziel für diesen Tag gesetzt.{' '}
            <Link href="/nutrition" className="text-prime hover:underline">Gewicht eingeben</Link>
          </p>
        )}
      </div>

      {/* Mahlzeit-Slots */}
      {loading ? (
        <div className="card animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-3 bg-white/8 rounded w-1/4" />
              <div className="h-10 bg-white/5 rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <div className="card space-y-5 divide-y divide-white/5">
          {SLOTS.map((slot, idx) => {
            const slotEntries = data?.logs.filter(l => l.meal_slot === slot.key) ?? []
            return (
              <div key={slot.key} className={idx > 0 ? 'pt-4' : ''}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{slot.icon}</span>
                  <MealLogger
                    slot={slot.key}
                    slotLabel={slot.label}
                    date={date}
                    entries={slotEntries}
                    onUpdate={() => load(date)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tages-Zusammenfassung (wenn Einträge vorhanden) */}
      {!loading && data && data.logs.length > 0 && (
        <div className="card bg-white/3 space-y-2">
          <div className="text-sm font-semibold text-slate-200">Zusammenfassung</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-400">
            <div className="flex justify-between">
              <span>Mahlzeiten</span>
              <span className="text-slate-300">{data.logs.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Kalorien</span>
              <span className="text-slate-300">{totals.calories} kcal</span>
            </div>
            <div className="flex justify-between">
              <span>Protein</span>
              <span className="text-slate-300">{Math.round(totals.protein_g)}g</span>
            </div>
            <div className="flex justify-between">
              <span>Carbs</span>
              <span className="text-slate-300">{Math.round(totals.carbs_g)}g</span>
            </div>
            <div className="flex justify-between">
              <span>Fett</span>
              <span className="text-slate-300">{Math.round(totals.fat_g)}g</span>
            </div>
            {totals.calories > 0 && (
              <div className="flex justify-between">
                <span>Protein/kcal</span>
                <span className="text-slate-300">{((totals.protein_g * 4 / totals.calories) * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MacroBox({ label, value, target, color, unit }: {
  label: string
  value: number
  target?: number
  color: string
  unit: string
}) {
  const pct = target ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="bg-white/5 rounded-lg p-2.5 space-y-1.5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-base font-bold" style={{ color }}>
        {Math.round(value)}<span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
      </div>
      {target && (
        <>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, background: color }}
            />
          </div>
          <div className="text-xs text-slate-500">/ {Math.round(target)}{unit}</div>
        </>
      )}
    </div>
  )
}
