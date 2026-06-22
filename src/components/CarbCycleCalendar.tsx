'use client'

const WEEKLY_SKELETON: Record<number, { type: string; label: string; carbs: string; color: string }> = {
  1: { type: 'strength',  label: 'Push',   carbs: 'Normal',   color: '#22c55e' },
  2: { type: 'cardio',    label: 'Zone 2', carbs: 'Normal',   color: '#22c55e' },
  3: { type: 'strength',  label: 'Pull',   carbs: 'Normal',   color: '#22c55e' },
  4: { type: 'mobility',  label: 'Mobil',  carbs: '−70g',     color: '#64748b' },
  5: { type: 'refeed',    label: 'Legs',   carbs: '+50g Ref', color: '#3b82f6' },
  6: { type: 'cardio',    label: 'Zone 2', carbs: 'Normal',   color: '#22c55e' },
  0: { type: 'rest',      label: 'Rest',   carbs: '−70g',     color: '#64748b' },
}

function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = []
  const monday = new Date(startDate)
  const dow = monday.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  monday.setDate(monday.getDate() + diff)
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

function getMonday4WeeksAgo(): Date {
  const d = new Date()
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff - 21) // 3 weeks back to current week = 4 weeks total
  return d
}

const DOW_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function CarbCycleCalendar() {
  const todayStr = new Date().toISOString().split('T')[0]
  const startMonday = getMonday4WeeksAgo()

  const weeks: Date[][] = []
  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(startMonday)
    weekStart.setDate(startMonday.getDate() + w * 7)
    weeks.push(getWeekDays(weekStart))
  }

  return (
    <div className="card space-y-3">
      <div>
        <h3 className="font-semibold text-slate-200">Carb-Cycling-Kalender</h3>
        <p className="text-xs text-slate-400 mt-0.5">4-Wochen-Übersicht nach Wochenskelett</p>
      </div>

      {/* Header */}
      <div className="grid grid-cols-8 gap-1 text-xs text-slate-500 font-medium">
        <span>KW</span>
        {DOW_LABELS.map(d => <span key={d} className="text-center">{d}</span>)}
      </div>

      {/* Wochen */}
      {weeks.map((days, wi) => {
        const kw = getISOWeek(days[0])
        return (
          <div key={wi} className="grid grid-cols-8 gap-1 items-center">
            <span className="text-xs text-slate-500">{kw}</span>
            {days.map(day => {
              const dowIndex = day.getDay() // 0=So, 1=Mo, ...
              const meta = WEEKLY_SKELETON[dowIndex]
              const dateStr = day.toISOString().split('T')[0]
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr

              return (
                <div
                  key={dateStr}
                  className={`rounded-lg p-1.5 text-center transition-all ${
                    isToday ? 'ring-1 ring-prime' : ''
                  } ${isPast ? 'opacity-50' : ''}`}
                  style={{ background: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
                  title={`${meta.label}: ${meta.carbs}`}
                >
                  <div className="text-xs font-medium" style={{ color: meta.color }}>
                    {day.getDate()}
                  </div>
                  <div className="text-[9px] text-slate-400 leading-tight mt-0.5 hidden sm:block">
                    {meta.carbs}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* Legende */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-1 border-t border-white/5">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-prime/40 inline-block" />Normal (Trainingstag)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-blue-500/40 inline-block" />+50g Carbs (Refeed/Legs)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-slate-500/40 inline-block" />−70g Carbs (Ruhetag)
        </span>
      </div>
    </div>
  )
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
