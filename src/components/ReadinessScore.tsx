'use client'

interface Props {
  score: number | null
  level: 'prime' | 'moderate' | 'low' | 'unknown'
  color: string
  recommendation: string
  reason: string
  factors: {
    hrv_vs_baseline_pct: number | null
    sleep_score: number | null
    body_battery_morning: number | null
    hrv_status: string | null
    training_status: string | null
  }
}

const LEVEL_LABEL: Record<string, string> = {
  prime: 'PRIME',
  moderate: 'MODERAT',
  low: 'NIEDRIG',
  unknown: 'KEIN SIGNAL',
}

const WORKOUT_LABEL: Record<string, string> = {
  push: 'Push – Brust / Schulter / Trizeps',
  push_reduced: 'Push (reduziert)',
  pull: 'Pull – Rücken / Bizeps',
  pull_reduced: 'Pull (reduziert)',
  legs: 'Legs & Core',
  legs_reduced: 'Legs (reduziert)',
  zone2_run: 'Zone-2-Lauf',
  zone2_run_reduced: 'Zone-2-Lauf (leichter)',
  mobility: 'Mobilität / aktive Erholung',
  rest: 'Ruhetag',
}

export default function ReadinessScore({ score, level, color, recommendation, reason, factors }: Props) {
  const scoreDisplay = score ?? '–'
  const arc = score !== null ? Math.round((score / 100) * 251.2) : 0  // 2π × 40

  return (
    <div className="card flex flex-col items-center gap-4">
      {/* Donut */}
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="10" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${arc} 251.2`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-slate-100">{scoreDisplay}</span>
          <span className="text-xs font-semibold mt-0.5" style={{ color }}>
            {LEVEL_LABEL[level] ?? level}
          </span>
        </div>
      </div>

      {/* Empfehlung */}
      <div className="w-full text-center space-y-1">
        <p className="text-sm font-semibold text-slate-200">
          {WORKOUT_LABEL[recommendation] ?? recommendation}
        </p>
        <p className="text-xs text-slate-400 leading-relaxed">{reason}</p>
      </div>

      {/* Faktor-Chips */}
      <div className="flex flex-wrap gap-2 justify-center w-full">
        {factors.hrv_vs_baseline_pct !== null && (
          <FactorChip
            label="HRV"
            value={`${factors.hrv_vs_baseline_pct > 0 ? '+' : ''}${factors.hrv_vs_baseline_pct}% Baseline`}
            ok={factors.hrv_vs_baseline_pct >= -8}
          />
        )}
        {factors.sleep_score !== null && (
          <FactorChip label="Schlaf" value={`${factors.sleep_score}/100`} ok={factors.sleep_score >= 70} />
        )}
        {factors.body_battery_morning !== null && (
          <FactorChip label="Body Battery" value={`${factors.body_battery_morning}`} ok={factors.body_battery_morning >= 50} />
        )}
        {factors.training_status && (
          <FactorChip label="Status" value={factors.training_status} ok={true} />
        )}
      </div>
    </div>
  )
}

function FactorChip({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className={`text-xs px-2.5 py-1 rounded-full font-medium
      ${ok ? 'bg-prime/15 text-prime' : 'bg-moderate/15 text-moderate'}`}>
      <span className="text-slate-400">{label}: </span>{value}
    </div>
  )
}
