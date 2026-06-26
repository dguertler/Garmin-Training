import { getPhasePreset, type Phase } from './phases'
export type { Phase } from './phases'

export interface DailyNutritionInput {
  weightKg: number
  bodyFatPct: number
  activeCaloriesGarmin: number  // aus Garmin, wird korrigiert
  phase: Phase
  /** Preset-Key (z.B. 'cut_aggressive'). Steuert Kaloriendelta + Protein/Fett-Floor. */
  phasePreset?: string | null
  isTrainingDay: boolean
  isRefeedDay: boolean
  /** true nur an echten Kraft-Tagen → Garmin-Aktivkalorien werden korrigiert (Lauf bleibt voll) */
  isStrengthDay?: boolean
  /**
   * Empirisch kalibrierter TDEE (kcal) aus der Energiebilanz-Methode.
   * Wenn gesetzt, ersetzt er die Garmin-Schätzung als Erhaltungs-Anker (Ground Truth).
   */
  empiricalTdee?: number | null
  tdeeAdjustmentKcal?: number   // Legacy-Offset (wird nur ohne empiricalTdee genutzt)
}

/** 1 kg Körpergewicht ≈ 7700 kcal (Energiedichte gemischtes Körpergewebe). */
export const KCAL_PER_KG = 7700

export interface MacroTargets {
  caloriesTarget: number
  proteinG: number
  carbsG: number
  fatG: number
  leanMassKg: number
  bmrKcal: number
  tdeeKcal: number
}

export interface MealPlanEntry {
  mealNumber: 1 | 2 | 3 | 4 | 5
  timeLabel: string
  slot: 'breakfast' | 'lunch' | 'pre_workout' | 'dinner' | 'pre_sleep'
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  name: string
  notes?: string
}

// Katch-McArdle BMR
export function calcBMR(weightKg: number, bodyFatPct: number): number {
  const leanMassKg = weightKg * (1 - bodyFatPct / 100)
  return Math.round(370 + 21.6 * leanMassKg)
}

export function calcLeanMass(weightKg: number, bodyFatPct: number): number {
  return weightKg * (1 - bodyFatPct / 100)
}

// Garmin überschätzt Krafttraining-Kalorien → 0,75-Faktor
// Für Lauf/Zone2 normale Schätzung beibehalten (Garmin dort verlässlicher)
export function correctActiveCalories(rawCalories: number, isStrengthDay: boolean): number {
  if (isStrengthDay) return Math.round(rawCalories * 0.75)
  return rawCalories
}

export function calcMacros(input: DailyNutritionInput): MacroTargets {
  const leanMassKg = calcLeanMass(input.weightKg, input.bodyFatPct)
  const bmrKcal = Math.round(370 + 21.6 * leanMassKg)

  // Garmin-Schätzung (Seed): 0,75-Korrektur nur an echten Kraft-Tagen, Lauf bleibt voll
  const correctedActive = correctActiveCalories(
    input.activeCaloriesGarmin,
    input.isStrengthDay ?? false,
  )
  const estimateTdee = bmrKcal + correctedActive + (input.tdeeAdjustmentKcal ?? 0)

  // Wenn empirisch kalibriert → echten TDEE als Erhaltungs-Anker nutzen (Ground Truth),
  // sonst die Garmin-Schätzung als Startwert.
  const tdeeKcal = input.empiricalTdee && input.empiricalTdee > 0
    ? Math.round(input.empiricalTdee)
    : estimateTdee

  // Preset bestimmt absolutes Kaloriendelta + Protein/Fett-Floor
  const preset = getPhasePreset(input.phasePreset, input.phase)

  // Zielkalorien = TDEE + Delta, nie unter Grundumsatz (Hormon-/Muskelschutz)
  let caloriesTarget = Math.round(tdeeKcal + preset.deltaKcal)
  caloriesTarget = Math.max(caloriesTarget, bmrKcal)

  // Protein: aus Preset (g/kg Körpergewicht) – höher bei aggressivem Defizit
  const proteinG = Math.round(preset.proteinPerKg * input.weightKg)
  const proteinKcal = proteinG * 4

  // Fett: 22% der Gesamtkalorien, aber mindestens Preset-Floor (Hormon-Schutz)
  const fatFloorG = Math.round(preset.minFatPerKg * input.weightKg)
  let fatG = Math.max(Math.round((caloriesTarget * 0.22) / 9), fatFloorG)
  const fatKcal = fatG * 9

  // Carb-Cycling anwenden
  let carbAdjust = 0
  if (input.isRefeedDay) carbAdjust = 50   // Refeed: +40-60g (Mitte 50)
  if (!input.isTrainingDay) carbAdjust = -70 // Ruhetag: −60-80g (Mitte 70)

  const carbsKcal = caloriesTarget - proteinKcal - fatKcal
  let carbsG = Math.round(carbsKcal / 4) + carbAdjust

  // Kalorien nach Carb-Cycling-Anpassung korrigieren
  const adjustedCalories = caloriesTarget + carbAdjust * 4
  // Fett leicht erhöhen an Ruhetagen
  if (!input.isTrainingDay) fatG = Math.round(fatG * 1.1)

  return {
    caloriesTarget: adjustedCalories,
    proteinG,
    carbsG: Math.max(carbsG, 50),  // Minimum 50g Carbs
    fatG,
    leanMassKg: Math.round(leanMassKg * 10) / 10,
    bmrKcal,
    tdeeKcal: Math.round(tdeeKcal),
  }
}

