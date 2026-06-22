/**
 * GET /api/personal-records – Aktuelle PRs + Jahresvergleich
 * POST /api/personal-records – PR manuell eintragen / aktualisieren
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [current, yearAgo] = await Promise.all([
    query<{
      record_type: string
      value: number
      unit: string
      achieved_date: string
    }>(
      `SELECT record_type, value, unit, achieved_date
       FROM personal_records WHERE user_id = $1
       ORDER BY record_type ASC`,
      [userId]
    ),
    // Bester Wert vor > 1 Jahr aus History für Delta-Berechnung
    query<{ record_type: string; value: number }>(
      `SELECT DISTINCT ON (record_type) record_type, value
       FROM personal_records_history
       WHERE user_id = $1
         AND achieved_date <= CURRENT_DATE - INTERVAL '1 year'
       ORDER BY record_type, achieved_date DESC`,
      [userId]
    ),
  ])

  const yearAgoMap = new Map(yearAgo.map(r => [r.record_type, r.value]))

  const records = current.map(r => ({
    ...r,
    delta_vs_year_ago: yearAgoMap.has(r.record_type)
      ? Number(r.value) - Number(yearAgoMap.get(r.record_type))
      : null,
  }))

  return NextResponse.json({ records })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { record_type, value, unit, achieved_date } = body

  if (!record_type || value == null || !unit || !achieved_date) {
    return NextResponse.json({ error: 'record_type, value, unit, achieved_date erforderlich' }, { status: 400 })
  }

  // Alten PR in History sichern
  const old = await queryOne<{ value: number; unit: string; achieved_date: string }>(
    `SELECT value, unit, achieved_date FROM personal_records WHERE user_id = $1 AND record_type = $2`,
    [userId, record_type]
  )
  if (old) {
    await query(
      `INSERT INTO personal_records_history (user_id, record_type, value, unit, achieved_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, record_type, old.value, old.unit, old.achieved_date]
    )
  }

  await query(
    `INSERT INTO personal_records (user_id, record_type, value, unit, achieved_date)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, record_type) DO UPDATE
       SET value = $3, unit = $4, achieved_date = $5`,
    [userId, record_type, value, unit, achieved_date]
  )

  return NextResponse.json({ ok: true })
}
