'use client'

interface SleepDay {
  metric_date: string
  sleep_score: number | null
  sleep_duration_seconds: number | null
  sleep_deep_seconds: number | null
  sleep_rem_seconds: number | null
  sleep_light_seconds: number | null
}

function fmtDate(s: string) {
  const d = new Date(s)
  return ['So','Mo','Di','Mi','Do','Fr','Sa'][d.getDay()]
}

function fmtH(sec: number | null) {
  if (!sec) return '–'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${h}h${m ? ` ${m}m` : ''}`
}

export default function SleepBars({ data }: { data: SleepDay[] }) {
  const maxSec = 9 * 3600  // 9h = 100%

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-slate-200">Schlaf – letzte 7 Nächte</h3>
      <div className="space-y-2">
        {data.map(day => {
          const total = day.sleep_duration_seconds ?? 0
          const deep  = day.sleep_deep_seconds ?? 0
          const rem   = day.sleep_rem_seconds ?? 0
          const light = day.sleep_light_seconds ?? 0
          const pDeep  = total ? (deep  / maxSec) * 100 : 0
          const pRem   = total ? (rem   / maxSec) * 100 : 0
          const pLight = total ? (light / maxSec) * 100 : 0

          return (
            <div key={day.metric_date} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-6 shrink-0">{fmtDate(day.metric_date)}</span>
              <div className="flex-1 h-5 rounded-full overflow-hidden bg-white/5 flex">
                <div className="h-full bg-blue-800 transition-all" style={{ width: `${pLight}%` }} title={`Leicht ${fmtH(light)}`} />
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${pRem}%` }}   title={`REM ${fmtH(rem)}`} />
                <div className="h-full bg-blue-300 transition-all" style={{ width: `${pDeep}%` }}  title={`Tief ${fmtH(deep)}`} />
              </div>
              <div className="flex items-center gap-2 w-24 shrink-0 justify-end">
                <span className="text-xs text-slate-400">{fmtH(total)}</span>
                {day.sleep_score !== null && (
                  <span className={`text-xs font-semibold w-8 text-right
                    ${day.sleep_score >= 80 ? 'text-prime' :
                      day.sleep_score >= 60 ? 'text-moderate' : 'text-low'}`}>
                    {day.sleep_score}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-300 inline-block" />Tief</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />REM</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-800 inline-block" />Leicht</span>
      </div>
    </div>
  )
}
