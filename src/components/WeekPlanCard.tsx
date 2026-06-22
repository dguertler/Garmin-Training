'use client'

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
  push:         { label: 'Push',          icon: '💪' },
  push_reduced: { label: 'Push –',        icon: '💪' },
  pull:         { label: 'Pull',          icon: '🏋️' },
  pull_reduced: { label: 'Pull –',        icon: '🏋️' },
  legs:         { label: 'Legs',          icon: '🦵' },
  legs_reduced: { label: 'Legs –',        icon: '🦵' },
  zone2_run:    { label: 'Zone 2',        icon: '🏃' },
  zone2_run_reduced: { label: 'Zone 2 –', icon: '🏃' },
  mobility:     { label: 'Mobilität',     icon: '🧘' },
  rest:         { label: 'Ruhetag',       icon: '😴' },
  unknown:      { label: '–',             icon: '❓' },
}

const LEVEL_COLOR: Record<string, string> = {
  prime:    'border-prime/40 bg-prime/5',
  moderate: 'border-moderate/40 bg-moderate/5',
  low:      'border-low/40 bg-low/5',
  unknown:  'border-white/10 bg-white/2',
}

function fmtDate(s: string) {
  const d = new Date(s)
  const days = ['So','Mo','Di','Mi','Do','Fr','Sa']
  return { day: days[d.getDay()], num: d.getDate() }
}

export default function WeekPlanCard({ days }: { days: PlanDay[] }) {
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-slate-200">Wochenplan</h3>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(day => {
          const { day: dayName, num } = fmtDate(day.plan_date)
          const isToday = day.plan_date === todayStr
          const workout = WORKOUT_SHORT[day.recommended_workout_type ?? day.scheduled_workout_type] ?? WORKOUT_SHORT.unknown
          const levelClass = LEVEL_COLOR[day.readiness_level ?? 'unknown']

          return (
            <div
              key={day.plan_date}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all
                ${levelClass}
                ${isToday ? 'ring-1 ring-prime' : ''}
                ${day.workout_status === 'completed' ? 'opacity-60' : ''}
              `}
              title={day.recommendation_reason ?? ''}
            >
              <span className={`text-xs font-semibold ${isToday ? 'text-prime' : 'text-slate-400'}`}>
                {dayName}
              </span>
              <span className="text-lg">{workout.icon}</span>
              <span className="text-xs text-slate-400 text-center leading-tight">{workout.label}</span>
              {day.readiness_score !== null && day.readiness_score !== undefined && (
                <span className="text-xs font-bold text-slate-300">{day.readiness_score}</span>
              )}
              {day.workout_status === 'completed' && (
                <span className="text-prime text-xs">✓</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-prime/40 inline-block" />Prime</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-moderate/40 inline-block" />Moderat</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-low/40 inline-block" />Niedrig</span>
      </div>
    </div>
  )
}
