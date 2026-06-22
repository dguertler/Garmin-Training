/**
 * GET /api/activities/[id]/analysis – Post-Workout-Analyse für eine Aktivität
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const analysis = await queryOne<{
    id: string
    activity_id: string
    prev_activity_id: string | null
    analysis_date: string
    avg_pace_vs_prev: number | null
    avg_hr_vs_prev: number | null
    distance_vs_prev: number | null
    aerobic_decoupling: number | null
    pct_z1z2: number | null
    pct_z3: number | null
    pct_z4z5: number | null
    overall_rating: string
    insights: Array<{ type: string; message: string; severity: string }> | null
  }>(
    `SELECT pwa.* FROM post_workout_analyses pwa
     JOIN garmin_activities ga ON ga.id = pwa.activity_id
     WHERE pwa.activity_id = $1 AND ga.user_id = $2`,
    [params.id, userId]
  )

  if (!analysis) {
    return NextResponse.json({ error: 'Keine Analyse vorhanden' }, { status: 404 })
  }

  return NextResponse.json(analysis)
}
