'use client'

interface Props {
  today: number | null
  goal: number
  avg7: number | null
  neatBaseline?: number | null
  neatWarning?: boolean
  values?: (number | null)[]
}

export default function StepsWidget({ today, goal, avg7, neatBaseline, neatWarning: neatWarnProp, values }: Props) {
  const pct = today && goal ? Math.min((today / goal) * 100, 100) : 0
  // NEAT-Warnung: entweder von API (Vormonats-Baseline) oder Fallback auf Ziel-basiert
  const neatWarning = neatWarnProp !== undefined
    ? neatWarnProp
    : (avg7 !== null && avg7 < goal * 0.85)

  return (
    <div className="card-sm flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="stat-label">NEAT / Schritte</span>
        {neatWarning && (
          <span className="badge-moderate text-[9px] px-1 py-0.5">NEAT ↓</span>
        )}
      </div>

      {/* Heute + Ziel */}
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-100">
          {today != null ? Math.round(today / 1000 * 10) / 10 + 'k' : '–'}
        </span>
        <span className="text-xs text-slate-400">/ {Math.round(goal / 1000)}k Ziel</span>
        {avg7 != null && (
          <span className={`text-xs ml-auto font-medium ${
            avg7 >= goal ? 'text-prime' : avg7 >= goal * 0.85 ? 'text-moderate' : 'text-low'
          }`}>
            Ø {Math.round(avg7 / 1000 * 10) / 10}k
          </span>
        )}
      </div>

      {/* Progressbar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mt-0.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>

      {/* Sparkline */}
      {values && values.filter(v => v !== null).length >= 2 && (
        <StepsSparkline values={values} goal={goal} />
      )}

      {neatBaseline && (
        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
          <span>Baseline Vormonat</span>
          <span>{neatBaseline.toLocaleString('de')}</span>
        </div>
      )}
    </div>
  )
}

function StepsSparkline({ values, goal }: { values: (number | null)[]; goal: number }) {
  const nonNull = values.filter((v): v is number => v !== null)
  const min = Math.min(...nonNull, 0)
  const max = Math.max(...nonNull, goal) || 1
  const range = max - min || 1
  const w = 100, h = 28
  const allIdxs = values.map((v, i) => ({ v, i })).filter(({ v }) => v !== null) as { v: number; i: number }[]
  const pts = allIdxs.map(({ v, i }) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  // Ziel-Linie
  const goalY = (h - ((goal - min) / range) * (h - 4) - 2).toFixed(1)
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1 opacity-70">
      <line x1="0" y1={goalY} x2={w} y2={goalY} stroke="#334155" strokeWidth="0.8" strokeDasharray="2 2" />
      <polyline points={pts} fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}
