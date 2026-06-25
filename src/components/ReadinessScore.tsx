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
  alcoholWarning?: string | null
}

const LEVEL_LABEL: Record<string, string> = {
  prime:    'PRIME',
  moderate: 'MODERAT',
  low:      'NIEDRIG',
  unknown:  'KEIN SIGNAL',
}

const LEVEL_COLOR: Record<string, string> = {
  prime:    '#10B981',
  moderate: '#F59E0B',
  low:      '#EF4444',
  unknown:  '#4B5A6E',
}

const WORKOUT_LABEL: Record<string, string> = {
  push:            'Push — Brust · Schulter · Trizeps',
  push_reduced:    'Push (reduziert)',
  pull:            'Pull — Rücken · Bizeps',
  pull_reduced:    'Pull (reduziert)',
  legs:            'Legs & Core',
  legs_reduced:    'Legs (reduziert)',
  zone2_run:       'Zone-2-Lauf',
  zone2_run_reduced: 'Zone-2-Lauf (leichter)',
  mobility:        'Mobilität · aktive Erholung',
  rest:            'Ruhetag',
}

// Tick-Positionen für den Instrumentenring (24 Ticks, jede 15°)
const TICKS = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * 360 - 90
  const rad = (angle * Math.PI) / 180
  const isMajor = i % 6 === 0   // bei 0, 25, 50, 75, 100
  const r1 = isMajor ? 43 : 44
  const r2 = isMajor ? 47 : 46
  return {
    x1: 50 + r1 * Math.cos(rad),
    y1: 50 + r1 * Math.sin(rad),
    x2: 50 + r2 * Math.cos(rad),
    y2: 50 + r2 * Math.sin(rad),
    isMajor,
  }
})

export default function ReadinessScore({ score, level, color, recommendation, reason, factors, alcoholWarning }: Props) {
  const scoreDisplay = score ?? '–'
  // r=38, circumference = 2π×38 ≈ 238.76
  const circumference = 2 * Math.PI * 38
  const arc = score !== null ? (score / 100) * circumference : 0
  const displayColor = LEVEL_COLOR[level] ?? color

  return (
    <div className="card flex flex-col items-center gap-5">

      {/* Präzisionsmessgerät */}
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          {/* Tick-Ring */}
          {TICKS.map((t, i) => (
            <line
              key={i}
              x1={t.x1} y1={t.y1}
              x2={t.x2} y2={t.y2}
              stroke={t.isMajor ? '#2A3A52' : '#1C2535'}
              strokeWidth={t.isMajor ? 1.2 : 0.8}
              strokeLinecap="round"
            />
          ))}

          {/* Track */}
          <circle
            cx="50" cy="50" r="38"
            fill="none"
            stroke="#141C28"
            strokeWidth="7"
          />

          {/* Arc */}
          <circle
            cx="50" cy="50" r="38"
            fill="none"
            stroke={displayColor}
            strokeWidth="7"
            strokeDasharray={`${arc} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>

        {/* Score-Anzeige */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[2.6rem] font-medium leading-none"
            style={{
              fontFamily: 'var(--font-data)',
              color: '#C4D0E0',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {scoreDisplay}
          </span>
          <span
            className="text-[10px] font-semibold tracking-widest mt-1.5"
            style={{ color: displayColor, fontFamily: 'var(--font-body)' }}
          >
            {LEVEL_LABEL[level] ?? level}
          </span>
        </div>
      </div>

      {/* Empfehlung */}
      <div className="w-full text-center space-y-1.5">
        <p className="text-sm font-semibold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          {WORKOUT_LABEL[recommendation] ?? recommendation}
        </p>
        <p className="text-xs text-fade leading-relaxed">{reason}</p>
      </div>

      {/* Alkohol-Warnung */}
      {alcoholWarning && (
        <div className="w-full bg-moderate/8 border border-moderate/25 rounded-xl px-3 py-2 text-xs text-moderate text-center">
          {alcoholWarning}
        </div>
      )}

      {/* Faktor-Chips */}
      <div className="flex flex-wrap gap-1.5 justify-center w-full">
        {factors.hrv_vs_baseline_pct !== null && (
          <FactorChip
            label="HRV"
            value={`${factors.hrv_vs_baseline_pct > 0 ? '+' : ''}${factors.hrv_vs_baseline_pct}%`}
            ok={factors.hrv_vs_baseline_pct >= -8}
          />
        )}
        {factors.sleep_score !== null && (
          <FactorChip
            label="Schlaf"
            value={`${factors.sleep_score}/100`}
            ok={factors.sleep_score >= 70}
          />
        )}
        {factors.body_battery_morning !== null && (
          <FactorChip
            label="Body Battery"
            value={String(factors.body_battery_morning)}
            ok={factors.body_battery_morning >= 50}
          />
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
    <div className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border
      ${ok
        ? 'bg-prime/8 text-prime border-prime/20'
        : 'bg-moderate/8 text-moderate border-moderate/20'
      }`}
    >
      <span className="text-fade">{label}</span>
      <span style={{ fontFamily: 'var(--font-data)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}
