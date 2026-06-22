/**
 * GET /api/training/zones – Wöchentliche 80/20-Zonenverteilung (letzte 8 Wochen)
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Gecachte Wochendaten (letzte 8 Wochen)
  const cachedWeeks = await query<{
    week_start_date: string
    total_training_seconds: number
    z1_seconds: number
    z2_seconds: number
    z3_seconds: number
    z4_seconds: number
    z5_seconds: number
    z1_pct: number
    z2_pct: number
    z3_pct: number
    z4_pct: number
    z5_pct: number
    low_intensity_pct: number
    high_intensity_pct: number
    polarization_ok: boolean
  }>(
    `SELECT week_start_date, total_training_seconds,
            z1_seconds, z2_seconds, z3_seconds, z4_seconds, z5_seconds,
            z1_pct, z2_pct, z3_pct, z4_pct, z5_pct,
            low_intensity_pct, high_intensity_pct, polarization_ok
     FROM weekly_zone_distribution
     WHERE user_id = $1
       AND week_start_date >= CURRENT_DATE - INTERVAL '8 weeks'
     ORDER BY week_start_date DESC`,
    [userId]
  )

  // Aktuelle Woche: direkt aus Garmin-Aktivitäten berechnen falls kein Cache
  const currentWeekStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d.toISOString().split('T')[0]
  })()

  let currentWeek = cachedWeeks.find(w => w.week_start_date === currentWeekStart)

  if (!currentWeek) {
    // Live-Berechnung aus HR-Zonen der Aktivitäten dieser Woche
    const liveZones = await query<{
      time_in_zone: number
      zone_number: number
    }>(
      `SELECT hz.zone_number, SUM(hz.time_in_zone_seconds) AS time_in_zone
       FROM garmin_activity_hr_zones hz
       JOIN garmin_activities ga ON ga.id = hz.activity_id
       WHERE ga.user_id = $1 AND ga.start_time::date >= $2
       GROUP BY hz.zone_number`,
      [userId, currentWeekStart]
    )

    const zSeconds = [0, 0, 0, 0, 0]
    for (const z of liveZones) {
      if (z.zone_number >= 1 && z.zone_number <= 5) {
        zSeconds[z.zone_number - 1] = Number(z.time_in_zone)
      }
    }
    const total = zSeconds.reduce((a, b) => a + b, 0)
    const pct = (s: number) => total > 0 ? Math.round((s / total) * 100 * 10) / 10 : 0

    const lowPct = pct(zSeconds[0] + zSeconds[1])
    const highPct = pct(zSeconds[3] + zSeconds[4])

    currentWeek = {
      week_start_date: currentWeekStart,
      total_training_seconds: total,
      z1_seconds: zSeconds[0],
      z2_seconds: zSeconds[1],
      z3_seconds: zSeconds[2],
      z4_seconds: zSeconds[3],
      z5_seconds: zSeconds[4],
      z1_pct: pct(zSeconds[0]),
      z2_pct: pct(zSeconds[1]),
      z3_pct: pct(zSeconds[2]),
      z4_pct: pct(zSeconds[3]),
      z5_pct: pct(zSeconds[4]),
      low_intensity_pct: lowPct,
      high_intensity_pct: highPct,
      polarization_ok: lowPct >= 75 && highPct <= 25,
    }
  }

  // 4-Wochen-Aggregate
  const last4 = cachedWeeks.slice(0, 4)
  const totalSecs4 = last4.reduce((s, w) => s + w.total_training_seconds, 0)
  const lowSecs4 = last4.reduce((s, w) => s + w.z1_seconds + w.z2_seconds, 0)
  const highSecs4 = last4.reduce((s, w) => s + w.z4_seconds + w.z5_seconds, 0)

  const avgLow4 = totalSecs4 > 0 ? Math.round((lowSecs4 / totalSecs4) * 100) : null
  const avgHigh4 = totalSecs4 > 0 ? Math.round((highSecs4 / totalSecs4) * 100) : null

  return NextResponse.json({
    current_week: currentWeek,
    weeks: cachedWeeks,
    summary_4w: {
      avg_low_intensity_pct: avgLow4,
      avg_high_intensity_pct: avgHigh4,
      polarization_ok: avgLow4 !== null ? avgLow4 >= 75 && avgHigh4! <= 25 : null,
    },
  })
}
