/**
 * GET /api/dashboard – Alle Daten für das Haupt-Dashboard in einem Request.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { classifyReadiness, getReadinessColor, getScheduledWorkout, checkConcurrentTraining } from '@/lib/readiness'
import { calcWeightTrend } from '@/lib/nutrition'


export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]

  const [garmin, dailyInput, nutrition, readiness, syncStatus,
         sleep7, steps7, weightHistory, weekPlan, gear] = await Promise.all([

    // Heutige Garmin-Rohdaten
    queryOne(
      `SELECT training_readiness_score, training_readiness_factors,
              hrv_last_night, hrv_baseline_low, hrv_baseline_high, hrv_status,
              sleep_score, sleep_duration_seconds, sleep_deep_seconds,
              sleep_rem_seconds, sleep_light_seconds, sleep_awake_seconds,
              body_battery_morning, body_battery_evening, body_battery_curve,
              steps_total, steps_goal, calories_active, resting_heart_rate,
              training_status, vo2max, fitness_age, stress_average,
              respiration_average, spo2_average, lactate_threshold_hr,
              body_weight_garmin, body_fat_percent_garmin
       FROM garmin_raw_metrics WHERE user_id = $1 AND metric_date = $2`,
      [userId, today]
    ),

    // Heutige manuelle Eingabe
    queryOne(
      `SELECT weight_kg, body_fat_pct, lean_mass_kg, bmr_kcal
       FROM daily_input WHERE user_id = $1 AND entry_date = $2`,
      [userId, today]
    ),

    // Heutige Nutrition Targets
    queryOne(
      `SELECT calories_target, protein_target_g, carbs_target_g, fat_target_g,
              meal_plan, tdee_kcal, bmr_kcal, lean_mass_kg, is_training_day, is_refeed_day
       FROM nutrition_targets WHERE user_id = $1 AND target_date = $2`,
      [userId, today]
    ),

    // Heutige Readiness (aus Cache)
    queryOne(
      `SELECT readiness_score, readiness_level, scheduled_workout_type,
              recommended_workout_type, recommendation_reason, is_deload_week,
              hrv_vs_baseline_pct, sleep_score, body_battery_morning
       FROM daily_readiness WHERE user_id = $1 AND plan_date = $2`,
      [userId, today]
    ),

    // Letzter Sync-Status
    queryOne(
      `SELECT status, finished_at, endpoints_success, endpoints_total, error_details
       FROM sync_jobs WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [userId]
    ),

    // Schlaf letzte 7 Nächte
    query(
      `SELECT metric_date, sleep_score, sleep_duration_seconds,
              sleep_deep_seconds, sleep_rem_seconds, sleep_light_seconds
       FROM garmin_raw_metrics WHERE user_id = $1 AND metric_date <= $2
       ORDER BY metric_date DESC LIMIT 7`,
      [userId, today]
    ),

    // Schritte letzte 7 Tage (für NEAT-Trend)
    query(
      `SELECT metric_date, steps_total, steps_goal
       FROM garmin_raw_metrics WHERE user_id = $1 AND metric_date <= $2
       ORDER BY metric_date DESC LIMIT 7`,
      [userId, today]
    ),

    // Gewichtsverlauf 30 Tage (für Trend-Glättung)
    query<{ entry_date: string; weight_kg: number; body_fat_pct: number }>(
      `SELECT entry_date AS date, weight_kg, body_fat_pct
       FROM daily_input WHERE user_id = $1
       ORDER BY entry_date DESC LIMIT 30`,
      [userId]
    ),

    // Wochenplan (nächste 7 Tage)
    query(
      `SELECT plan_date, readiness_score, readiness_level, scheduled_workout_type,
              recommended_workout_type, recommendation_reason, workout_status, is_deload_week
       FROM daily_readiness WHERE user_id = $1
         AND plan_date BETWEEN $2 AND ($2::date + INTERVAL '6 days')::date
       ORDER BY plan_date`,
      [userId, today]
    ),

    // Gear-Warnungen (Schuhe > 550 km)
    query(
      `SELECT gear_name, distance_meters, max_distance_meters
       FROM garmin_gear WHERE user_id = $1 AND is_active = TRUE
         AND gear_type = 'shoes'
       ORDER BY distance_meters DESC`,
      [userId]
    ),
  ])

  // Wochenplan auffüllen (Tage ohne DB-Eintrag)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })
  const planMap = new Map((weekPlan as Array<{ plan_date: string }>).map(p => [
    new Date(p.plan_date).toISOString().split('T')[0], p
  ]))
  const fullWeekPlan = weekDays.map(d => planMap.get(d) ?? {
    plan_date: d,
    scheduled_workout_type: getScheduledWorkout(new Date(d)),
    workout_status: 'planned',
    readiness_level: 'unknown',
  })

  // 7-Tage-Mittel Schritte
  const stepsAvg7 = steps7.length
    ? Math.round((steps7 as Array<{ steps_total: number }>)
        .reduce((s, r) => s + (r.steps_total ?? 0), 0) / steps7.length)
    : null

  // NEAT-Baseline (Vormonat) für Warnsystem
  const neatBaseline = await queryOne<{ avg_daily_steps: number }>(
    `SELECT avg_daily_steps FROM neat_baselines
     WHERE user_id = $1 AND month_start < date_trunc('month', CURRENT_DATE)
     ORDER BY month_start DESC LIMIT 1`,
    [userId]
  )

  // Gewichts-Trend berechnen
  const weightForTrend = [...weightHistory].reverse().map(r => ({
    date: (r as { date: string }).date,
    weight: (r as { weight_kg: number }).weight_kg,
  }))
  const weightTrend = calcWeightTrend(weightForTrend)

  // Concurrent-Training-Prüfung
  const concurrentWarning = checkConcurrentTraining(
    fullWeekPlan.map(d => ({
      plan_date: (d as { plan_date: string }).plan_date,
      recommended_workout_type:
        (d as { recommended_workout_type?: string; scheduled_workout_type?: string })
          .recommended_workout_type
        ?? (d as { scheduled_workout_type?: string }).scheduled_workout_type
        ?? 'rest',
    }))
  )

  // Readiness-Score ableiten
  const readinessScore = (readiness as { readiness_score?: number } | null)?.readiness_score
    ?? (garmin as { training_readiness_score?: number } | null)?.training_readiness_score
    ?? null
  const readinessLevel = classifyReadiness(readinessScore)

  return NextResponse.json({
    today,
    readiness: {
      score: readinessScore,
      level: readinessLevel,
      color: getReadinessColor(readinessLevel),
      ...(readiness ?? {}),
    },
    garmin,
    body: dailyInput,
    nutrition,
    sleep7: [...sleep7].reverse(),
    steps: {
      today: (steps7[0] as { steps_total?: number } | undefined)?.steps_total ?? null,
      goal: (steps7[0] as { steps_goal?: number } | undefined)?.steps_goal ?? 8000,
      avg7: stepsAvg7,
      neat_baseline: neatBaseline?.avg_daily_steps ?? null,
      neat_warning: stepsAvg7 !== null && neatBaseline?.avg_daily_steps
        ? stepsAvg7 < neatBaseline.avg_daily_steps * 0.85
        : false,
    },
    weightTrend: weightTrend.slice(-14),
    weekPlan: fullWeekPlan,
    concurrent_warning: concurrentWarning.warning ? concurrentWarning.reason : null,
    syncStatus,
    gear: (gear as Array<{ distance_meters: number; max_distance_meters: number }>).map(g => ({
      ...g,
      distance_km: Math.round((g.distance_meters ?? 0) / 100) / 10,
      warning: g.distance_meters > g.max_distance_meters * 0.9,
    })),
  })
}
