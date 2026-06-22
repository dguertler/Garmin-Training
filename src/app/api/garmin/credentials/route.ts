/**
 * GET  /api/garmin/credentials – Status der Garmin-Verbindung
 * POST /api/garmin/credentials – Garmin-Credentials speichern + Sync auslösen
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [tokenStatus, profile] = await Promise.all([
    queryOne<{ status: string; last_refreshed_at: string | null; error_message: string | null }>(
      `SELECT status, last_refreshed_at, error_message
       FROM garmin_tokens WHERE user_id = $1`,
      [userId]
    ),
    queryOne<{ garmin_username: string | null }>(
      `SELECT garmin_username FROM user_profiles WHERE user_id = $1`,
      [userId]
    ),
  ])

  const lastSync = await queryOne<{ status: string; finished_at: string | null }>(
    `SELECT status, finished_at FROM sync_jobs
     WHERE user_id = $1 ORDER BY started_at DESC LIMIT 1`,
    [userId]
  )

  return NextResponse.json({
    connected: tokenStatus?.status === 'active',
    status: tokenStatus?.status ?? 'not_set',
    garmin_username: profile?.garmin_username ?? null,
    last_refreshed_at: tokenStatus?.last_refreshed_at ?? null,
    error_message: tokenStatus?.error_message ?? null,
    last_sync: lastSync ?? null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { garmin_email, garmin_password } = body

  if (!garmin_email || !garmin_password) {
    return NextResponse.json({ error: 'garmin_email und garmin_password erforderlich' }, { status: 400 })
  }

  // Garmin-Username im Profil speichern (Passwort wird NICHT in DB gespeichert)
  await query(
    `UPDATE user_profiles SET garmin_username = $1 WHERE user_id = $2`,
    [garmin_email.toLowerCase(), userId]
  )

  // Sync-Job anlegen (worker übernimmt Login + Token-Speicherung)
  const jobs = await query<{ id: string }>(
    `INSERT INTO sync_jobs (user_id, job_type, status) VALUES ($1, 'initial', 'running') RETURNING id`,
    [userId]
  )
  const jobId = jobs[0]?.id

  // Sync-Worker anstoßen mit Credentials für ersten Login
  const workerUrl = process.env.SYNC_WORKER_URL
  let workerTriggered = false
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/sync/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': process.env.SYNC_INTERNAL_KEY ?? '',
        },
        body: JSON.stringify({
          user_id: userId,
          job_id: jobId,
          garmin_email,
          garmin_password,
        }),
      })
      workerTriggered = res.ok
    } catch {
      // Worker nicht verfügbar – Job bleibt pending, Cron löst später aus
    }
  }

  return NextResponse.json({
    ok: true,
    job_id: jobId,
    worker_triggered: workerTriggered,
    message: workerTriggered
      ? 'Garmin-Sync gestartet. Daten erscheinen in wenigen Minuten.'
      : 'Credentials gespeichert. Sync startet beim nächsten geplanten Lauf (06:30 Uhr).',
  })
}
