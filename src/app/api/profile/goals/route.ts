/**
 * GET  /api/profile/goals – Ziele abrufen
 * PATCH /api/profile/goals – Ziele setzen
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const goals = await queryOne(
    `SELECT target_weight_kg, target_body_fat_pct, weekly_strength_sessions,
            weekly_cardio_sessions, target_date, notes
     FROM profile_goals WHERE user_id = $1`,
    [userId]
  )

  return NextResponse.json({ goals: goals ?? null })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    target_weight_kg, target_body_fat_pct,
    weekly_strength_sessions, weekly_cardio_sessions,
    target_date, notes,
  } = body

  await query(
    `INSERT INTO profile_goals
       (user_id, target_weight_kg, target_body_fat_pct,
        weekly_strength_sessions, weekly_cardio_sessions, target_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET
       target_weight_kg = COALESCE($2, profile_goals.target_weight_kg),
       target_body_fat_pct = COALESCE($3, profile_goals.target_body_fat_pct),
       weekly_strength_sessions = COALESCE($4, profile_goals.weekly_strength_sessions),
       weekly_cardio_sessions = COALESCE($5, profile_goals.weekly_cardio_sessions),
       target_date = COALESCE($6, profile_goals.target_date),
       notes = COALESCE($7, profile_goals.notes),
       updated_at = NOW()`,
    [
      userId,
      target_weight_kg ?? null,
      target_body_fat_pct ?? null,
      weekly_strength_sessions ?? null,
      weekly_cardio_sessions ?? null,
      target_date ?? null,
      notes ?? null,
    ]
  )

  return NextResponse.json({ ok: true })
}
