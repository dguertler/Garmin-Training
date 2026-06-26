/**
 * POST /api/daily-input – Gewicht + KFA speichern, Makros sofort berechnen.
 * GET  /api/daily-input – Heutigen Eintrag + letzten 30 Tage (für Trend).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { recomputeDailyTargets } from '@/lib/nutritionEngine'
import { maybeAutoCalibrate } from '@/lib/tdeeCalibration'


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { weight_kg, body_fat_pct, entry_date, alcohol_units, training_time, workout_type } = body

  if (!weight_kg || !body_fat_pct) {
    return NextResponse.json({ error: 'weight_kg und body_fat_pct erforderlich' }, { status: 400 })
  }

  const date = entry_date ?? new Date().toISOString().split('T')[0]

  // Tageseingabe speichern (training_time/workout_type optional als Tages-Override)
  await query(
    `INSERT INTO daily_input (user_id, entry_date, weight_kg, body_fat_pct, alcohol_units, training_time, workout_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, entry_date) DO UPDATE
       SET weight_kg = $3, body_fat_pct = $4, alcohol_units = $5,
           training_time = COALESCE($6, daily_input.training_time),
           workout_type  = COALESCE($7, daily_input.workout_type)`,
    [userId, date, weight_kg, body_fat_pct, alcohol_units ?? 0, training_time ?? null, workout_type ?? null]
  )

  // Profil aktualisieren
  await query(
    `UPDATE user_profiles SET weight_kg = $2, body_fat_pct = $3, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, weight_kg, body_fat_pct]
  )

  // Rollende Auto-Kalibrierung (max. 1×/Woche) – passt tdee_kcal_current an,
  // bevor die Tagesziele daraus berechnet werden.
  await maybeAutoCalibrate(userId)

  // Ziele + Mahlzeitenplan (zeit-/preset-abhängig) berechnen
  await recomputeDailyTargets(userId, date)

  return NextResponse.json({ ok: true, date })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const [today, history, profile] = await Promise.all([
    queryOne(
      `SELECT di.entry_date, di.weight_kg, di.body_fat_pct, di.lean_mass_kg, di.bmr_kcal,
              di.notes, di.alcohol_units,
              nt.calories_target, nt.protein_target_g, nt.carbs_target_g,
              nt.fat_target_g, nt.meal_plan, nt.tdee_kcal, nt.is_training_day, nt.is_refeed_day,
              nt.training_time::text AS training_time, nt.workout_type
       FROM daily_input di
       LEFT JOIN nutrition_targets nt ON nt.user_id = di.user_id AND nt.target_date = di.entry_date
       WHERE di.user_id = $1 AND di.entry_date = $2`,
      [userId, date]
    ),
    query(
      `SELECT entry_date, weight_kg, body_fat_pct, lean_mass_kg
       FROM daily_input WHERE user_id = $1
       ORDER BY entry_date DESC LIMIT 30`,
      [userId]
    ),
    queryOne(
      `SELECT current_phase, phase_preset FROM user_profiles WHERE user_id = $1`,
      [userId]
    ),
  ])

  return NextResponse.json({ today, history, profile })
}
