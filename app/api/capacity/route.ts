import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const branchId = searchParams.get('branchId')
    const date = searchParams.get('date')

    if (!branchId || !date) {
      return NextResponse.json({ error: 'branchId and date required' }, { status: 400 })
    }

    const supabase = createAnonClient()

    const { data: freezes } = await supabase
      .from('branch_freezes')
      .select('*')
      .lte('freeze_start', date)
      .gte('freeze_end', date)

    const frozen = freezes?.some(
      f => f.branch_id === null || f.branch_id === branchId
    )

    if (frozen) {
      const freeze = freezes?.find(
        f => f.branch_id === null || f.branch_id === branchId
      )
      return NextResponse.json({
        frozen: true,
        message: freeze?.reason || 'هذا الفرع لا يستقبل حجوزات في هذا التاريخ'
      })
    }

    const { data: branch } = await supabase
      .from('branches')
      .select('daily_cap')
      .eq('id', branchId)
      .single()

    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('branch_id', branchId)
      .eq('appointment_date', date)
      .eq('status', 'CONFIRMED')

    const booked = count ?? 0
    const cap = branch?.daily_cap ?? 0

    return NextResponse.json({
      frozen: false,
      cap,
      booked,
      available: cap - booked,
      full: booked >= cap,
    })
  } catch (err) {
    console.error('capacity GET:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
