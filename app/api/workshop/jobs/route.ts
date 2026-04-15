import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const branchId = searchParams.get('branchId')

  const supabase = createAnonClient()

  let q = supabase
    .from('workshop_jobs')
    .select(`
      *,
      branches(name),
      bookings(customer_name, customer_phone, service, addons, agents(name))
    `)
    .order('created_at', { ascending: true })

  if (date) q = q.eq('appointment_date', date)
  if (branchId) q = q.eq('branch_id', branchId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('workshop_jobs')
      .insert(body)
      .select(`*, branches(name)`)
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
