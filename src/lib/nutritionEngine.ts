/**
 * Server-seitige (Neu-)Berechnung der Tages-Ernährungsziele.
 *
 * Wird aufgerufen von:
 *  - POST /api/daily-input  (Gewicht/KFA neu eingegeben)
 *  - PUT  /api/training-schedule (Trainingszeiten geändert → Meal-Timing neu)
 *
 * Liest Gewicht/KFA, Profil (Preset + Wochenplan), Garmin-Aktivkalorien und
 * die effektive Trainingszeit (Tages-Override > Wochenplan) und schreibt
 * nutrition_targets inkl. zeitlich angepasstem Mahlzeitenplan.
 */
import { query, queryOne } from '@/lib/db'
import { calcMacros, generateMealPlan } from '@/lib/nutrition'
import { getPhasePreset, type Phase } from '@/lib/phases'

export interface ScheduleEntry { time?: string | null; type?: string | null }
export type WeeklySchedule = Record<string, ScheduleEntry>

/** Klassischer Wochenskelett-Fallback (Mo,Di,Mi,Fr,Sa Training). */
function skeletonTrainingDay(dow: number): boolean {
  return [1, 2, 3, 5, 6].includes(dow)
}
function skeletonRefeedDay(dow: number): boolean {
  return [1, 5].includes(dow) // Push (Mo) + Legs (Fr)
}

const NON_TRAINING_TYPES = new Set(['rest', 'mobility', 'mobilität', 'off'])

/**
 * Ermittelt Trainingstag-Status, Refeed und effektive Trainingszeit für ein Datum.
 */
export function resolveTrainingDay(
  date: string,
  schedule: WeeklySchedule | null,
  override: ScheduleEntry | null,
): { isTrainingDay: boolean; isRefeedDay: boolean; trainingTime: string | null; workoutType: string | null } {
  const dow = new Date(date + 'T00:00:00').getDay()
  const planned = schedule?.[String(dow)] ?? null

  // Effektive Zeit/Typ: Tages-Override schlägt Wochenplan
  const trainingTime = override?.time ?? planned?.time ?? null
  const workoutType = override?.type ?? planned?.type ?? null

  let isTrainingDay: boolean
  let isRefeedDay: boolean

  if (schedule && Object.keys(schedule).length > 0) {
    // Wochenplan vorhanden → daraus ableiten
    const type = (workoutType ?? '').toLowerCase()
    isTrainingDay = !!planned && type !== '' && !NON_TRAINING_TYPES.has(type)
    if (override?.time && override?.type) {
      isTrainingDay = !NON_TRAINING_TYPES.has((override.type ?? '').toLowerCase())
    }
    isRefeedDay = type === 'refeed' || type === 'legs' || (skeletonRefeedDay(dow) && isTrainingDay)
  } else {
    isTrainingDay = skeletonTrainingDay(dow)
    isRefeedDay = skeletonRefeedDay(dow)
  }

  return { isTrainingDay, isRefeedDay, trainingTime, workoutType }
}

export async function recomputeDailyTargets(userId: string, date: string): Promise<boolean> {
  const input = await queryOne<{ weight_kg: number; body_fat_pct: number; training_time: string | null; workout_type: string | null }>(
    `SELECT weight_kg, body_fat_pct, training_time::text AS training_time, workout_type
     FROM daily_input WHERE user_id = $1 AND entry_date = $2`,
    [userId, date]
  )
  if (!input) return false // ohne Gewichtseingabe keine Ziele

  const profile = await queryOne<{
    current_phase: Phase
    phase_preset: string | null
    weekly_training_schedule: WeeklySchedule | null
    tdee_kcal_current: number | null
  }>(
    `SELECT current_phase, phase_preset, weekly_training_schedule, tdee_kcal_current
     FROM user_profiles WHERE user_id = $1`,
    [userId]
  )

  const garmin = await queryOne<{ calories_active: number | null }>(
    `SELECT calories_active FROM garmin_raw_metrics WHERE user_id = $1 AND metric_date = $2`,
    [userId, date]
  )

  const override: ScheduleEntry | null = input.training_time
    ? { time: input.training_time.slice(0, 5), type: input.workout_type }
    : input.workout_type ? { type: input.workout_type } : null

  const { isTrainingDay, isRefeedDay, trainingTime, workoutType } = resolveTrainingDay(
    date,
    profile?.weekly_training_schedule ?? null,
    override,
  )

  const preset = getPhasePreset(profile?.phase_preset, profile?.current_phase ?? 'cut')

  const macros = calcMacros({
    weightKg: input.weight_kg,
    bodyFatPct: input.body_fat_pct,
    activeCaloriesGarmin: garmin?.calories_active ?? 400,
    phase: preset.phase,
    phasePreset: preset.key,
    isTrainingDay,
    isRefeedDay,
    tdeeAdjustmentKcal: 0,
  })

  const mealPlan = generateMealPlan(macros, {
    isTrainingDay,
    trainingTime: trainingTime,
  })

  const cleanTime = trainingTime ? trainingTime.slice(0, 5) : null

  await query(
    `INSERT INTO nutrition_targets
       (user_id, target_date, weight_kg, lean_mass_kg, bmr_kcal,
        active_calories, tdee_kcal, phase, is_training_day, is_refeed_day,
        calories_target, protein_target_g, carbs_target_g, fat_target_g, meal_plan,
        training_time, workout_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (user_id, target_date) DO UPDATE SET
       weight_kg = $3, lean_mass_kg = $4, bmr_kcal = $5,
       active_calories = $6, tdee_kcal = $7, phase = $8,
       is_training_day = $9, is_refeed_day = $10,
       calories_target = $11, protein_target_g = $12,
       carbs_target_g = $13, fat_target_g = $14,
       meal_plan = $15, training_time = $16, workout_type = $17, updated_at = NOW()`,
    [
      userId, date,
      input.weight_kg, macros.leanMassKg, macros.bmrKcal,
      garmin?.calories_active ?? 400, macros.tdeeKcal,
      preset.phase, isTrainingDay, isRefeedDay,
      macros.caloriesTarget, macros.proteinG, macros.carbsG, macros.fatG,
      JSON.stringify(mealPlan),
      cleanTime, workoutType,
    ]
  )

  return true
}
