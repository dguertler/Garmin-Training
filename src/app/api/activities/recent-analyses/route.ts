/**
 * GET /api/activities/recent-analyses – Letzte 5 Post-Workout-Analysen mit Insights
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const analyses = await query<{
    id: string
    analysis_date: string
    activity_type: string
    distance_meters: number | null
    duration_seconds: number | null
    aerobic_decoupling_pct: number | null
    avg_pace_per_km_seconds: number | null
    avg_heart_rate: number | null
    z1z2_pct: number | null
    z3_pct: number | null
    z4z5_pct: number | null
    insights: unknown
    overall_rating: string | null
    activity_name: string | null
  }>(
    `SELECT pwa.id, pwa.analysis_date, pwa.activity_type,
            pwa.distance_meters, pwa.duration_seconds,
            pwa.aerobic_decoupling_pct, pwa.avg_pace_per_km_seconds,
            pwa.avg_heart_rate, pwa.z1z2_pct, pwa.z3_pct, pwa.z4z5_pct,
            pwa.insights, pwa.overall_rating,
            ga.name AS activity_name
     FROM post_workout_analyses pwa
     LEFT JOIN garmin_activities ga ON ga.id = pwa.garmin_activity_id
     WHERE pwa.user_id = $1
     ORDER BY pwa.analysis_date DESC
     LIMIT 5`,
    [userId]
  )

  return NextResponse.json({ analyses })
}
