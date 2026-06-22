'use client'

interface WeightPoint {
  entry_date: string
  weight_kg: number
  body_fat_pct: number | null
  trend_kg: number | null
}

interface Props {
  data: WeightPoint[]
  height?: number
}

function toSvgPoints(vals: number[], minY: number, maxY: number, width: number, height: number, pad: number) {
  if (vals.length < 2) return ''
  const step = (width - 2 * pad) / (vals.length - 1)
  return vals.map((v, i) => {
    const x = pad + i * step
    const y = pad + (height - 2 * pad) * (1 - (v - minY) / (maxY - minY || 1))
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export default function WeightChart({ data, height = 160 }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="card-sm flex items-center justify-center h-24 text-slate-500 text-sm">
        Noch keine Gewichtsdaten vorhanden
      </div>
    )
  }

  const width = 480
  const pad = 32

  const weights = data.map(d => d.weight_kg)
  const trends = data.map(d => d.trend_kg).filter((v): v is number => v !== null)
  const fats = data.map(d => d.body_fat_pct).filter((v): v is number => v !== null)

  const allW = [...weights, ...trends]
  const minY = Math.floor(Math.min(...allW) - 0.5)
  const maxY = Math.ceil(Math.max(...allW) + 0.5)

  const rawPts = toSvgPoints(weights, minY, maxY, width, height, pad)
  const trendPts = toSvgPoints(trends, minY, maxY, width, height, pad)

  // KFA dual axis (0-30%)
  const fatMin = 0
  const fatMax = 30
  const fatPts = toSvgPoints(fats, fatMin, fatMax, width, height, pad)

  // Y-Achse Labels
  const yTicks = [minY, Math.round((minY + maxY) / 2), maxY]

  // X-Achse: ersten und letzten Datumspunkt
  const labelFirst = data[0]?.entry_date ? new Date(data[0].entry_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) : ''
  const labelLast = data[data.length - 1]?.entry_date ? new Date(data[data.length - 1].entry_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) : ''

  const latest = data[data.length - 1]
  const delta7 = data.length >= 7
    ? (latest.weight_kg - data[data.length - 7].weight_kg)
    : null

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-200">Gewichtsverlauf</h3>
          <p className="text-xs text-slate-400 mt-0.5">Letzte 90 Tage</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-black text-slate-100">{latest.weight_kg.toFixed(1)} kg</div>
          {delta7 !== null && (
            <div className={`text-xs font-medium ${delta7 < 0 ? 'text-prime' : delta7 > 0 ? 'text-red-400' : 'text-slate-400'}`}>
              {delta7 > 0 ? '+' : ''}{delta7.toFixed(1)} kg (7T)
            </div>
          )}
          {latest.body_fat_pct && (
            <div className="text-xs text-slate-400">{latest.body_fat_pct.toFixed(1)}% KFA</div>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
      >
        {/* Gitternetz */}
        {yTicks.map(tick => {
          const y = pad + (height - 2 * pad) * (1 - (tick - minY) / (maxY - minY || 1))
          return (
            <g key={tick}>
              <line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#334155" strokeWidth="0.5" />
              <text x={pad - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">{tick}</text>
            </g>
          )
        })}

        {/* KFA-Linie (rechte Achse) */}
        {fatPts && fats.length > 1 && (
          <polyline
            points={fatPts}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.6"
          />
        )}

        {/* Rohgewicht (grau, dünner) */}
        {rawPts && (
          <polyline
            points={rawPts}
            fill="none"
            stroke="#475569"
            strokeWidth="1.5"
          />
        )}

        {/* 7-Tage-Trend (grün, dicker) */}
        {trendPts && trends.length > 1 && (
          <polyline
            points={trendPts}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Letzter Punkt Highlight */}
        {weights.length > 0 && (() => {
          const lastIdx = weights.length - 1
          const step = (width - 2 * pad) / (weights.length - 1 || 1)
          const x = pad + lastIdx * step
          const y = pad + (height - 2 * pad) * (1 - (weights[lastIdx] - minY) / (maxY - minY || 1))
          return <circle cx={x} cy={y} r="3" fill="#22c55e" />
        })()}

        {/* X-Achse Labels */}
        <text x={pad} y={height - 2} fontSize="9" fill="#64748b" textAnchor="start">{labelFirst}</text>
        <text x={width - pad} y={height - 2} fontSize="9" fill="#64748b" textAnchor="end">{labelLast}</text>
      </svg>

      {/* Legende */}
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#475569" strokeWidth="1.5" /></svg>
          Rohgewicht
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#22c55e" strokeWidth="2" /></svg>
          7T-Trend
        </span>
        {fats.length > 0 && (
          <span className="flex items-center gap-1.5">
            <svg width="16" height="3"><line x1="0" y1="1.5" x2="16" y2="1.5" stroke="#8b5cf6" strokeWidth="1" strokeDasharray="3 2" /></svg>
            KFA %
          </span>
        )}
      </div>
    </div>
  )
}
