/**
 * Adaptive TDEE-Kalibrierung (Energiebilanz-Methode).
 *
 * Prinzip: Der Geräte-/Garmin-Verbrauch ist nur eine Schätzung. Die Wahrheit
 * liefert die Energiebilanz über Zeit:
 *   echter TDEE = Ø echte Zufuhr − (geglätteter Gewichts-Trend [kg/Tag] × 7700)
 *
 * Datenquellen:
 *  - Gewicht: daily_input (geglättet via lineare Regression über das Fenster)
 *  - Zufuhr:  meal_logs (echte gelogte Kalorien). Fallback: nutrition_targets
 *             (geplantes Ziel) – klar als 'planned' markiert, weniger genau.
 *
 * Guardrails gegen Rauschen:
 *  - Mindestens 14 Gewichts-Tage und ~10 Zufuhr-Tage im Fenster.
 *  - Schrittweite je Kalibrierung gedeckelt (±300 kcal) → kein Überschwingen.
 *  - Plausibilitätsgrenzen (1200–6000 kcal).
 *  - Auto-Lauf höchstens 1×/Woche.
 */
import { query, queryOne } from '@/lib/db'
import { linearSlopePerDay, empiricalTDEE, KCAL_PER_KG } from '@/lib/nutrition'

const WINDOW_DAYS = 21
const MIN_WEIGHT_DAYS = 14
const MIN_INTAKE_DAYS = 10
const MAX_STEP_KCAL = 300
const AUTO_INTERVAL_DAYS = 7

export interface CalibrationStatus {
  ready: boolean
  windowDays: number
  weightDays: number
  intakeDays: number
  intakeSource: 'logged' | 'planned' | null
  meanIntakeKcal: number | null
  weeklyRateKg: number | null
  empiricalTdee: number | null
  garminEstimateTdee: number | null
  currentTdee: number | null
  reason?: string
}

interface RawData {
  weights: { date: string; value: number }[]
  intakeLogged: { date: string; kcal: number }[]
  intakePlanned: { date: string; kcal: number }[]
  garminEstimate: number | null
  currentTdee: number | null
}

async function loadWindow(userId: string): Promise<RawData> {
  const [weights, intakeLogged, intakePlanned, est, prof] = await Promise.all([
    query<{ entry_date: string; weight_kg: number }>(
      `SELECT entry_date::text, weight_kg FROM daily_input
       WHERE user_id = $1 AND entry_date >= CURRENT_DATE - make_interval(days => $2)
       ORDER BY entry_date ASC`,
      [userId, WINDOW_DAYS]
    ),
    query<{ log_date: string; kcal: number }>(
      `SELECT log_date::text, SUM(calories)::int AS kcal FROM meal_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - make_interval(days => $2)
       GROUP BY log_date ORDER BY log_date ASC`,
      [userId, WINDOW_DAYS]
    ),
    query<{ target_date: string; kcal: number }>(
      `SELECT target_date::text, calories_target AS kcal FROM nutrition_targets
       WHERE user_id = $1 AND target_date >= CURRENT_DATE - make_interval(days => $2)
       ORDER BY target_date ASC`,
      [userId, WINDOW_DAYS]
    ),
    // Garmin-Roh-Schätzung: aktuellster BMR + Ø roher Aktivkalorien (unabhängig vom
    // kalibrierten Wert, damit der Vergleich „empirisch vs. Garmin" stabil bleibt)
    queryOne<{ bmr: number | null; avg_active: number | null }>(
      `SELECT
         (SELECT bmr_kcal FROM daily_input WHERE user_id = $1 ORDER BY entry_date DESC LIMIT 1) AS bmr,
         (SELECT AVG(calories_active) FROM garmin_raw_metrics
            WHERE user_id = $1 AND metric_date >= CURRENT_DATE - make_interval(days => $2)) AS avg_active`,
      [userId, WINDOW_DAYS]
    ),
    queryOne<{ tdee_kcal_current: number | null }>(
      `SELECT tdee_kcal_current FROM user_profiles WHERE user_id = $1`,
      [userId]
    ),
  ])

  return {
    weights: weights.map(w => ({ date: w.entry_date, value: Number(w.weight_kg) })),
    intakeLogged: intakeLogged.map(i => ({ date: i.log_date, kcal: Number(i.kcal) })),
    intakePlanned: intakePlanned.map(i => ({ date: i.target_date, kcal: Number(i.kcal) })),
    garminEstimate: est?.bmr != null && est?.avg_active != null
      ? Math.round(Number(est.bmr) + Number(est.avg_active))
      : null,
    currentTdee: prof?.tdee_kcal_current != null ? Number(prof.tdee_kcal_current) : null,
  }
}

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

