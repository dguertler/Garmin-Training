import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  // Stale "running" Jobs bereinigen (älter als 15 Min – entstehen bei Service-Restart)
  await query(
    "UPDATE sync_jobs SET status='failed', finished_at=NOW() WHERE user_id=$1 AND status='running' AND started_at < NOW() - INTERVAL '15 minutes'",
    [userId]
  )

  // Laufenden Sync prüfen – nicht doppelt starten
  const running = await queryOne<{ id: string }>(
    "SELECT id FROM sync_jobs WHERE user_id = $1 AND status = 'running' AND started_at > NOW() - INTERVAL '15 minutes'",
    [userId]
  )
  if (running) {
    return NextResponse.json({ error: 'Sync läuft bereits', job_id: running.id }, { status: 409 })
  }

  const jobs = await query<{ id: string }>(
    "INSERT INTO sync_jobs (user_id, job_type, status) VALUES ($1, 'manual', 'running') RETURNING id",
    [userId]
  )
  const jobId = jobs[0]?.id

  const workerUrl = process.env.SYNC_WORKER_URL
  if (workerUrl) {
    try {
      await fetch(`${workerUrl}/sync/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': process.env.SYNC_INTERNAL_KEY ?? '',
        },
        body: JSON.stringify({ user_id: userId, job_id: jobId }),
      })
    } catch (err) {
      console.error('Worker-Trigger fehlgeschlagen:', err)
    }
  }

  return NextResponse.json({ message: 'Sync gestartet', job_id: jobId })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jobs = await query(
    `SELECT id, job_type, status, started_at, finished_at,
            endpoints_total, endpoints_success, error_details
     FROM sync_jobs WHERE user_id = $1 ORDER BY started_at DESC LIMIT 5`,
    [session.user.id]
  )

  return NextResponse.json({ jobs })
}
