/**
 * GET /api/export/csv?type=weight|readiness|strength
 * Exportiert Daten als CSV (Excel/Numbers-kompatibel).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(';'),
    ...rows.map(r =>
      headers.map(h => {
        const v = r[h]
        if (v === null || v === undefined) return ''
        const s = String(v)
        return s.includes(';') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s
      }).join(';')
    ),
  ]
  return lines.join('\r\n')
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = new URL(req.url).searchParams.get('type') ?? 'weight'

  let rows: Record<string, unknown>[] = []
  let filename = ''

  if (type === 'weight') {
    rows = await query(
      `SELECT entry_date AS "Datum", weight_kg AS "Gewicht_kg",
              body_fat_pct AS "KFA_pct", lean_mass_kg AS "Magermasse_kg",
              bmr_kcal AS "BMR_kcal", alcohol_units AS "Alkohol_Einheiten", source AS "Quelle"
       FROM daily_input WHERE user_id = $1 ORDER BY entry_date ASC`,
      [userId]
    )
    filename = 'gewicht-verlauf.csv'
  } else if (type === 'readiness') {
    rows = await query(
      `SELECT plan_date AS "Datum", readiness_score AS "Readiness_Score",
              readiness_level AS "Level", hrv_vs_baseline_pct AS "HRV_vs_Baseline_pct",
              sleep_score AS "Schlaf_Score", body_battery_morning AS "Body_Battery",
              scheduled_workout_type AS "Geplantes_Workout",
              recommended_workout_type AS "Empfohlenes_Workout",
              workout_status AS "Status"
       FROM daily_readiness WHERE user_id = $1 ORDER BY plan_date ASC`,
      [userId]
    )
    filename = 'readiness-verlauf.csv'
  } else if (type === 'strength') {
    rows = await query(
      `SELECT sl.log_date AS "Datum", sl.workout_type AS "Typ",
              sl.total_volume_kg AS "Volumen_kg",
              sl.subjective_rating AS "Rating",
              sl.readiness_score_at_training AS "Readiness_beim_Training",
              ss.movement_pattern AS "Bewegungsmuster",
              ss.exercise_name AS "Übung", ss.set_number AS "Satz",
              ss.reps AS "Wiederholungen", ss.added_weight_kg AS "Zusatzgewicht_kg",
              ss.rir AS "RIR"
       FROM strength_logs sl
       LEFT JOIN strength_sets ss ON ss.log_id = sl.id
       WHERE sl.user_id = $1
       ORDER BY sl.log_date DESC, ss.set_number ASC`,
      [userId]
    )
    filename = 'krafttraining-verlauf.csv'
  } else {
    return NextResponse.json({ error: 'type muss weight|readiness|strength sein' }, { status: 400 })
  }

  const csv = toCSV(rows as Record<string, unknown>[])
  const bom = '﻿' // BOM für Excel-Kompatibilität

  return new NextResponse(bom + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
