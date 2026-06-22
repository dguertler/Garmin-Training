export type Phase = 'cut' | 'bulk' | 'maintenance'

export interface DailyNutritionInput {
  weightKg: number
  bodyFatPct: number
  activeCaloriesGarmin: number  // aus Garmin, wird korrigiert
  phase: Phase
  isTrainingDay: boolean
  isRefeedDay: boolean
  tdeeAdjustmentKcal?: number   // aus Selbstkalibrierung
}

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

  const correctedActive = correctActiveCalories(input.activeCaloriesGarmin, input.isTrainingDay)
  let tdeeKcal = bmrKcal + correctedActive + (input.tdeeAdjustmentKcal ?? 0)

  // Zielkalorien nach Phase
  let caloriesTarget: number
  switch (input.phase) {
    case 'cut':
      caloriesTarget = Math.round(tdeeKcal * 0.80)  // −20%
      break
    case 'bulk':
      caloriesTarget = Math.round(tdeeKcal + 400)    // +300-500 kcal Mitte
      break
    case 'maintenance':
      caloriesTarget = Math.round(tdeeKcal)
      break
  }

  // Protein: 2,3 g/kg Körpergewicht (konstant, alle Tage)
  const proteinG = Math.round(2.3 * input.weightKg)
  const proteinKcal = proteinG * 4

  // Fett: 22% der Gesamtkalorien (Mitte 20-25%)
  let fatG = Math.round((caloriesTarget * 0.22) / 9)
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

// Mahlzeitenplan generieren (Training abends nach 18:00)
export function generateMealPlan(macros: MacroTargets, isTrainingDay: boolean): MealPlanEntry[] {
  const { caloriesTarget, proteinG, carbsG, fatG } = macros

  if (isTrainingDay) {
    // Verteilung: 500 / 535 / 400 / 640 / 440 ≈ Spezifikation, skaliert auf Zielkalorien
    const scale = caloriesTarget / 2515  // Basis 2515 kcal aus Spezifikation
    return [
      {
        mealNumber: 1, timeLabel: '07:00', slot: 'breakfast',
        kcal: Math.round(500 * scale), proteinG: Math.round(proteinG * 0.213),
        carbsG: Math.round(carbsG * 0.165), fatG: Math.round(fatG * 0.25),
        name: 'Frühstück',
      },
      {
        mealNumber: 2, timeLabel: '12:30', slot: 'lunch',
        kcal: Math.round(535 * scale), proteinG: Math.round(proteinG * 0.214),
        carbsG: Math.round(carbsG * 0.196), fatG: Math.round(fatG * 0.25),
        name: 'Mittagessen',
      },
      {
        mealNumber: 3, timeLabel: '16:30', slot: 'pre_workout',
        kcal: Math.round(400 * scale), proteinG: Math.round(proteinG * 0.167),
        carbsG: Math.round(carbsG * 0.239), fatG: Math.round(fatG * 0.056),
        name: 'Pre-Workout', notes: 'Kein Fett – verlangsamt Verdauung',
      },
      {
        mealNumber: 4, timeLabel: '20:30', slot: 'dinner',
        kcal: Math.round(640 * scale), proteinG: Math.round(proteinG * 0.238),
        carbsG: Math.round(carbsG * 0.326), fatG: Math.round(fatG * 0.194),
        name: 'Post-Workout / Abendessen', notes: 'Größter Carb-Block – Glykogen-Resynthese',
      },
      {
        mealNumber: 5, timeLabel: '22:30', slot: 'pre_sleep',
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
      mealNumber: 1, timeLabel: '07:00', slot: 'breakfast',
      kcal: Math.round(480 * scale), proteinG: Math.round(proteinG * 0.213),
      carbsG: Math.round(carbsG * 0.208), fatG: Math.round(fatG * 0.224),
      name: 'Frühstück',
    },
    {
      mealNumber: 2, timeLabel: '12:00', slot: 'lunch',
      kcal: Math.round(490 * scale), proteinG: Math.round(proteinG * 0.213),
      carbsG: Math.round(carbsG * 0.25), fatG: Math.round(fatG * 0.204),
      name: 'Mittagessen',
    },
    {
      mealNumber: 3, timeLabel: '16:00', slot: 'pre_workout',
      kcal: Math.round(380 * scale), proteinG: Math.round(proteinG * 0.189),
      carbsG: Math.round(carbsG * 0.208), fatG: Math.round(fatG * 0.163),
      name: 'Nachmittags-Snack',
    },
    {
      mealNumber: 4, timeLabel: '19:30', slot: 'dinner',
      kcal: Math.round(520 * scale), proteinG: Math.round(proteinG * 0.213),
      carbsG: Math.round(carbsG * 0.317), fatG: Math.round(fatG * 0.184),
      name: 'Abendessen',
    },
    {
      mealNumber: 5, timeLabel: '22:30', slot: 'pre_sleep',
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
