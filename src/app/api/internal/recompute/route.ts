/**
 * POST /api/internal/recompute – interner Endpunkt für den Sync-Worker.
 *
 * Wird nach dem täglichen Garmin-Sync aufgerufen (Worker → Web), damit die
 * adaptive TDEE-Kalibrierung und die Tagesziele auch dann laufen, wenn der
 * User die App nicht öffnet (z.B. Gewicht kommt automatisch von der Garmin-Waage).
 *
 * Auth: Header X-Internal-Key === SYNC_INTERNAL_KEY (geteilt mit dem Worker).
 * Body optional: { user_id } – sonst alle Profile.
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { maybeAutoCalibrate } from '@/lib/tdeeCalibration'
import { recomputeDailyTargets } from '@/lib/nutritionEngine'

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-internal-key')
  if (!process.env.SYNC_INTERNAL_KEY || key !== process.env.SYNC_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({} as { user_id?: string }))
  const today = new Date().toISOString().split('T')[0]

  let userIds: string[]
  if (body.user_id) {
    userIds = [body.user_id]
  } else {
    const rows = await query<{ user_id: string }>(`SELECT user_id FROM user_profiles`)
    userIds = rows.map(r => r.user_id)
  }

  const results: { user_id: string; calibrated: boolean; recomputed: boolean; error?: string }[] = []
  for (const uid of userIds) {
    try {
      await maybeAutoCalibrate(uid)
      const recomputed = await recomputeDailyTargets(uid, today)
      results.push({ user_id: uid, calibrated: true, recomputed })
    } catch (e) {
      results.push({ user_id: uid, calibrated: false, recomputed: false, error: String(e) })
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
