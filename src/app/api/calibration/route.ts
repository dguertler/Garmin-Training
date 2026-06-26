/**
 * GET  /api/calibration – Status der adaptiven TDEE-Kalibrierung (Energiebilanz)
 * POST /api/calibration – Kalibrierung manuell auslösen (force)
 *
 * Methode: echter TDEE = Ø gelogte Zufuhr − (geglätteter Gewichts-Trend × 7700).
 * Details + Guardrails in src/lib/tdeeCalibration.ts.
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { computeEmpiricalTDEE, applyCalibration } from '@/lib/tdeeCalibration'
import { recomputeDailyTargets } from '@/lib/nutritionEngine'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [status, lastCal] = await Promise.all([
    computeEmpiricalTDEE(userId),
    queryOne<{ tdee_adjustment_kcal: number; new_tdee_kcal: number; calibration_date: string }>(
      `SELECT tdee_adjustment_kcal, new_tdee_kcal, calibration_date::text
       FROM tdee_calibrations WHERE user_id = $1 ORDER BY calibration_date DESC LIMIT 1`,
      [userId]
    ),
  ])

  const prof = await queryOne<{ tdee_last_calibrated_at: string | null }>(
    `SELECT tdee_last_calibrated_at::text FROM user_profiles WHERE user_id = $1`,
    [userId]
  )

  return NextResponse.json({
    ...status,
    last_calibrated: prof?.tdee_last_calibrated_at ?? null,
    last_calibration: lastCal ?? null,
  })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await applyCalibration(userId, { force: true })

  // Bei Anpassung heutige Ziele/Mahlzeiten sofort auf neuen TDEE umrechnen
  if (result.adjusted) {
    const today = new Date().toISOString().split('T')[0]
    await recomputeDailyTargets(userId, today)
  }

  return NextResponse.json(result)
}
