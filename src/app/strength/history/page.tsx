'use client'
import { useEffect, useState } from 'react'

interface StrengthLog {
  id: string
  log_date: string
  workout_type: string
  total_volume_kg: number | null
  subjective_rating: number | null
  readiness_score_at_training: number | null
  session_notes: string | null
  sets: Array<{
    movement_pattern: string
    exercise_name: string
    set_number: number
    reps: number
    added_weight_kg: number | null
    rir: number | null
  }> | null
}

const TYPE_LABELS: Record<string, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  push_reduced: 'Push (−20%)',
  pull_reduced: 'Pull (−20%)',
  legs_reduced: 'Legs (−20%)',
}

const TYPE_COLORS: Record<string, string> = {
  push: '#22c55e',
  push_reduced: '#86efac',
  pull: '#3b82f6',
  pull_reduced: '#93c5fd',
  legs: '#f59e0b',
  legs_reduced: '#fcd34d',
}

function VolumeSparkLine({ logs }: { logs: StrengthLog[] }) {
  const volumes = logs
    .filter(l => l.total_volume_kg !== null)
    .map(l => l.total_volume_kg as number)
    .slice(-12)

  if (volumes.length < 2) return null

  const min = Math.min(...volumes)
  const max = Math.max(...volumes)
  const range = max - min || 1
  const w = 120
  const h = 32
  const pts = volumes.map((v, i) => {
    const x = (i / (volumes.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 4) - 2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts} fill="none" stroke="#22c55e" strokeWidth="1.5" />
    </svg>
  )
}

export default function StrengthHistoryPage() {
  const [logs, setLogs] = useState<StrengthLog[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '30' })
    if (filter !== 'all') params.set('type', filter)
    fetch(`/api/strength?${params}`)
      .then(r => r.json())
      .then(d => { setLogs(d.logs ?? []); setLoading(false) })
  }, [filter])

  const filteredLogs = logs

  // Durchschnittsvolumen der letzten 4 Sessions
  const recentVols = filteredLogs
    .filter(l => l.total_volume_kg !== null)
    .slice(0, 4)
    .map(l => l.total_volume_kg as number)
  const avgVol = recentVols.length ? Math.round(recentVols.reduce((a, b) => a + b, 0) / recentVols.length) : null

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Trainings-Verlauf</h1>
          <p className="text-xs text-slate-400 mt-0.5">Letzte 30 Sessions</p>
        </div>
        {avgVol && (
          <div className="text-right">
            <div className="text-xs text-slate-400">Ø Volumen (4 Sessions)</div>
            <div className="text-lg font-bold text-slate-100">{avgVol} kg</div>
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: 'Alle' },
          { key: 'push', label: 'Push' },
          { key: 'pull', label: 'Pull' },
          { key: 'legs', label: 'Legs' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
              filter === f.key
                ? 'bg-prime/20 text-prime border border-prime/40'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20'
            }`}
          >
            {f.label}
          </button>
        ))}
        {filteredLogs.length > 0 && <VolumeSparkLine logs={filteredLogs} />}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="card animate-pulse h-20" />)}
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card text-center text-slate-400 py-8">
          Noch keine Sessions aufgezeichnet.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map(log => {
            const color = TYPE_COLORS[log.workout_type] ?? '#64748b'
            const isExpanded = expanded === log.id
            const avgRir = log.sets?.length
              ? log.sets
                  .filter(s => s.rir !== null)
                  .reduce((sum, s, _, arr) => sum + (s.rir ?? 0) / arr.length, 0)
              : null

            return (
              <div key={log.id} className="card space-y-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ background: color }} />
                    <div>
                      <div className="font-semibold text-slate-200">
                        {TYPE_LABELS[log.workout_type] ?? log.workout_type}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(log.log_date).toLocaleDateString('de-DE', {
                          weekday: 'short', day: 'numeric', month: 'short'
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    {log.total_volume_kg !== null && (
                      <div>
                        <div className="text-sm font-bold text-slate-100">{Math.round(log.total_volume_kg)} kg</div>
                        <div className="text-xs text-slate-500">Volumen</div>
                      </div>
                    )}
                    {avgRir !== null && (
                      <div>
                        <div className="text-sm font-bold text-slate-100">{avgRir.toFixed(1)}</div>
                        <div className="text-xs text-slate-500">Ø RIR</div>
                      </div>
                    )}
                    {log.subjective_rating !== null && (
                      <div>
                        <div className="text-sm font-bold" style={{ color }}>
                          {log.subjective_rating}/10
                        </div>
                        <div className="text-xs text-slate-500">Rating</div>
                      </div>
                    )}
                    <span className="text-slate-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Expanded: Satz-Details */}
                {isExpanded && log.sets && (
                  <div className="border-t border-white/5 pt-3 space-y-2">
                    {log.readiness_score_at_training !== null && (
                      <div className="text-xs text-slate-400">
                        Readiness bei Training: <span className="text-slate-200 font-medium">{log.readiness_score_at_training}</span>
                      </div>
                    )}
                    {log.session_notes && (
                      <div className="text-xs text-slate-400 italic">{log.session_notes}</div>
                    )}
                    <div className="grid grid-cols-4 gap-1.5 text-xs text-slate-500 font-medium">
                      <span>Übung</span><span className="text-center">Wdh.</span>
                      <span className="text-center">+kg</span><span className="text-center">RIR</span>
                    </div>
                    {log.sets.map((s, i) => (
                      <div key={i} className="grid grid-cols-4 gap-1.5 text-xs">
                        <span className="text-slate-300 truncate">{s.exercise_name}</span>
                        <span className="text-center text-slate-200">{s.reps}</span>
                        <span className="text-center text-slate-200">{s.added_weight_kg ?? '–'}</span>
                        <span className="text-center text-slate-200">{s.rir ?? '–'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
