import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const branchesParam = searchParams.get('branches')

  if (!date || !branchesParam) {
    return NextResponse.json({}, { status: 400 })
  }

  const branchNames = branchesParam.split(',')
  const supabase = await createClient()

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, daily_cap')
    .in('name', branchNames)

  if (!branches) return NextResponse.json({})

  const { data: freezes } = await supabase
    .from('branch_freezes')
    .select('*')
    .lte('freeze_start', date)
    .gte('freeze_end', date)

  const { data: bookings } = await supabase
    .from('bookings')
    .select('branch_id, status')
    .eq('appointment_date', date)
    .neq('status', 'CANCELLED')

  const result: Record<string, unknown> = {}

  for (const branch of branches) {
    const frozen = freezes?.some(
      f => f.branch_id === null || f.branch_id === branch.id
    )
    const freeze = freezes?.find(
      f => f.branch_id === null || f.branch_id === branch.id
    )
    const booked = bookings?.filter(b => b.branch_id === branch.id).length ?? 0
    const cap = branch.daily_cap
    const confirmed =
      bookings?.filter(
        b => b.branch_id === branch.id && b.status === 'CONFIRMED'
      ).length ?? 0
    const onHold =
      bookings?.filter(
        b => b.branch_id === branch.id && b.status === 'ON-HOLD'
      ).length ?? 0

    result[branch.name] = {
      branch: branch.name,
      booked,
      capacity: cap,
      available: cap - booked,
      full: frozen || booked >= cap,
      freezeBlocked: frozen ?? false,
      freezeMessage: freeze?.reason ?? undefined,
      confirmed,
      onHold,
    }
  }

  return NextResponse.json(result)
}
