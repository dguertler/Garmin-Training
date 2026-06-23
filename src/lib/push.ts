import webpush from 'web-push'
import { query } from '@/lib/db'

let initialized = false

function initVapid() {
  if (initialized) return
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com'
  if (!pub || !priv) return
  webpush.setVapidDetails(subject, pub, priv)
  initialized = true
}

export type PushType = 'deload' | 'neat'

interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  url?: string
}

// Sendet Push an alle Subscriptions eines Users; löscht invalide Subscriptions
// throttleColumn: einmal pro Tag maximal
async function sendToUser(userId: string, payload: PushPayload, throttleColumn: 'last_deload_notified_at' | 'last_neat_notified_at') {
  initVapid()
  if (!initialized) return

  const subs = await query<{
    id: string
    endpoint: string
    p256dh: string
    auth: string
    last_deload_notified_at: string | null
    last_neat_notified_at: string | null
  }>(
    `SELECT id, endpoint, p256dh, auth, last_deload_notified_at, last_neat_notified_at
     FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  )

  const today = new Date().toISOString().split('T')[0]

  for (const sub of subs) {
    // Bereits heute benachrichtigt → überspringen
    const lastSent = sub[throttleColumn]
    if (lastSent && lastSent.split('T')[0] === today) continue

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 86400 }
      )
      await query(
        `UPDATE push_subscriptions SET ${throttleColumn} = NOW(), updated_at = NOW() WHERE id = $1`,
        [sub.id]
      )
    } catch (err: unknown) {
      // 410 Gone = Subscription abgelaufen → löschen
      if (err && typeof err === 'object' && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
        await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id])
      }
    }
  }
}

export async function sendDeloadNotification(userId: string, reason: string) {
  await sendToUser(userId, {
    title: 'Deload-Woche empfohlen',
    body: reason,
    icon: '/icon-192.png',
    url: '/dashboard',
  }, 'last_deload_notified_at')
}

export async function sendNeatNotification(userId: string, stepsAvg: number, stepsGoal: number) {
  await sendToUser(userId, {
    title: 'NEAT zu niedrig',
    body: `Schritt-Durchschnitt ${Math.round(stepsAvg).toLocaleString('de-DE')} – Ziel ${stepsGoal.toLocaleString('de-DE')}. Mehr Bewegung im Alltag hilft beim Cut.`,
    icon: '/icon-192.png',
    url: '/dashboard',
  }, 'last_neat_notified_at')
}
