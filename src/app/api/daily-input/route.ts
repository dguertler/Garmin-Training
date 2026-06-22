/**
 * POST /api/daily-input – Gewicht + KFA speichern, Makros sofort berechnen.
 * GET  /api/daily-input – Heutigen Eintrag + letzten 30 Tage (für Trend).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'
import { calcMacros, generateMealPlan, type Phase } from '@/lib/nutrition'


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { weight_kg, body_fat_pct, entry_date } = body

  if (!weight_kg || !body_fat_pct) {
    return NextResponse.json({ error: 'weight_kg und body_fat_pct erforderlich' }, { status: 400 })
  }

  const date = entry_date ?? new Date().toISOString().split('T')[0]

  // Tageseingabe speichern
  await query(
    `INSERT INTO daily_input (user_id, entry_date, weight_kg, body_fat_pct)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, entry_date) DO UPDATE
       SET weight_kg = $3, body_fat_pct = $4`,
    [userId, date, weight_kg, body_fat_pct]
  )

  // Profil aktualisieren
  await query(
    `UPDATE user_profiles SET weight_kg = $2, body_fat_pct = $3, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, weight_kg, body_fat_pct]
  )

  // Makros berechnen
  const profile = await queryOne<{
    current_phase: Phase
    tdee_kcal_current: number | null
    tdee_calibration_offset: number | null
  }>(
    'SELECT current_phase, tdee_kcal_current FROM user_profiles WHERE user_id = $1',
    [userId]
  )

  const garmin = await queryOne<{ calories_active: number | null }>(
    `SELECT calories_active FROM garmin_raw_metrics
     WHERE user_id = $1 AND metric_date = $2`,
    [userId, date]
  )

  // Wochentag → Trainingstag nach Skeleton
  const dow = new Date(date).getDay()
  const isTrainingDay = [1, 2, 3, 5, 6].includes(dow) // Mo,Di,Mi,Fr,Sa
  // Push (Mo) + Legs (Fr) = Refeed-Kandidaten
  const isRefeedDay = [1, 5].includes(dow)

  const macros = calcMacros({
    weightKg: weight_kg,
    bodyFatPct: body_fat_pct,
    activeCaloriesGarmin: garmin?.calories_active ?? 400,
    phase: profile?.current_phase ?? 'cut',
    isTrainingDay,
    isRefeedDay,
    tdeeAdjustmentKcal: 0,
  })

  const mealPlan = generateMealPlan(macros, isTrainingDay)

  // Nutrition targets upsert
  await query(
    `INSERT INTO nutrition_targets
       (user_id, target_date, weight_kg, lean_mass_kg, bmr_kcal,
        active_calories, tdee_kcal, phase, is_training_day, is_refeed_day,
        calories_target, protein_target_g, carbs_target_g, fat_target_g, meal_plan)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (user_id, target_date) DO UPDATE SET
       weight_kg = $3, lean_mass_kg = $4, bmr_kcal = $5,
       active_calories = $6, tdee_kcal = $7,
       calories_target = $11, protein_target_g = $12,
       carbs_target_g = $13, fat_target_g = $14,
       meal_plan = $15, updated_at = NOW()`,
    [
      userId, date,
      weight_kg, macros.leanMassKg, macros.bmrKcal,
      garmin?.calories_active ?? 400, macros.tdeeKcal,
      profile?.current_phase ?? 'cut', isTrainingDay, isRefeedDay,
      macros.caloriesTarget, macros.proteinG, macros.carbsG, macros.fatG,
      JSON.stringify(mealPlan),
    ]
  )

  return NextResponse.json({ ok: true, macros, mealPlan, date })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const [today, history] = await Promise.all([
    queryOne(
      `SELECT di.*, nt.calories_target, nt.protein_target_g, nt.carbs_target_g,
              nt.fat_target_g, nt.meal_plan, nt.tdee_kcal, nt.bmr_kcal, nt.lean_mass_kg
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
  ])

  return NextResponse.json({ today, history })
}
