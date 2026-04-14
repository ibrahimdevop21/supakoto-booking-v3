import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'agentId required' }, { status: 400 })
    }

    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('bookings')
      .select('*, branches(name)')
      .eq('agent_id', agentId)
      .order('appointment_date', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('my-bookings GET:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
