/**
 * GET /api/readiness – Heutige Readiness + Trainingsempfehlung + 30-Tage-Verlauf
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import {
  classifyReadiness,
  getReadinessColor,
  getScheduledWorkout,
  getRecommendedWorkout,
  buildRecommendationReason,
  shouldTriggerDeload,
} from '@/lib/readiness'
import { sendDeloadNotification } from '@/lib/push'


export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const [raw, profile, history30, recentScores, dailyInput] = await Promise.all([
    queryOne<{
      training_readiness_score: number | null
      training_readiness_factors: Record<string, unknown> | null
      hrv_last_night: number | null
      hrv_baseline_low: number | null
      hrv_baseline_high: number | null
      hrv_status: string | null
      sleep_score: number | null
      sleep_duration_seconds: number | null
      body_battery_morning: number | null
      training_status: string | null
      vo2max: number | null
      resting_heart_rate: number | null
    }>(
      `SELECT training_readiness_score, training_readiness_factors,
              hrv_last_night, hrv_baseline_low, hrv_baseline_high, hrv_status,
              sleep_score, sleep_duration_seconds, body_battery_morning,
              training_status, vo2max, resting_heart_rate
       FROM garmin_raw_metrics
       WHERE user_id = $1 AND metric_date = $2`,
      [userId, date]
    ),
    queryOne<{ current_phase: string; weeks_since_deload: number; hrv_baseline_established: boolean; sex: string | null }>(
      'SELECT current_phase, weeks_since_deload, hrv_baseline_established, sex FROM user_profiles WHERE user_id = $1',
      [userId]
    ),
    query<{ metric_date: string; training_readiness_score: number | null }>(
      `SELECT metric_date, training_readiness_score
       FROM garmin_raw_metrics WHERE user_id = $1 AND metric_date <= $2
       ORDER BY metric_date DESC LIMIT 30`,
      [userId, date]
    ),
    query<{ training_readiness_score: number | null }>(
      `SELECT training_readiness_score FROM garmin_raw_metrics
       WHERE user_id = $1 AND metric_date <= $2
       ORDER BY metric_date DESC LIMIT 3`,
      [userId, date]
    ),
    queryOne<{ alcohol_units: number | null }>(
      `SELECT alcohol_units FROM daily_input WHERE user_id = $1 AND entry_date = $2`,
      [userId, date]
    ),
  ])

  const score = raw?.training_readiness_score ?? null
  const level = classifyReadiness(score)
  const color = getReadinessColor(level)
  const currentPhase = profile?.current_phase ?? 'cut'
  const scheduled = getScheduledWorkout(new Date(date), currentPhase)
  const sleepHours = raw?.sleep_duration_seconds ? raw.sleep_duration_seconds / 3600 : null
  const { workout: recommended, reason } = getRecommendedWorkout(scheduled, level, sleepHours, currentPhase)

  // HRV vs Baseline %
  let hrvVsBaselinePct: number | null = null
  if (raw?.hrv_last_night && raw?.hrv_baseline_low && raw?.hrv_baseline_high) {
    const baseline = (raw.hrv_baseline_low + raw.hrv_baseline_high) / 2
    hrvVsBaselinePct = Math.round(((raw.hrv_last_night - baseline) / baseline) * 100)
  }

  const factors = {
    hrv_vs_baseline_pct: hrvVsBaselinePct,
    sleep_score: raw?.sleep_score ?? null,
    body_battery_morning: raw?.body_battery_morning ?? null,
    hrv_status: raw?.hrv_status ?? null,
    training_status: raw?.training_status ?? null,
  }

  const factorReason = buildRecommendationReason({
    readiness_score: score,
    ...factors,
    recovery_time_hours: null,
    stress_yesterday: null,
  })

  const deloadCheck = shouldTriggerDeload(
    recentScores.map(r => r.training_readiness_score),
    profile?.weeks_since_deload ?? 0,
    currentPhase
  )

  // Deload-Push (fire-and-forget, nur heute und wenn Warnung aktiv)
  if (deloadCheck.trigger) {
    sendDeloadNotification(userId, deloadCheck.reason).catch(() => {})
  }

  // Readiness in DB cachen
  await query(
    `INSERT INTO daily_readiness
       (user_id, plan_date, readiness_score, readiness_level,
        scheduled_workout_type, recommended_workout_type, recommendation_reason,
        hrv_vs_baseline_pct, sleep_score, body_battery_morning)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (user_id, plan_date) DO UPDATE SET
       readiness_score = $3, readiness_level = $4,
       recommended_workout_type = $6, recommendation_reason = $7,
       hrv_vs_baseline_pct = $8, sleep_score = $9,
       body_battery_morning = $10, updated_at = NOW()`,
    [
      userId, date, score, level, scheduled, recommended,
      factorReason, hrvVsBaselinePct,
      raw?.sleep_score ?? null, raw?.body_battery_morning ?? null,
    ]
  )

  return NextResponse.json({
    date,
    score,
    level,
    color,
    scheduled_workout: scheduled,
    recommended_workout: recommended,
    reason: factorReason,
    factors,
    hrv: {
      last_night: raw?.hrv_last_night ?? null,
      baseline_low: raw?.hrv_baseline_low ?? null,
      baseline_high: raw?.hrv_baseline_high ?? null,
      status: raw?.hrv_status ?? null,
      established: profile?.hrv_baseline_established ?? false,
    },
    sleep: {
      score: raw?.sleep_score ?? null,
      hours: sleepHours ? Math.round(sleepHours * 10) / 10 : null,
    },
    body_battery_morning: raw?.body_battery_morning ?? null,
    vo2max: raw?.vo2max ?? null,
    resting_hr: raw?.resting_heart_rate ?? null,
    deload_warning: deloadCheck.trigger ? deloadCheck.reason : null,
    alcohol_warning: (dailyInput?.alcohol_units ?? 0) > 0 && score !== null && score < 60
      ? `${dailyInput!.alcohol_units} Alkohol-Einheit${(dailyInput!.alcohol_units ?? 0) > 1 ? 'en' : ''} gestern – Readiness reduziert`
      : null,
    trend: history30.map(r => ({
      date: r.metric_date,
      score: r.training_readiness_score,
      level: classifyReadiness(r.training_readiness_score),
      color: getReadinessColor(classifyReadiness(r.training_readiness_score)),
    })).reverse(),
  })
}
