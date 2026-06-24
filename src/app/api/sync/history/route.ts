import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryOne } from '@/lib/db'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id

  const workerUrl = process.env.SYNC_WORKER_URL
  if (!workerUrl) {
    return NextResponse.json({ error: 'Sync-Worker nicht konfiguriert' }, { status: 503 })
  }

  const profile = await queryOne<{ garmin_username: string | null }>(
    'SELECT garmin_username FROM user_profiles WHERE user_id = $1',
    [userId]
  )

  try {
    await fetch(`${workerUrl}/sync/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env.SYNC_INTERNAL_KEY ?? '',
      },
      body: JSON.stringify({
        user_id: userId,
        garmin_email: profile?.garmin_username,
        days: 60,
      }),
    })
  } catch (err) {
    console.error('History-Sync-Trigger fehlgeschlagen:', err)
    return NextResponse.json({ error: 'Sync-Worker nicht erreichbar' }, { status: 502 })
  }

  return NextResponse.json({ ok: true, message: 'History-Sync gestartet (letzte 60 Tage)' })
}
