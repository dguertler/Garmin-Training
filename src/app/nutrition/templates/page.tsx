import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import MealTemplateLibrary from '@/components/MealTemplateLibrary'

export const metadata = { title: 'Mahlzeit-Templates' }

export default async function MealTemplatesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/nutrition" className="text-slate-400 hover:text-slate-200 text-sm">← Ernährung</Link>
        <h1 className="text-xl font-bold text-slate-100">Mahlzeit-Templates</h1>
      </div>
      <MealTemplateLibrary />
    </div>
  )
}
