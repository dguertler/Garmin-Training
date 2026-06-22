'use client'
import { useEffect, useState } from 'react'

interface Analysis {
  id: string
  analysis_date: string
  activity_type: string
  distance_meters: number | null
  duration_seconds: number | null
  aerobic_decoupling_pct: number | null
  avg_pace_per_km_seconds: number | null
  avg_heart_rate: number | null
  z1z2_pct: number | null
  z4z5_pct: number | null
  insights: Array<{ type: string; message: string }> | null
  overall_rating: string | null
  activity_name: string | null
}

function fmtPace(s: number | null): string {
  if (!s) return '–'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}/km`
}

function fmtDuration(s: number | null): string {
  if (!s) return '–'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function fmtDist(m: number | null): string {
  if (!m) return '–'
  return `${(m / 1000).toFixed(1)} km`
}

const RATING_STYLE: Record<string, { border: string; bg: string; text: string; label: string }> = {
  good:    { border: 'border-prime/40',    bg: 'bg-prime/5',    text: 'text-prime',    label: 'Sehr gut' },
  ok:      { border: 'border-moderate/40', bg: 'bg-moderate/5', text: 'text-moderate', label: 'OK' },
  warning: { border: 'border-low/40',      bg: 'bg-low/5',      text: 'text-low',      label: 'Achtung' },
}

export default function PostWorkoutCard() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/activities/recent-analyses')
      .then(r => r.json())
      .then(d => { setAnalyses(d.analyses ?? []); setLoading(false) })
  }, [])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="card-sm animate-pulse h-16" />)}
      </div>
    )
  }

  if (analyses.length === 0) {
    return (
      <div className="card-sm text-sm text-slate-400 text-center py-4">
        Noch keine Post-Workout-Analysen. Sync auslösen um Laufanalysen zu laden.
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-slate-200">Post-Workout-Analysen</h3>
      <div className="space-y-2">
        {analyses.map(a => {
          const style = RATING_STYLE[a.overall_rating ?? 'ok'] ?? RATING_STYLE.ok
          const isExpanded = expanded === a.id

          return (
            <div
              key={a.id}
              className={`rounded-xl border p-3 space-y-2 cursor-pointer transition-all ${style.border} ${style.bg}`}
              onClick={() => setExpanded(isExpanded ? null : a.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-200">
                    {a.activity_name ?? a.activity_type}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(a.analysis_date).toLocaleDateString('de-DE', {
                      weekday: 'short', day: 'numeric', month: 'short'
                    })} · {fmtDist(a.distance_meters)} · {fmtDuration(a.duration_seconds)}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style.border} ${style.text}`}>
                  {style.label}
                </span>
              </div>

              {/* Metrics Row */}
              <div className="flex gap-4 text-xs">
                {a.avg_pace_per_km_seconds && (
                  <span className="text-slate-300">
                    <span className="text-slate-500">Pace </span>{fmtPace(a.avg_pace_per_km_seconds)}
                  </span>
                )}
                {a.avg_heart_rate && (
                  <span className="text-slate-300">
                    <span className="text-slate-500">HR </span>{a.avg_heart_rate} bpm
                  </span>
                )}
                {a.aerobic_decoupling_pct !== null && (
                  <span className={a.aerobic_decoupling_pct < 5 ? 'text-prime' : a.aerobic_decoupling_pct < 10 ? 'text-moderate' : 'text-low'}>
                    Pa:HR {a.aerobic_decoupling_pct > 0 ? '+' : ''}{a.aerobic_decoupling_pct.toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Zone-Distribution */}
              {(a.z1z2_pct !== null || a.z4z5_pct !== null) && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden flex">
                    <div className="h-full bg-prime/60" style={{ width: `${a.z1z2_pct ?? 0}%` }} />
                    <div className="h-full bg-amber-400/60" style={{ width: `${100 - (a.z1z2_pct ?? 0) - (a.z4z5_pct ?? 0)}%` }} />
                    <div className="h-full bg-red-400/60" style={{ width: `${a.z4z5_pct ?? 0}%` }} />
                  </div>
                  <span className="text-prime">{Math.round(a.z1z2_pct ?? 0)}% Z1/2</span>
                  <span className="text-red-400">{Math.round(a.z4z5_pct ?? 0)}% Z4/5</span>
                </div>
              )}

              {/* Insights (expanded) */}
              {isExpanded && Array.isArray(a.insights) && a.insights.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  {a.insights.map((ins, i) => (
                    <div key={i} className="text-xs text-slate-300 flex gap-2">
                      <span>{ins.type === 'good' ? '✓' : ins.type === 'warning' ? '⚠' : 'ℹ'}</span>
                      <span>{ins.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
