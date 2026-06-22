'use client'

interface Props {
  today: number | null
  goal: number
  avg7: number | null
}

export default function StepsWidget({ today, goal, avg7 }: Props) {
  const pct = today && goal ? Math.min((today / goal) * 100, 100) : 0
  const neatWarning = avg7 !== null && avg7 < goal * 0.85

  return (
    <div className="card-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200 text-sm">NEAT / Schritte</h3>
        {neatWarning && (
          <span className="badge-moderate">NEAT niedrig</span>
        )}
      </div>

      {/* Progressbar */}
      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>{(today ?? 0).toLocaleString('de')} Schritte</span>
          <span>Ziel: {goal.toLocaleString('de')}</span>
        </div>
        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444',
            }}
          />
        </div>
      </div>

      {/* 7-Tage-Mittel */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">7-Tage-Mittel</span>
        <span className={`font-semibold ${
          avg7 && avg7 >= goal ? 'text-prime' :
          avg7 && avg7 >= goal * 0.85 ? 'text-moderate' : 'text-low'
        }`}>
          {avg7 ? avg7.toLocaleString('de') : '–'}
        </span>
      </div>

      {neatWarning && (
        <p className="text-xs text-moderate leading-relaxed">
          Schritt-Mittel mehr als 15% unter Ziel – NEAT-Absenkung kann Plateau verursachen.
        </p>
      )}
    </div>
  )
}
