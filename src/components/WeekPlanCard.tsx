'use client'
import { useState } from 'react'

interface PlanDay {
  plan_date: string
  scheduled_workout_type: string
  recommended_workout_type?: string
  recommendation_reason?: string
  workout_status?: string
  readiness_level?: string
  readiness_score?: number
  is_deload_week?: boolean
}

const WORKOUT_SHORT: Record<string, { label: string; icon: string }> = {
  push:              { label: 'Push',      icon: '💪' },
  push_reduced:      { label: 'Push –',    icon: '💪' },
  pull:              { label: 'Pull',      icon: '🏋️' },
  pull_reduced:      { label: 'Pull –',    icon: '🏋️' },
  legs:              { label: 'Legs',      icon: '🦵' },
  legs_reduced:      { label: 'Legs –',    icon: '🦵' },
  zone2_run:         { label: 'Zone 2',    icon: '🏃' },
  zone2_run_reduced: { label: 'Zone 2 –',  icon: '🏃' },
  mobility:          { label: 'Mobilität', icon: '🧘' },
  rest:              { label: 'Ruhetag',   icon: '😴' },
  unknown:           { label: '–',         icon: '❓' },
}

const LEVEL_COLOR: Record<string, string> = {
  prime:    'border-prime/40 bg-prime/5',
  moderate: 'border-moderate/40 bg-moderate/5',
  low:      'border-low/40 bg-low/5',
  unknown:  'border-white/10 bg-white/2',
}

const STATUS_ICON: Record<string, string> = {
  done:     '✓',
  skipped:  '✕',
  modified: '~',
}

function fmtDate(s: string) {
  const d = new Date(s)
  const days = ['So','Mo','Di','Mi','Do','Fr','Sa']
  return { day: days[d.getDay()], num: d.getDate() }
}

function DayCard({ day, isToday }: { day: PlanDay; isToday: boolean }) {
  const [status, setStatus] = useState(day.workout_status ?? 'planned')
  const [loading, setLoading] = useState(false)

  const workout = WORKOUT_SHORT[day.recommended_workout_type ?? day.scheduled_workout_type] ?? WORKOUT_SHORT.unknown
  const levelClass = LEVEL_COLOR[day.readiness_level ?? 'unknown']
  const { day: dayName } = fmtDate(day.plan_date)
  const isRest = (day.recommended_workout_type ?? day.scheduled_workout_type) === 'rest'
  const isPast = day.plan_date < new Date().toISOString().split('T')[0]

  async function markStatus(newStatus: string) {
    if (loading) return
    const next = status === newStatus ? 'planned' : newStatus
    setLoading(true)
    try {
      await fetch(`/api/readiness/${day.plan_date}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      setStatus(next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
        ${levelClass}
        ${isToday ? 'ring-1 ring-prime' : ''}
        ${status === 'skipped' ? 'opacity-50' : ''}
      `}
      title={day.recommendation_reason ?? ''}
    >
      <span className={`text-xs font-semibold ${isToday ? 'text-prime' : 'text-slate-400'}`}>
        {dayName}
      </span>
      <span className="text-lg" aria-hidden="true">{workout.icon}</span>
      <span className="text-xs text-slate-400 text-center leading-tight">{workout.label}</span>
      {day.readiness_score != null && (
        <span className="text-xs font-bold text-slate-300">{day.readiness_score}</span>
      )}

      {/* Status-Anzeige oder Buttons */}
      {status !== 'planned' ? (
        <button
          onClick={() => markStatus(status)}
          disabled={loading}
          aria-label="Status zurücksetzen"
          className={`text-xs font-bold mt-0.5 ${
            status === 'done' ? 'text-prime' :
            status === 'skipped' ? 'text-red-400' :
            'text-amber-400'
          }`}
        >
          <span aria-hidden="true">{STATUS_ICON[status]}</span>
        </button>
      ) : (isPast || isToday) && !isRest ? (
        <div className="flex gap-0.5 mt-0.5">
          <button
            onClick={() => markStatus('done')}
            disabled={loading}
            aria-label="Als erledigt markieren"
            className="w-4 h-4 rounded text-xs bg-prime/20 text-prime hover:bg-prime/40 transition-all leading-none"
          ><span aria-hidden="true">✓</span></button>
          <button
            onClick={() => markStatus('skipped')}
            disabled={loading}
            aria-label="Als übersprungen markieren"
            className="w-4 h-4 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-all leading-none"
          ><span aria-hidden="true">✕</span></button>
        </div>
      ) : null}
    </div>
  )
}

export default function WeekPlanCard({ days }: { days: PlanDay[] }) {
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-slate-200">Wochenplan</h3>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(day => (
          <DayCard
            key={day.plan_date}
            day={day}
            isToday={day.plan_date === todayStr}
          />
        ))}
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-prime/40 inline-block" />Prime</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-moderate/40 inline-block" />Moderat</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-low/40 inline-block" />Niedrig</span>
      </div>
    </div>
  )
}
