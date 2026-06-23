/**
 * GET /api/push/vapid-public-key – VAPID Public Key für Browser-Subscription
 */
import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) {
    return NextResponse.json({ error: 'VAPID nicht konfiguriert' }, { status: 503 })
  }
  return NextResponse.json({ publicKey: key })
}