/** Berechnet den empirischen TDEE-Status, ohne ihn zu speichern. */
export async function computeEmpiricalTDEE(userId: string): Promise<CalibrationStatus> {
  const data = await loadWindow(userId)

  // Zufuhr: echte Logs bevorzugen, sonst geplante Ziele als Näherung
  let intake = data.intakeLogged
  let intakeSource: 'logged' | 'planned' | null = intake.length ? 'logged' : null
  if (intake.length < MIN_INTAKE_DAYS && data.intakePlanned.length >= MIN_INTAKE_DAYS) {
    intake = data.intakePlanned
    intakeSource = 'planned'
  }

  const base: CalibrationStatus = {
    ready: false,
    windowDays: WINDOW_DAYS,
    weightDays: data.weights.length,
    intakeDays: intake.length,
    intakeSource,
    meanIntakeKcal: null,
    weeklyRateKg: null,
    empiricalTdee: null,
    garminEstimateTdee: data.garminEstimate,
    currentTdee: data.currentTdee,
  }

  if (data.weights.length < MIN_WEIGHT_DAYS) {
    return { ...base, reason: `Noch ${MIN_WEIGHT_DAYS - data.weights.length} Gewichts-Tage nötig.` }
  }
  if (intake.length < MIN_INTAKE_DAYS) {
    return { ...base, reason: `Noch ${MIN_INTAKE_DAYS - intake.length} Tage mit Mahlzeiten-Log nötig.` }
  }

  const slope = linearSlopePerDay(data.weights)
  if (slope == null) return { ...base, reason: 'Gewichts-Trend nicht berechenbar.' }

  const meanIntake = Math.round(mean(intake.map(i => i.kcal)))
  const tdee = empiricalTDEE(meanIntake, slope)

  return {
    ...base,
    ready: true,
    meanIntakeKcal: meanIntake,
    weeklyRateKg: Math.round(slope * 7 * 1000) / 1000,
    empiricalTdee: tdee,
  }
}

export interface ApplyResult {
  adjusted: boolean
  status: CalibrationStatus
  oldTdee: number | null
  newTdee: number | null
  appliedDelta: number | null
  message: string
}

/**
 * Berechnet und (bei force oder fälligem Auto-Lauf) speichert den neuen TDEE.
 * Auto-Lauf: nur wenn ≥7 Tage seit letzter Kalibrierung.
 */
export async function applyCalibration(userId: string, opts: { force?: boolean } = {}): Promise<ApplyResult> {
  if (!opts.force) {
    const prof = await queryOne<{ tdee_last_calibrated_at: string | null }>(
      `SELECT tdee_last_calibrated_at::text FROM user_profiles WHERE user_id = $1`,
      [userId]
    )
    if (prof?.tdee_last_calibrated_at) {
      const days = (Date.now() - new Date(prof.tdee_last_calibrated_at + 'T00:00:00').getTime()) / 86_400_000
      if (days < AUTO_INTERVAL_DAYS) {
        const status = await computeEmpiricalTDEE(userId)
        return { adjusted: false, status, oldTdee: status.currentTdee, newTdee: status.currentTdee, appliedDelta: null, message: 'Auto-Kalibrierung noch nicht fällig.' }
      }
    }
  }

  const status = await computeEmpiricalTDEE(userId)
  if (!status.ready || status.empiricalTdee == null) {
    return { adjusted: false, status, oldTdee: status.currentTdee, newTdee: status.currentTdee, appliedDelta: null, message: status.reason ?? 'Noch nicht genug Daten.' }
  }

  // Zielwert mit Plausibilitäts- und Schrittweiten-Begrenzung
  let target = Math.max(1200, Math.min(6000, status.empiricalTdee))
  const old = status.currentTdee
  if (old != null) {
    const delta = target - old
    if (Math.abs(delta) > MAX_STEP_KCAL) target = old + Math.sign(delta) * MAX_STEP_KCAL
    if (Math.abs(target - old) < 30) {
      // Nur Zeitstempel auffrischen, kein nennenswerter Bedarf
      await query(
        `UPDATE user_profiles SET tdee_last_calibrated_at = CURRENT_DATE, updated_at = NOW() WHERE user_id = $1`,
        [userId]
      )
      return { adjusted: false, status, oldTdee: old, newTdee: old, appliedDelta: 0, message: 'Abweichung < 30 kcal/Tag – kein Anpassungsbedarf.' }
    }
  }

  const newTdee = Math.round(target)

  await query(
    `UPDATE user_profiles
       SET tdee_kcal_current = $2, tdee_last_calibrated_at = CURRENT_DATE, updated_at = NOW()
     WHERE user_id = $1`,
    [userId, newTdee]
  )

  // Protokoll (Halbfenster-Mittel für die historische Anzeige)
  const w = (await loadWindow(userId)).weights
  const half = Math.floor(w.length / 2)
  const avg1 = half ? mean(w.slice(0, half).map(p => p.value)) : w[0].value
  const avg2 = mean(w.slice(half).map(p => p.value))
  await query(
    `INSERT INTO tdee_calibrations
       (user_id, calibration_date, weight_avg_week1, weight_avg_week2,
        actual_delta_kg, expected_delta_kg, tdee_adjustment_kcal, new_tdee_kcal)
     VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      Math.round(avg1 * 100) / 100,
      Math.round(avg2 * 100) / 100,
      Math.round((status.weeklyRateKg ?? 0) / 7 * w.length * 1000) / 1000,
      Math.round(((status.empiricalTdee - (status.meanIntakeKcal ?? 0)) / KCAL_PER_KG) * 1000) / 1000,
      old != null ? newTdee - old : 0,
      newTdee,
    ]
  )

  return {
    adjusted: true,
    status,
    oldTdee: old,
    newTdee,
    appliedDelta: old != null ? newTdee - old : null,
    message: old != null
      ? `TDEE ${old} → ${newTdee} kcal (${newTdee - old > 0 ? '+' : ''}${newTdee - old}).`
      : `TDEE auf ${newTdee} kcal kalibriert.`,
  }
}

/** Vom daily-input-Flow aufgerufen: rollende Auto-Kalibrierung (max. wöchentlich). */
export async function maybeAutoCalibrate(userId: string): Promise<void> {
  try {
    await applyCalibration(userId, { force: false })
  } catch (e) {
    console.error('[tdeeCalibration] auto-calibration failed:', e)
  }
}
