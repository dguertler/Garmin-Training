/**
 * GET  /api/deload – Deload-Status, Countdown, Trigger-Check
 * POST /api/deload – Deload-Woche manuell starten
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { shouldTriggerDeload } from '@/lib/readiness'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, recentScores, currentDeload, deloadHistory] = await Promise.all([
    queryOne<{
      weeks_since_deload: number
      last_deload_date: string | null
      next_deload_planned: string | null
    }>(
      'SELECT weeks_since_deload, last_deload_date, next_deload_planned FROM user_profiles WHERE user_id = $1',
      [userId]
    ),
    query<{ training_readiness_score: number | null; metric_date: string }>(
      `SELECT training_readiness_score, metric_date FROM garmin_raw_metrics
       WHERE user_id = $1 ORDER BY metric_date DESC LIMIT 7`,
      [userId]
    ),
    queryOne<{ week_start_date: string; trigger_reason: string }>(
      `SELECT week_start_date, trigger_reason FROM deload_weeks
       WHERE user_id = $1 AND week_start_date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY week_start_date DESC LIMIT 1`,
      [userId]
    ),
    query(
      `SELECT week_start_date, trigger_reason FROM deload_weeks
       WHERE user_id = $1 ORDER BY week_start_date DESC LIMIT 5`,
      [userId]
    ),
  ])

  const weeksSince = profile?.weeks_since_deload ?? 0
  const scores = recentScores.map(r => r.training_readiness_score)
  const deloadCheck = shouldTriggerDeload(scores, weeksSince)

  // Countdown: nächster Deload
  const weeksUntilPlanned = Math.max(0, 6 - weeksSince)
  const nextDeloadDate = profile?.next_deload_planned
    ?? (() => {
      const d = new Date()
      d.setDate(d.getDate() + weeksUntilPlanned * 7)
      return d.toISOString().split('T')[0]
    })()

  // Anhaltend niedrige Readiness: 5+ Tage < 50
  const lowDays = scores.filter(s => s !== null && s < 50).length
  const sustainedLowReadiness = lowDays >= 5

  return NextResponse.json({
    is_deload_week: !!currentDeload,
    current_deload: currentDeload,
    weeks_since_deload: weeksSince,
    last_deload_date: profile?.last_deload_date ?? null,
    next_deload_planned: nextDeloadDate,
    weeks_until_deload: weeksUntilPlanned,
    should_trigger: deloadCheck.trigger,
    trigger_reason: deloadCheck.reason,
    sustained_low_readiness: sustainedLowReadiness,
    low_readiness_days: lowDays,
    recent_scores: recentScores.map(r => ({
      date: r.metric_date,
      score: r.training_readiness_score,
    })),
    history: deloadHistory,
  })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]
  // Montag der aktuellen Woche
  const d = new Date()
  d.setDate(d.getDate() - d.getDay() + 1)
  const weekStart = d.toISOString().split('T')[0]

  // Deload-Woche anlegen
  await query(
    `INSERT INTO deload_weeks (user_id, week_start_date, trigger_reason)
     VALUES ($1, $2, 'manual')
     ON CONFLICT DO NOTHING`,
    [userId, weekStart]
  )

  // Alle daily_readiness Einträge dieser Woche als Deload markieren
  await query(
    `UPDATE daily_readiness
       SET is_deload_week = TRUE, updated_at = NOW()
     WHERE user_id = $1 AND plan_date >= $2 AND plan_date < ($2::date + INTERVAL '7 days')::date`,
    [userId, weekStart]
  )

  // Profil: last_deload_date + weeks_since_deload zurücksetzen
  await query(
    `UPDATE user_profiles
       SET last_deload_date = $2, weeks_since_deload = 0,
           next_deload_planned = ($2::date + INTERVAL '5 weeks')::date,
           updated_at = NOW()
     WHERE user_id = $1`,
    [userId, today]
  )

  return NextResponse.json({ ok: true, week_start: weekStart })
}
