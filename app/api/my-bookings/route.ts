import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const agentId = searchParams.get('agentId')

  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('*, branches(name)')
    .eq('agent_id', agentId)
    .order('appointment_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
