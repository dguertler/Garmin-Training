'use client'
import { useEffect, useState } from 'react'

interface WeekData {
  week_start_date: string
  total_training_seconds: number
  z1_pct: number
  z2_pct: number
  z3_pct: number
  z4_pct: number
  z5_pct: number
  low_intensity_pct: number
  high_intensity_pct: number
  polarization_ok: boolean
}

interface ZonesData {
  current_week: WeekData | null
  weeks: WeekData[]
  summary_4w: {
    avg_low_intensity_pct: number | null
    avg_high_intensity_pct: number | null
    polarization_ok: boolean | null
  }
}

function formatMins(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const ZONE_COLORS = ['#22c55e', '#86efac', '#f59e0b', '#f97316', '#ef4444']
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

export default function PolarizedZonesChart() {
  const [data, setData] = useState<ZonesData | null>(null)

  useEffect(() => {
    fetch('/api/training/zones').then(r => r.json()).then(setData)
  }, [])

  if (!data) return <div className="card animate-pulse h-48" />

  const cw = data.current_week
  const s4 = data.summary_4w

  const pcts = cw ? [cw.z1_pct, cw.z2_pct, cw.z3_pct, cw.z4_pct, cw.z5_pct] : [0, 0, 0, 0, 0]

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-200">80/20 Zonenverteilung</h3>
        {cw && (
          <span className={`badge ${cw.polarization_ok ? 'badge-prime' : 'badge-moderate'} text-xs`}>
            {cw.polarization_ok ? '✓ Polarisiert' : '⚠ Prüfen'}
          </span>
        )}
      </div>

      {/* Stacked bar – aktuelle Woche */}
      {cw && cw.total_training_seconds > 0 ? (
        <div className="space-y-2">
          <div className="flex h-6 rounded-full overflow-hidden gap-0.5">
            {pcts.map((p, i) =>
              p > 0 ? (
                <div
                  key={i}
                  style={{ width: `${p}%`, backgroundColor: ZONE_COLORS[i] }}
                  className="flex items-center justify-center text-xs font-bold text-black"
                  title={`${ZONE_LABELS[i]}: ${p}%`}
                >
                  {p >= 8 ? `${Math.round(p)}%` : ''}
                </div>
              ) : null
            )}
          </div>

          {/* Z1+Z2 vs Z4+Z5 summary */}
          <div className="flex justify-between text-xs">
            <span className="text-prime font-medium">Low (Z1+Z2): {cw.low_intensity_pct}%</span>
            <span className="text-slate-400">Z3 (grau): {cw.z3_pct}%</span>
            <span className="text-moderate font-medium">High (Z4+Z5): {cw.high_intensity_pct}%</span>
          </div>

          <div className="text-xs text-slate-400">
            Trainingszeit diese Woche: {formatMins(cw.total_training_seconds)}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Noch keine Aktivitäten diese Woche.</p>
      )}

      {/* 4-Wochen-Durchschnitt */}
      {s4.avg_low_intensity_pct !== null && (
        <div className="pt-2 border-t border-white/5">
          <div className="stat-label mb-1">Ø 4 Wochen</div>
          <div className="flex gap-4 text-sm">
            <span className={`font-medium ${s4.avg_low_intensity_pct >= 75 ? 'text-prime' : 'text-moderate'}`}>
              Low: {s4.avg_low_intensity_pct}%
            </span>
            <span className={`font-medium ${(s4.avg_high_intensity_pct ?? 0) <= 25 ? 'text-prime' : 'text-moderate'}`}>
              High: {s4.avg_high_intensity_pct}%
            </span>
            <span className={`text-xs font-semibold ${s4.polarization_ok ? 'text-prime' : 'text-low'}`}>
              {s4.polarization_ok ? '✓ 80/20 eingehalten' : '✗ Ziel: ≥80% low, ≤20% high'}
            </span>
          </div>
        </div>
      )}

      {/* Mini-Historie – letzte 8 Wochen als Streifen */}
      {data.weeks.length > 1 && (
        <div className="pt-2 border-t border-white/5">
          <div className="stat-label mb-2">Wochenverlauf</div>
          <div className="space-y-1">
            {data.weeks.slice(0, 6).map(w => (
              <div key={w.week_start_date} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-14">
                  {new Date(w.week_start_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                </span>
                <div className="flex-1 flex h-3 rounded overflow-hidden gap-0.5">
                  {[w.z1_pct, w.z2_pct, w.z3_pct, w.z4_pct, w.z5_pct].map((p, i) =>
                    p > 0 ? (
                      <div key={i} style={{ width: `${p}%`, backgroundColor: ZONE_COLORS[i] }} />
                    ) : null
                  )}
                </div>
                <span className={`text-xs w-4 ${w.polarization_ok ? 'text-prime' : 'text-moderate'}`}>
                  {w.polarization_ok ? '✓' : '–'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
