/**
 * GET /api/export/full – Alle User-Daten als JSON (ZIP via native streams)
 *
 * Gibt eine ZIP-Datei zurück mit:
 *   - profile.json
 *   - daily_input.json
 *   - readiness.json
 *   - strength_logs.json
 *   - meal_logs.json
 *   - garmin_metrics.json
 */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

// Minimal ZIP builder – no external dependency
// ZIP local file header format (stored/no compression)
function uint16LE(n: number) {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff])
}
function uint32LE(n: number) {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff])
}

function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function buildZip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder()
  const localHeaders: Uint8Array[] = []
  const offsets: number[] = []
  let offset = 0

  for (const file of files) {
    offsets.push(offset)
    const nameBytes = enc.encode(file.name)
    const crc = crc32(file.data)
    // Local file header
    const lh = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, // signature
      0x14, 0x00,              // version needed
      0x00, 0x00,              // flags
      0x00, 0x00,              // compression: stored
      0x00, 0x00, 0x00, 0x00, // mod time + date
      ...uint32LE(crc),
      ...uint32LE(file.data.length),
      ...uint32LE(file.data.length),
      ...uint16LE(nameBytes.length),
      0x00, 0x00,              // extra field length
      ...nameBytes,
    ])
    const entry = new Uint8Array(lh.length + file.data.length)
    entry.set(lh)
    entry.set(file.data, lh.length)
    localHeaders.push(entry)
    offset += entry.length
  }

  // Central directory
  const centralDir: Uint8Array[] = []
  const enc2 = new TextEncoder()
  for (let i = 0; i < files.length; i++) {
    const nameBytes = enc2.encode(files[i].name)
    const crc = crc32(files[i].data)
    const cd = new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, // signature
      0x14, 0x00, 0x14, 0x00, // versions
      0x00, 0x00,
      0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      ...uint32LE(crc),
      ...uint32LE(files[i].data.length),
      ...uint32LE(files[i].data.length),
      ...uint16LE(nameBytes.length),
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...uint32LE(offsets[i]),
      ...nameBytes,
    ])
    centralDir.push(cd)
  }

  const cdSize = centralDir.reduce((s, b) => s + b.length, 0)
  const cdOffset = offset

  const eocd = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, // signature
    0x00, 0x00, 0x00, 0x00,
    ...uint16LE(files.length),
    ...uint16LE(files.length),
    ...uint32LE(cdSize),
    ...uint32LE(cdOffset),
    0x00, 0x00,
  ])

  const totalSize = offset + cdSize + eocd.length
  const zip = new Uint8Array(totalSize)
  let pos = 0
  for (const lh of localHeaders) { zip.set(lh, pos); pos += lh.length }
  for (const cd of centralDir) { zip.set(cd, pos); pos += cd.length }
  zip.set(eocd, pos)

  return zip
}

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const enc = new TextEncoder()

  const [profile, dailyInput, readiness, strengthLogs, strengthSets, mealLogs, garminMetrics] = await Promise.all([
    queryOne(
      `SELECT up.*, u.name, u.email FROM user_profiles up JOIN users u ON u.id = up.user_id WHERE up.user_id = $1`,
      [userId]
    ),
    query(
      `SELECT entry_date, weight_kg, body_fat_pct, lean_mass_kg, bmr_kcal, tdee_kcal_estimated,
              total_steps, sleep_hours, alcohol_units, notes
       FROM daily_input WHERE user_id = $1 ORDER BY entry_date DESC`,
      [userId]
    ),
    query(
      `SELECT plan_date, readiness_score, readiness_level, scheduled_workout_type,
              recommended_workout_type, workout_status, hrv_vs_baseline_pct,
              sleep_score, body_battery_morning
       FROM daily_readiness WHERE user_id = $1 ORDER BY plan_date DESC`,
      [userId]
    ),
    query(
      `SELECT id, session_date, workout_type, total_volume_kg, session_notes, readiness_score
       FROM strength_logs WHERE user_id = $1 ORDER BY session_date DESC`,
      [userId]
    ),
    query(
      `SELECT sl.session_date, sl.workout_type, ss.exercise_name, ss.set_number,
              ss.weight_kg, ss.reps, ss.rir, ss.notes
       FROM strength_sets ss
       JOIN strength_logs sl ON sl.id = ss.session_id
       WHERE sl.user_id = $1 ORDER BY sl.session_date DESC, ss.set_number`,
      [userId]
    ),
    query(
      `SELECT log_date, meal_slot, name, calories, protein_g, carbs_g, fat_g, notes
       FROM meal_logs WHERE user_id = $1 ORDER BY log_date DESC, meal_slot`,
      [userId]
    ),
    query(
      `SELECT metric_date, training_readiness_score, sleep_score, sleep_duration_seconds,
              body_battery_morning, hrv_last_night, vo2max, resting_heart_rate
       FROM garmin_raw_metrics WHERE user_id = $1 ORDER BY metric_date DESC LIMIT 365`,
      [userId]
    ),
  ])

  const exportDate = new Date().toISOString()
  const files = [
    { name: 'export_info.json', data: enc.encode(JSON.stringify({ export_date: exportDate, user_id: userId }, null, 2)) },
    { name: 'profile.json', data: enc.encode(JSON.stringify(profile, null, 2)) },
    { name: 'daily_input.json', data: enc.encode(JSON.stringify(dailyInput, null, 2)) },
    { name: 'readiness.json', data: enc.encode(JSON.stringify(readiness, null, 2)) },
    { name: 'strength_logs.json', data: enc.encode(JSON.stringify(strengthLogs, null, 2)) },
    { name: 'strength_sets.json', data: enc.encode(JSON.stringify(strengthSets, null, 2)) },
    { name: 'meal_logs.json', data: enc.encode(JSON.stringify(mealLogs, null, 2)) },
    { name: 'garmin_metrics.json', data: enc.encode(JSON.stringify(garminMetrics, null, 2)) },
  ]

  const zip = buildZip(files)
  const filename = `training-export-${exportDate.split('T')[0]}.zip`

  return new NextResponse(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': zip.length.toString(),
    },
  })
}
