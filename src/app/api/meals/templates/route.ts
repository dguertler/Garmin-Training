/**
 * GET  /api/meals/templates – Alle Mahlzeit-Templates
 * POST /api/meals/templates – Neues Template anlegen
 * DELETE via query param: /api/meals/templates?id=...
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query, queryOne } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type') // 'training' | 'rest' | null
  const slot = req.nextUrl.searchParams.get('slot')  // meal slot filter

  const conditions: string[] = ['(user_id = $1 OR user_id IS NULL)']
  const params: unknown[] = [userId]

  if (type) {
    params.push(type)
    conditions.push(`meal_type = $${params.length}`)
  }
  if (slot) {
    params.push(slot)
    conditions.push(`meal_slot = $${params.length}`)
  }

  const templates = await query<{
    id: string
    name: string
    meal_type: string
    meal_slot: string
    calories: number
    protein_g: number
    carbs_g: number
    fat_g: number
    ingredients: unknown
    prep_notes: string | null
    user_id: string | null
  }>(
    `SELECT id, name, meal_type, meal_slot, calories, protein_g, carbs_g, fat_g, ingredients, prep_notes, user_id
     FROM meal_templates
     WHERE ${conditions.join(' AND ')}
     ORDER BY meal_slot, name`,
    params
  )

  return NextResponse.json({ templates })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, meal_type, meal_slot, calories, protein_g, carbs_g, fat_g, ingredients, prep_notes } = body

  if (!name || !meal_type || !meal_slot || calories == null) {
    return NextResponse.json({ error: 'name, meal_type, meal_slot, calories erforderlich' }, { status: 400 })
  }

  const result = await query<{ id: string }>(
    `INSERT INTO meal_templates (user_id, name, meal_type, meal_slot, calories, protein_g, carbs_g, fat_g, ingredients, prep_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10)
     RETURNING id`,
    [
      userId, name, meal_type, meal_slot,
      calories, protein_g ?? 0, carbs_g ?? 0, fat_g ?? 0,
      ingredients ? JSON.stringify(ingredients) : '[]',
      prep_notes ?? null,
    ]
  )

  return NextResponse.json({ ok: true, id: result[0].id })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id erforderlich' }, { status: 400 })

  // Nur eigene Templates löschen
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM meal_templates WHERE id = $1 AND user_id = $2',
    [id, userId]
  )
  if (!existing) return NextResponse.json({ error: 'Nicht gefunden oder keine Berechtigung' }, { status: 404 })

  await query('DELETE FROM meal_templates WHERE id = $1', [id])
  return NextResponse.json({ ok: true })
}
