/**
 * POST /api/strength – Neue Kraft-Session anlegen
 * GET  /api/strength – Letzte Sessions
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'


export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { workout_type, log_date, sets, subjective_rating, session_notes } = body

  if (!workout_type || !sets?.length) {
    return NextResponse.json({ error: 'workout_type und sets erforderlich' }, { status: 400 })
  }

  const date = log_date ?? new Date().toISOString().split('T')[0]

  // Aktuelles Gewicht für BW-Tracking
  const input = await queryOne<{ weight_kg: number }>(
    `SELECT weight_kg FROM daily_input WHERE user_id = $1 AND entry_date <= $2
     ORDER BY entry_date DESC LIMIT 1`,
    [userId, date]
  )
  const bw = input?.weight_kg ?? null

  // Readiness zum Zeitpunkt
  const readiness = await queryOne<{ readiness_score: number }>(
    `SELECT readiness_score FROM daily_readiness WHERE user_id = $1 AND plan_date = $2`,
    [userId, date]
  )

  // Gesamtvolumen berechnen
  const totalVolume = (sets as Array<{ reps: number; added_weight_kg?: number; set_number: number }>)
    .reduce((sum, s) => sum + s.reps * (s.added_weight_kg ?? 0), 0)

  const logs = await query<{ id: string }>(
    `INSERT INTO strength_logs
       (user_id, log_date, workout_type, readiness_score_at_training,
        total_volume_kg, subjective_rating, session_notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      userId, date, workout_type,
      readiness?.readiness_score ?? null,
      totalVolume, subjective_rating ?? null, session_notes ?? null,
    ]
  )
  const logId = logs[0].id

  // Sätze speichern
  for (const set of sets as Array<{
    movement_pattern: string
    exercise_name: string
    skill_level: number
    set_number: number
    reps: number
    added_weight_kg?: number
    rir: number
  }>) {
    await query(
      `INSERT INTO strength_sets
         (log_id, movement_pattern, exercise_name, skill_level,
          set_number, reps, bodyweight_kg, added_weight_kg, total_load_kg, rir)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        logId,
        set.movement_pattern, set.exercise_name, set.skill_level ?? 1,
        set.set_number, set.reps,
        bw, set.added_weight_kg ?? 0,
        (bw ?? 0) + (set.added_weight_kg ?? 0),
        set.rir,
      ]
    )
  }

  // Progressions-Check: 3×10 mit RIR ≤ 1?
  await _checkProgression(userId, sets as Array<{
    movement_pattern: string
    skill_level: number
    reps: number
    rir: number
  }>)

  return NextResponse.json({ ok: true, log_id: logId })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workoutType = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') ?? '10')

  const logs = await query(
    `SELECT sl.*, json_agg(
       json_build_object(
         'movement_pattern', ss.movement_pattern,
         'exercise_name', ss.exercise_name,
         'skill_level', ss.skill_level,
         'set_number', ss.set_number,
         'reps', ss.reps,
         'added_weight_kg', ss.added_weight_kg,
         'rir', ss.rir
       ) ORDER BY ss.movement_pattern, ss.set_number
     ) AS sets
     FROM strength_logs sl
     LEFT JOIN strength_sets ss ON ss.log_id = sl.id
     WHERE sl.user_id = $1 ${workoutType ? 'AND sl.workout_type = $3' : ''}
     GROUP BY sl.id
     ORDER BY sl.log_date DESC LIMIT $2`,
    workoutType ? [userId, limit, workoutType] : [userId, limit]
  )

  // Progressionsstatus
  const progression = await query(
    `SELECT cp.movement_pattern, cp.current_skill_level, cp.current_exercise,
            cp.progression_criteria_met, pl.advancement_criteria
     FROM calisthenics_progression cp
     LEFT JOIN progression_ladder pl
       ON pl.movement_pattern = cp.movement_pattern
      AND pl.skill_level = cp.current_skill_level
     WHERE cp.user_id = $1`,
    [userId]
  )

  return NextResponse.json({ logs, progression })
}

async function _checkProgression(
  userId: string,
  sets: Array<{ movement_pattern: string; skill_level: number; reps: number; rir: number }>
) {
  const byPattern = new Map<string, { reps: number[]; rir: number[]; level: number }>()
  for (const s of sets) {
    const existing = byPattern.get(s.movement_pattern)
    if (existing) {
      existing.reps.push(s.reps)
      existing.rir.push(s.rir)
    } else {
      byPattern.set(s.movement_pattern, { reps: [s.reps], rir: [s.rir], level: s.skill_level })
    }
  }

  for (const [pattern, data] of byPattern) {
    const setCount = data.reps.length
    const avgReps = data.reps.reduce((a, b) => a + b, 0) / setCount
    const maxRIR = Math.max(...data.rir)

    // Aufstiegskriterium: 3+ Sätze, Ø ≥ 10 Wdh, max RIR ≤ 1
    if (setCount >= 3 && avgReps >= 10 && maxRIR <= 1) {
      await query(
        `UPDATE calisthenics_progression
         SET progression_criteria_met = TRUE, last_assessed_date = CURRENT_DATE, updated_at = NOW()
         WHERE user_id = $1 AND movement_pattern = $2 AND progression_criteria_met = FALSE`,
        [userId, pattern]
      )
    }
  }
}
