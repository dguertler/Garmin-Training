/**
 * GET  /api/calibration – Status der TDEE-Selbstkalibrierung
 * POST /api/calibration – Kalibrierung manuell auslösen
 *
 * Logik: Vergleich 7-Tage-Mittel Woche 1 vs. Woche 2 (letzte 14 Tage).
 * Abweichung >100g → TDEE nachjustieren, in user_profiles + tdee_calibrations speichern.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { calibrateTDEE } from '@/lib/nutrition'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, lastCal, entries] = await Promise.all([
    queryOne<{
      tdee_kcal_current: number | null
      tdee_last_calibrated_at: string | null
      current_phase: string
    }>(
      'SELECT tdee_kcal_current, tdee_last_calibrated_at, current_phase FROM user_profiles WHERE user_id = $1',
      [userId]
    ),
    queryOne(
      'SELECT * FROM tdee_calibrations WHERE user_id = $1 ORDER BY calibration_date DESC LIMIT 1',
      [userId]
    ),
    query<{ entry_date: string; weight_kg: number }>(
      `SELECT entry_date, weight_kg FROM daily_input
       WHERE user_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY entry_date ASC`,
      [userId]
    ),
  ])

  const readyForCalibration = entries.length >= 14
  const week1 = entries.slice(0, 7)
  const week2 = entries.slice(7, 14)
  const avg1 = week1.length ? week1.reduce((s, e) => s + e.weight_kg, 0) / week1.length : null
  const avg2 = week2.length ? week2.reduce((s, e) => s + e.weight_kg, 0) / week2.length : null

  return NextResponse.json({
    ready: readyForCalibration,
    entries_logged: entries.length,
    entries_needed: Math.max(0, 14 - entries.length),
    current_tdee: profile?.tdee_kcal_current ?? null,
    last_calibrated: profile?.tdee_last_calibrated_at ?? null,
    last_calibration: lastCal,
    preview: avg1 && avg2 ? {
      weight_avg_week1: Math.round(avg1 * 100) / 100,
      weight_avg_week2: Math.round(avg2 * 100) / 100,
      delta_kg: Math.round((avg2 - avg1) * 1000) / 1000,
    } : null,
  })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, entries, nutrition14] = await Promise.all([
    queryOne<{
      tdee_kcal_current: number | null
      current_phase: string
    }>(
      'SELECT tdee_kcal_current, current_phase FROM user_profiles WHERE user_id = $1',
      [userId]
    ),
    query<{ entry_date: string; weight_kg: number }>(
      `SELECT entry_date, weight_kg FROM daily_input
       WHERE user_id = $1 AND entry_date >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY entry_date ASC`,
      [userId]
    ),
    queryOne<{ avg_calories: number }>(
      `SELECT ROUND(AVG(calories_target)) AS avg_calories FROM nutrition_targets
       WHERE user_id = $1 AND target_date >= CURRENT_DATE - INTERVAL '14 days'`,
      [userId]
    ),
  ])

  if (entries.length < 14) {
    return NextResponse.json({
      error: `Noch ${14 - entries.length} Tage Daten fehlen für Kalibrierung.`,
    }, { status: 422 })
  }

  const week1 = entries.slice(0, 7)
  const week2 = entries.slice(7, 14)
  const avg1 = week1.reduce((s, e) => s + e.weight_kg, 0) / 7
  const avg2 = week2.reduce((s, e) => s + e.weight_kg, 0) / 7

  const currentTDEE = profile?.tdee_kcal_current ?? 2900
  const targetCals = nutrition14?.avg_calories ?? currentTDEE * 0.8

  const result = calibrateTDEE(avg1, avg2, currentTDEE, targetCals)

  // Nur anpassen wenn Abweichung > 100 kcal/Tag
  if (Math.abs(result.adjustment) < 100) {
    return NextResponse.json({
      adjusted: false,
      message: 'Abweichung unter 100 kcal/Tag – kein Anpassungsbedarf.',
      ...result,
    })
  }

  // TDEE updaten
  await query(
    `UPDATE user_profiles
       SET tdee_kcal_current = $2, tdee_last_calibrated_at = CURRENT_DATE, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, result.newTDEE]
  )

  // Kalibrierung protokollieren
  await query(
    `INSERT INTO tdee_calibrations
       (user_id, calibration_date, weight_avg_week1, weight_avg_week2,
        actual_delta_kg, expected_delta_kg, tdee_adjustment_kcal, new_tdee_kcal)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      Math.round(avg1 * 100) / 100,
      Math.round(avg2 * 100) / 100,
      Math.round((avg2 - avg1) * 1000) / 1000,
      Math.round(((targetCals - currentTDEE) * 14) / 7700 * 1000) / 1000,
      result.adjustment,
      result.newTDEE,
    ]
  )

  return NextResponse.json({
    adjusted: true,
    old_tdee: currentTDEE,
    new_tdee: result.newTDEE,
    adjustment: result.adjustment,
    explanation: result.explanation,
  })
}
