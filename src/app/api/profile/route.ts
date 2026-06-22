/**
 * GET  /api/profile – Profil + Phasenstatus
 * PATCH /api/profile – Phase wechseln, Ziele updaten
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'


export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [profile, lastInput, syncStatus] = await Promise.all([
    queryOne(
      `SELECT up.*, u.name, u.email, u.profile_key
       FROM user_profiles up JOIN users u ON u.id = up.user_id
       WHERE up.user_id = $1`,
      [userId]
    ),
    queryOne(
      `SELECT weight_kg, body_fat_pct, lean_mass_kg, bmr_kcal, entry_date
       FROM daily_input WHERE user_id = $1 ORDER BY entry_date DESC LIMIT 1`,
      [userId]
    ),
    queryOne(
      `SELECT status, finished_at FROM sync_jobs WHERE user_id = $1
       ORDER BY started_at DESC LIMIT 1`,
      [userId]
    ),
  ])

  return NextResponse.json({ profile, lastInput, syncStatus })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId)  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = [
    'current_phase', 'phase_start_date', 'bulk_start_date',
    'daily_steps_goal', 'lthr',
  ]

  const updates: string[] = []
  const vals: unknown[] = [userId]

  for (const key of allowed) {
    if (key in body) {
      vals.push(body[key])
      updates.push(`${key} = $${vals.length}`)
    }
  }

  if (!updates.length) return NextResponse.json({ error: 'Keine Felder angegeben' }, { status: 400 })

  // LTHR gesetzt → Zonen berechnen
  if (body.lthr) {
    const lthr = body.lthr
    const zones = {
      hr_zone1_low: Math.round(lthr * 0.60), hr_zone1_high: Math.round(lthr * 0.72),
      hr_zone2_low: Math.round(lthr * 0.72), hr_zone2_high: Math.round(lthr * 0.82),
      hr_zone3_low: Math.round(lthr * 0.82), hr_zone3_high: Math.round(lthr * 0.89),
      hr_zone4_low: Math.round(lthr * 0.89), hr_zone4_high: Math.round(lthr * 0.97),
      hr_zone5_low: Math.round(lthr * 0.97), hr_zone5_high: Math.round(lthr * 1.05),
    }
    for (const [k, v] of Object.entries(zones)) {
      vals.push(v)
      updates.push(`${k} = $${vals.length}`)
    }
    vals.push('lthr')
    updates.push(`hr_zones_source = $${vals.length}`)
  }

  updates.push('updated_at = NOW()')
  await query(`UPDATE user_profiles SET ${updates.join(', ')} WHERE user_id = $1`, vals)

  return NextResponse.json({ ok: true })
}
