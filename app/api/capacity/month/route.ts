import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year')
    const month = searchParams.get('month')

    if (!year || !month) {
      return NextResponse.json({}, { status: 400 })
    }

    const supabase = createAnonClient()
    const startDate = `${year}-${month.padStart(2, '0')}-01`
    const endDate = new Date(Number(year), Number(month), 0)
      .toISOString()
      .slice(0, 10)

    const { data, error } = await supabase
      .from('bookings')
      .select('appointment_date, status')
      .gte('appointment_date', startDate)
      .lte('appointment_date', endDate)

    if (error) return NextResponse.json({}, { status: 500 })

    const result: Record<
      string,
      { confirmed: number; onHold: number; cancelled: number }
    > = {}

    for (const booking of data ?? []) {
      const d = booking.appointment_date as string
      if (!result[d])
        result[d] = { confirmed: 0, onHold: 0, cancelled: 0 }
      if (booking.status === 'CONFIRMED') result[d].confirmed++
      else if (booking.status === 'ON-HOLD') result[d].onHold++
      else if (booking.status === 'CANCELLED') result[d].cancelled++
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('capacity/month GET:', err)
    return NextResponse.json({}, { status: 500 })
  }
}
