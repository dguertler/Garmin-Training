/**
 * Geteilte Ansicht – zeigt Readiness + Trainingsplan des anderen Profils (read-only).
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { query, queryOne } from '@/lib/db'
import Link from 'next/link'

export const metadata = { title: 'Partner-Übersicht' }

export default async function SharedDashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const currentProfileKey = session.user?.profileKey ?? 'daniel'

  // Anderen User ermitteln
  const otherUser = await queryOne<{
    id: string
    name: string
    email: string
  }>(
    'SELECT id, name, email FROM users WHERE profile_key != $1 LIMIT 1',
    [currentProfileKey]
  )

  if (!otherUser) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Kein zweites Profil gefunden.</p>
        <Link href="/dashboard" className="text-prime text-sm mt-2 block">← Zurück</Link>
      </div>
    )
  }

  const userId = otherUser.id

  const [readiness, todayMetrics, weekPlan] = await Promise.all([
    queryOne<{
      readiness_score: number
      readiness_level: string
      recommendation: string
      plan_date: string
    }>(
      'SELECT readiness_score, readiness_level, recommendation, plan_date FROM daily_readiness WHERE user_id = $1 ORDER BY plan_date DESC LIMIT 1',
      [userId]
    ),
    queryOne<{
      training_readiness_score: number | null
      body_battery_most_recent: number | null
      sleep_score: number | null
      resting_heart_rate: number | null
      steps: number | null
    }>(
      'SELECT training_readiness_score, body_battery_most_recent, sleep_score, resting_heart_rate, steps FROM garmin_raw_metrics WHERE user_id = $1 ORDER BY metric_date DESC LIMIT 1',
      [userId]
    ),
    query<{
      plan_date: string
      planned_workout: string
      readiness_level: string | null
    }>(
      `SELECT plan_date, planned_workout, readiness_level FROM daily_readiness
       WHERE user_id = $1 AND plan_date >= CURRENT_DATE AND plan_date < CURRENT_DATE + INTERVAL '7 days'
       ORDER BY plan_date ASC`,
      [userId]
    ),
  ])

  const levelColor = readiness?.readiness_level === 'prime'
    ? 'text-prime' : readiness?.readiness_level === 'moderate'
    ? 'text-moderate' : 'text-low'

  return (
    <div className="max-w-lg mx-auto space-y-6 py-6 px-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">{otherUser.name}s Übersicht</h1>
        <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-200">← Zurück</Link>
      </div>

      {/* Readiness */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-slate-200">Readiness heute</h2>
        {readiness ? (
          <>
            <div className={`text-5xl font-black ${levelColor}`}>{readiness.readiness_score}</div>
            <p className="text-sm text-slate-300">{readiness.recommendation}</p>
          </>
        ) : (
          <p className="text-sm text-slate-400">Noch keine Daten für heute.</p>
        )}
      </div>

      {/* Garmin Stats */}
      {todayMetrics && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Schlaf', value: todayMetrics.sleep_score, unit: '' },
            { label: 'Body Battery', value: todayMetrics.body_battery_most_recent, unit: '' },
            { label: 'Resting HR', value: todayMetrics.resting_heart_rate, unit: ' bpm' },
            { label: 'Schritte', value: todayMetrics.steps?.toLocaleString('de-DE'), unit: '' },
          ].map(stat => (
            <div key={stat.label} className="card-sm">
              <div className="stat-label">{stat.label}</div>
              <div className="text-xl font-bold text-slate-100 mt-1">
                {stat.value != null ? `${stat.value}${stat.unit}` : '–'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wochenplan */}
      {weekPlan.length > 0 && (
        <div className="card space-y-2">
          <h2 className="font-semibold text-slate-200">Kommende Trainings</h2>
          <div className="space-y-1.5">
            {weekPlan.map(day => (
              <div key={day.plan_date} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">
                  {new Date(day.plan_date).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <span className="text-slate-200">{day.planned_workout}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">Read-only Ansicht · Keine Bearbeitung möglich</p>
    </div>
  )
}
