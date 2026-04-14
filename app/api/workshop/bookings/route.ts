import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const branchId = searchParams.get('branchId')

  if (!date) return NextResponse.json([], { status: 400 })

  const supabase = createAnonClient()

  let q = supabase
    .from('bookings')
    .select(`
      id, customer_name, customer_phone, car_model,
      service, addons, notes, amount, status,
      branch_id, agent_id,
      branches(name),
      agents(name)
    `)
    .eq('appointment_date', date)
    .neq('status', 'CANCELLED')

  if (branchId) q = q.eq('branch_id', branchId)

  const { data: bookings, error } = await q
  if (error) return NextResponse.json([], { status: 500 })

  const { data: jobs } = await supabase
    .from('workshop_jobs')
    .select('booking_id')
    .eq('appointment_date', date)
    .not('booking_id', 'is', null)

  const existingBookingIds = new Set(
    (jobs ?? []).map((j) => j.booking_id as string)
  )

  const pending = (bookings ?? []).filter(
    (b) => !existingBookingIds.has(b.id)
  )

  return NextResponse.json(pending)
}
