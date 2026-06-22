/**
 * GET /api/trends – Langzeit-Trends: VO2max, Gewicht+KFA, resting HR,
 *                   Endurance/Hill Score, Race Predictions
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { calcWeightTrend } from '@/lib/nutrition'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    garminTrend,
    weightHistory,
    weeklyMetrics,
    racePredictions,
  ] = await Promise.all([
    // VO2max + resting HR letzte 90 Tage
    query<{
      metric_date: string
      vo2_max: number | null
      resting_heart_rate: number | null
      body_battery_charged: number | null
    }>(
      `SELECT metric_date, vo2_max, resting_heart_rate, body_battery_charged
       FROM garmin_raw_metrics
       WHERE user_id = $1 AND metric_date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY metric_date ASC`,
      [userId]
    ),
    // Gewicht + KFA letzte 90 Tage
    query<{
      entry_date: string
      weight_kg: number
      body_fat_pct: number | null
      lean_mass_kg: number | null
    }>(
      `SELECT entry_date, weight_kg, body_fat_pct, lean_mass_kg
       FROM daily_input
       WHERE user_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY entry_date ASC`,
      [userId]
    ),
    // Endurance Score + Hill Score (wöchentlich)
    query<{
      week_start: string
      endurance_score: number | null
      hill_score: number | null
      max_avg_power: number | null
    }>(
      `SELECT week_start, endurance_score, hill_score, max_avg_power
       FROM garmin_weekly_metrics
       WHERE user_id = $1 AND week_start >= CURRENT_DATE - INTERVAL '90 days'
       ORDER BY week_start ASC`,
      [userId]
    ),
    // Race Predictions (aktuellste pro Distanz)
    query<{
      distance_label: string
      predicted_time_seconds: number
      race_date: string
      vo2_max_estimate: number | null
    }>(
      `SELECT DISTINCT ON (distance_label)
              distance_label, predicted_time_seconds, race_date, vo2_max_estimate
       FROM garmin_race_predictions
       WHERE user_id = $1
       ORDER BY distance_label, race_date DESC`,
      [userId]
    ),
  ])

  // 7-Tage-Gewichtstrend berechnen
  const weightInputs = weightHistory.map(w => ({ date: w.entry_date, weight: w.weight_kg }))
  const trendPoints = calcWeightTrend(weightInputs)
  const weightWithTrend = weightHistory.map((w, i) => ({
    ...w,
    trend_kg: trendPoints[i].trend,
  }))

  // Aktuelle Werte
  const latest = garminTrend.length > 0 ? garminTrend[garminTrend.length - 1] : null
  const latestWeight = weightWithTrend.length > 0 ? weightWithTrend[weightWithTrend.length - 1] : null
  const latestWeekly = weeklyMetrics.length > 0 ? weeklyMetrics[weeklyMetrics.length - 1] : null

  // VO2max-Trend (4-Wochen-Vergleich)
  const vo2Vals = garminTrend.filter(g => g.vo2_max !== null).map(g => g.vo2_max as number)
  const vo2Current = vo2Vals.length > 0 ? vo2Vals[vo2Vals.length - 1] : null
  const vo2FourWeeksAgo = vo2Vals.length >= 4 ? vo2Vals[vo2Vals.length - 4] : null
  const vo2Delta = vo2Current !== null && vo2FourWeeksAgo !== null
    ? Math.round((vo2Current - vo2FourWeeksAgo) * 10) / 10
    : null

  return NextResponse.json({
    garmin_trend: garminTrend,
    weight_trend: weightWithTrend,
    weekly_metrics: weeklyMetrics,
    race_predictions: racePredictions,
    summary: {
      vo2_max_current: latest?.vo2_max ?? null,
      vo2_max_delta_4w: vo2Delta,
      resting_hr_current: latest?.resting_heart_rate ?? null,
      weight_current: latestWeight?.weight_kg ?? null,
      weight_trend_7d: latestWeight?.trend_kg ?? null,
      body_fat_current: latestWeight?.body_fat_pct ?? null,
      lean_mass_current: latestWeight?.lean_mass_kg ?? null,
      endurance_score: latestWeekly?.endurance_score ?? null,
      hill_score: latestWeekly?.hill_score ?? null,
    },
  })
}
