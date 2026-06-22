'use client'

interface RacePrediction {
  distance_label: string
  predicted_time_seconds: number
  race_date: string
  vo2_max_estimate: number | null
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

const DISTANCE_ORDER = ['5K', '10K', 'Halbmarathon', 'Marathon']

export default function RacePredictionWidget({ predictions }: { predictions: RacePrediction[] }) {
  if (!predictions.length) {
    return (
      <div className="card-sm">
        <p className="text-sm text-slate-400">Noch keine Race-Prediction-Daten vorhanden. Synchronisiere deine Garmin-Daten.</p>
      </div>
    )
  }

  const sorted = [...predictions].sort(
    (a, b) => DISTANCE_ORDER.indexOf(a.distance_label) - DISTANCE_ORDER.indexOf(b.distance_label)
  )

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-slate-200">Race Predictions</h3>
      <div className="grid grid-cols-2 gap-3">
        {sorted.map(p => (
          <div key={p.distance_label} className="bg-white/5 rounded-xl p-3">
            <div className="stat-label">{p.distance_label}</div>
            <div className="text-xl font-black text-prime mt-1">{formatTime(p.predicted_time_seconds)}</div>
            {p.vo2_max_estimate && (
              <div className="text-xs text-slate-400 mt-1">VO2max {p.vo2_max_estimate}</div>
            )}
            <div className="text-xs text-slate-500 mt-0.5">
              {new Date(p.race_date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