// ---- Zeit-Helfer -------------------------------------------------------------
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
function toHHMM(min: number): string {
  const clamped = ((Math.round(min) % 1440) + 1440) % 1440
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export interface MealPlanOptions {
  isTrainingDay: boolean
  /** geplante Trainingszeit 'HH:MM' – verschiebt Pre-/Post-Workout-Mahlzeiten */
  trainingTime?: string | null
  /** Aufstehzeit 'HH:MM', Default 07:00 */
  wakeTime?: string
}

/**
 * Verteilt die fünf Mahlzeiten zeitlich. An Trainingstagen mit gesetzter
 * Trainingszeit werden Pre-/Post-Workout-Mahlzeit um die Einheit gelegt:
 *  - Pre-Workout ~75 min davor: schnelle Carbs, kein Fett (Verdauung).
 *  - Post-Workout ~60 min danach: größter Carb-Block (Glykogen) + Protein.
 * Ohne Trainingszeit gilt die bewährte Standardverteilung.
 */
function mealTimes(opts: MealPlanOptions): Record<MealPlanEntry['slot'], string> {
  const wake = toMin(opts.wakeTime ?? '07:00')
  const bedish = wake + 15.5 * 60  // ~22:30 bei 07:00

  if (opts.isTrainingDay && opts.trainingTime) {
    const train = toMin(opts.trainingTime)
    let pre = train - 75
    let post = train + 60
    // Pre-Workout nicht vor dem Aufstehen
    pre = Math.max(pre, wake + 30)
    const breakfast = wake
    // Mittagessen zwischen Frühstück und Pre-Workout platzieren
    let lunch = Math.round((breakfast + pre) / 2)
    lunch = Math.min(Math.max(lunch, breakfast + 180), pre - 90)
    if (lunch <= breakfast + 60) lunch = breakfast + 210  // Fallback bei frühem Training
    const preSleep = Math.max(post + 120, bedish, wake + 14 * 60)
    return {
      breakfast: toHHMM(breakfast),
      lunch: toHHMM(lunch),
      pre_workout: toHHMM(pre),
      dinner: toHHMM(post),
      pre_sleep: toHHMM(preSleep),
    }
  }

  // Standard (kein Training oder keine Zeit gesetzt)
  return {
    breakfast: toHHMM(wake),
    lunch: toHHMM(wake + 5 * 60),
    pre_workout: toHHMM(wake + 9 * 60),
    dinner: toHHMM(wake + 12.5 * 60),
    pre_sleep: toHHMM(bedish),
  }
}

/**
 * Mahlzeitenplan generieren. Zweite Signatur akzeptiert entweder ein
 * Options-Objekt (mit Trainingszeit) oder – abwärtskompatibel – ein boolean.
 */
export function generateMealPlan(
  macros: MacroTargets,
  optsOrTraining: MealPlanOptions | boolean,
): MealPlanEntry[] {
  const opts: MealPlanOptions =
    typeof optsOrTraining === 'boolean' ? { isTrainingDay: optsOrTraining } : optsOrTraining
  const { caloriesTarget, proteinG, carbsG, fatG } = macros
  const times = mealTimes(opts)

  if (opts.isTrainingDay) {
    const scale = caloriesTarget / 2515
    return [
      {
        mealNumber: 1, timeLabel: times.breakfast, slot: 'breakfast',
        kcal: Math.round(500 * scale), proteinG: Math.round(proteinG * 0.213),
        carbsG: Math.round(carbsG * 0.165), fatG: Math.round(fatG * 0.25),
        name: 'Frühstück',
      },
      {
        mealNumber: 2, timeLabel: times.lunch, slot: 'lunch',
        kcal: Math.round(535 * scale), proteinG: Math.round(proteinG * 0.214),
        carbsG: Math.round(carbsG * 0.196), fatG: Math.round(fatG * 0.25),
        name: 'Mittagessen',
      },
      {
        mealNumber: 3, timeLabel: times.pre_workout, slot: 'pre_workout',
        kcal: Math.round(400 * scale), proteinG: Math.round(proteinG * 0.167),
        carbsG: Math.round(carbsG * 0.239), fatG: Math.round(fatG * 0.056),
        name: 'Pre-Workout', notes: 'Schnelle Carbs, kein Fett – verlangsamt Verdauung',
      },
      {
        mealNumber: 4, timeLabel: times.dinner, slot: 'dinner',
        kcal: Math.round(640 * scale), proteinG: Math.round(proteinG * 0.238),
        carbsG: Math.round(carbsG * 0.326), fatG: Math.round(fatG * 0.194),
        name: 'Post-Workout / Abendessen', notes: 'Größter Carb-Block – Glykogen-Resynthese',
      },
      {
        mealNumber: 5, timeLabel: times.pre_sleep, slot: 'pre_sleep',
        kcal: Math.round(440 * scale), proteinG: Math.round(proteinG * 0.167),
        carbsG: Math.round(carbsG * 0.074), fatG: Math.round(fatG * 0.25),
        name: 'Pre-Sleep', notes: 'Casein-Protein – +22% nächtliche Muskelproteinsynthese',
      },
    ]
  }

  // Ruhetag: gleichmäßigere Verteilung, weniger Carbs, mehr Fett
  const scale = caloriesTarget / 2120
  return [
    {
      mealNumber: 1, timeLabel: times.breakfast, slot: 'breakfast',
      kcal: Math.round(480 * scale), proteinG: Math.round(proteinG * 0.213),
      carbsG: Math.round(carbsG * 0.208), fatG: Math.round(fatG * 0.224),
      name: 'Frühstück',
    },
    {
      mealNumber: 2, timeLabel: times.lunch, slot: 'lunch',
      kcal: Math.round(490 * scale), proteinG: Math.round(proteinG * 0.213),
      carbsG: Math.round(carbsG * 0.25), fatG: Math.round(fatG * 0.204),
      name: 'Mittagessen',
    },
    {
      mealNumber: 3, timeLabel: times.pre_workout, slot: 'pre_workout',
      kcal: Math.round(380 * scale), proteinG: Math.round(proteinG * 0.189),
      carbsG: Math.round(carbsG * 0.208), fatG: Math.round(fatG * 0.163),
      name: 'Nachmittags-Snack',
    },
    {
      mealNumber: 4, timeLabel: times.dinner, slot: 'dinner',
      kcal: Math.round(520 * scale), proteinG: Math.round(proteinG * 0.213),
      carbsG: Math.round(carbsG * 0.317), fatG: Math.round(fatG * 0.184),
      name: 'Abendessen',
    },
    {
      mealNumber: 5, timeLabel: times.pre_sleep, slot: 'pre_sleep',
      kcal: Math.round(250 * scale), proteinG: Math.round(proteinG * 0.165),
      carbsG: Math.round(carbsG * 0.058), fatG: Math.round(fatG * 0.092),
      name: 'Pre-Sleep', notes: 'Casein-Protein für nächtliche MPS',
    },
  ]
}

// 7-Tage gleitendes Mittel für Gewichts-Trend
export function calcWeightTrend(weights: { date: string; weight: number }[]): {
  date: string
  weight: number
  trend: number | null
}[] {
  return weights.map((entry, i) => {
    if (i < 6) return { ...entry, trend: null }
    const window = weights.slice(i - 6, i + 1).map(w => w.weight)
    const avg = window.reduce((a, b) => a + b, 0) / window.length
    return { ...entry, trend: Math.round(avg * 100) / 100 }
  })
}

/**
 * Lineare Regression (kleinste Quadrate) der Steigung pro Tag.
 * x = Tagesabstand zum ersten Datum, y = Messwert. Robuster als 2-Block-Mittel,
 * weil alle Punkte einfließen und Wasser-/Glykogen-Rauschen herausmittelt.
 */
export function linearSlopePerDay(points: { date: string; value: number }[]): number | null {
  if (points.length < 4) return null
  const t0 = new Date(points[0].date + 'T00:00:00').getTime()
  const xs = points.map(p => (new Date(p.date + 'T00:00:00').getTime() - t0) / 86_400_000)
  const ys = points.map(p => p.value)
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  if (den === 0) return null
  return num / den
}

/**
 * Energiebilanz-Methode (adaptive TDEE):
 *   echter TDEE = Ø-Zufuhr − (Gewichts-Trend [kg/Tag] × 7700)
 * Bei Gewichtsverlust (negative Steigung) liegt der TDEE über der Zufuhr.
 */
export function empiricalTDEE(meanIntakeKcal: number, weightSlopeKgPerDay: number): number {
  return Math.round(meanIntakeKcal - weightSlopeKgPerDay * KCAL_PER_KG)
}

// TDEE-Selbstkalibrierung nach 14 Tagen
export function calibrateTDEE(
  weightAvgWeek1: number,
  weightAvgWeek2: number,
  currentTDEE: number,
  targetCaloriesPerDay: number
): { adjustment: number; newTDEE: number; explanation: string } {
  const actualDeltaKg = weightAvgWeek2 - weightAvgWeek1
  // 1 kg Körperfett ≈ 7700 kcal
  const actualDeltaKcal = actualDeltaKg * 7700
  const expectedDeltaKcal = (targetCaloriesPerDay - currentTDEE) * 14

  const discrepancyKcalPerDay = (actualDeltaKcal - expectedDeltaKcal) / 14
  const adjustment = Math.round(discrepancyKcalPerDay)
  const newTDEE = Math.round(currentTDEE + adjustment)

  return {
    adjustment,
    newTDEE,
    explanation: `Erwartete Änderung: ${(expectedDeltaKcal / 7700).toFixed(2)} kg, tatsächlich: ${actualDeltaKg.toFixed(2)} kg → TDEE ${adjustment > 0 ? '+' : ''}${adjustment} kcal angepasst.`,
  }
}
