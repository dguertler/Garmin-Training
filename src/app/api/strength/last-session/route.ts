/**
 * GET /api/strength/last-session?type=push – Letzte Session dieses Typs für Pre-Fill
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  const last = await queryOne(
    `SELECT sl.id, sl.log_date, sl.workout_type,
            json_agg(
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
     JOIN strength_sets ss ON ss.log_id = sl.id
     WHERE sl.user_id = $1 AND sl.workout_type = $2
     GROUP BY sl.id
     ORDER BY sl.log_date DESC LIMIT 1`,
    [userId, type]
  )

  return NextResponse.json({ session: last })
}
