/**
 * PATCH /api/readiness/[date] – Workout-Status für einen Tag setzen
 * Body: { status: 'done' | 'skipped' | 'modified' }
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

const VALID_STATUSES = ['planned', 'done', 'skipped', 'modified'] as const
type WorkoutStatus = typeof VALID_STATUSES[number]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { date: string } }
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date } = params
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Ungültiges Datum (YYYY-MM-DD)' }, { status: 400 })
  }

  const body = await req.json()
  const status: WorkoutStatus = body.status
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status muss eines von: ${VALID_STATUSES.join(', ')} sein` },
      { status: 400 }
    )
  }

  // Upsert: falls kein Eintrag für diesen Tag vorhanden, einen anlegen
  await query(
    `INSERT INTO daily_readiness (user_id, plan_date, workout_status, completed_at)
     VALUES ($1, $2, $3, CASE WHEN $3 = 'done' THEN NOW() ELSE NULL END)
     ON CONFLICT (user_id, plan_date)
     DO UPDATE SET
       workout_status = $3,
       completed_at = CASE WHEN $3 = 'done' THEN NOW() ELSE daily_readiness.completed_at END,
       updated_at = NOW()`,
    [userId, date, status]
  )

  return NextResponse.json({ ok: true, date, status })
}
