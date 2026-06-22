'use client'

interface MacroData {
  calories_target: number
  protein_target_g: number
  carbs_target_g: number
  fat_target_g: number
  tdee_kcal?: number
  is_training_day?: boolean
  is_refeed_day?: boolean
}

interface Props {
  nutrition: MacroData | null
  onOpenInput: () => void
}

function Ring({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const arc = Math.min(pct / 100, 1) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color}
        strokeWidth="6" strokeDasharray={`${arc} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

export default function MacroRings({ nutrition, onOpenInput }: Props) {
  if (!nutrition) {
    return (
      <div className="card flex flex-col items-center justify-center gap-3 min-h-[180px]">
        <p className="text-slate-400 text-sm">Noch keine Eingabe heute</p>
        <button onClick={onOpenInput} className="btn-primary text-sm">
          Gewicht + KFA eingeben
        </button>
      </div>
    )
  }

  const macros = [
    { label: 'Protein',        value: nutrition.protein_target_g, unit: 'g', color: '#22c55e', bg: '#15803d', pct: 100 },
    { label: 'Kohlenhydrate',  value: nutrition.carbs_target_g,   unit: 'g', color: '#3b82f6', bg: '#1d4ed8', pct: 100 },
    { label: 'Fett',           value: nutrition.fat_target_g,     unit: 'g', color: '#f59e0b', bg: '#b45309', pct: 100 },
  ]

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">Heutige Makros</h3>
        <div className="flex items-center gap-2">
          {nutrition.is_training_day && (
            <span className="badge-prime">Trainingstag</span>
          )}
          {nutrition.is_refeed_day && (
            <span className="badge-moderate">Refeed</span>
          )}
        </div>
      </div>

      {/* Kalorien groß */}
      <div className="text-center py-1">
        <div className="text-3xl font-black text-slate-100">{nutrition.calories_target}</div>
        <div className="text-xs text-slate-400 mt-0.5">
          kcal Ziel
          {nutrition.tdee_kcal ? <> · TDEE ~{Math.round(nutrition.tdee_kcal)} kcal</> : null}
        </div>
      </div>

      {/* Makro-Ringe */}
      <div className="grid grid-cols-3 gap-3">
        {macros.map(m => (
          <div key={m.label} className="flex flex-col items-center gap-1.5">
            <div className="relative">
              <Ring pct={m.pct} color={m.color} size={64} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-100">
                {Math.round(m.value)}
              </span>
            </div>
            <div className="text-center">
              <div className="text-xs font-semibold" style={{ color: m.color }}>
                {Math.round(m.value)}{m.unit}
              </div>
              <div className="text-xs text-slate-500">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onOpenInput} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors">
        Gewicht/KFA aktualisieren
      </button>
    </div>
  )
}
