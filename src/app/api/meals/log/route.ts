/**
 * GET  /api/meals/log?date=YYYY-MM-DD – Tageslog mit Summen
 * POST /api/meals/log – Mahlzeit loggen (aus Template oder manuell)
 * DELETE /api/meals/log?id=UUID – Eintrag löschen
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const [logs, target] = await Promise.all([
    query<{
      id: string
      meal_slot: string
      name: string
      calories: number
      protein_g: number
      carbs_g: number
      fat_g: number
      notes: string | null
      template_id: string | null
    }>(
      `SELECT id, meal_slot, name, calories, protein_g, carbs_g, fat_g, notes, template_id
       FROM meal_logs WHERE user_id = $1 AND log_date = $2
       ORDER BY meal_slot, created_at ASC`,
      [userId, date]
    ),
    // Kalorienbudget für diesen Tag
    queryOne<{ calories_target: number; protein_target_g: number; carbs_target_g: number; fat_target_g: number; is_training_day: boolean }>(
      `SELECT calories_target, protein_target_g, carbs_target_g, fat_target_g, is_training_day
       FROM nutrition_targets WHERE user_id = $1 AND target_date = $2`,
      [userId, date]
    ),
  ])

  // Summen berechnen
  const totals = logs.reduce(
    (sum, l) => ({
      calories: sum.calories + l.calories,
      protein_g: sum.protein_g + Number(l.protein_g),
      carbs_g: sum.carbs_g + Number(l.carbs_g),
      fat_g: sum.fat_g + Number(l.fat_g),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  return NextResponse.json({
    date,
    logs,
    totals,
    target: target ?? null,
    remaining: target ? {
      calories: target.calories_target - totals.calories,
      protein_g: Number(target.protein_target_g) - totals.protein_g,
      carbs_g: Number(target.carbs_target_g) - totals.carbs_g,
      fat_g: Number(target.fat_target_g) - totals.fat_g,
    } : null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { template_id, meal_slot, name, calories, protein_g, carbs_g, fat_g, notes, log_date } = body

  if (!meal_slot || !name || calories == null) {
    return NextResponse.json({ error: 'meal_slot, name, calories erforderlich' }, { status: 400 })
  }

  const date = log_date ?? new Date().toISOString().split('T')[0]

  // Bei Template-ID: Werte aus Template laden (wenn nicht überschrieben)
  let finalCalories = calories
  let finalProtein = protein_g ?? 0
  let finalCarbs = carbs_g ?? 0
  let finalFat = fat_g ?? 0

  if (template_id && (calories == null || protein_g == null)) {
    const tmpl = await queryOne<{ calories: number; protein_g: number; carbs_g: number; fat_g: number }>(
      `SELECT calories, protein_g, carbs_g, fat_g FROM meal_templates WHERE id = $1`,
      [template_id]
    )
    if (tmpl) {
      finalCalories = calories ?? tmpl.calories
      finalProtein = protein_g ?? tmpl.protein_g
      finalCarbs = carbs_g ?? tmpl.carbs_g
      finalFat = fat_g ?? tmpl.fat_g
    }
  }

  const rows = await query<{ id: string }>(
    `INSERT INTO meal_logs
       (user_id, log_date, template_id, meal_slot, name, calories, protein_g, carbs_g, fat_g, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [userId, date, template_id ?? null, meal_slot, name, finalCalories, finalProtein, finalCarbs, finalFat, notes ?? null]
  )

  return NextResponse.json({ ok: true, id: rows[0]?.id })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  await query(
    `DELETE FROM meal_logs WHERE id = $1 AND user_id = $2`,
    [id, userId]
  )

  return NextResponse.json({ ok: true })
}
