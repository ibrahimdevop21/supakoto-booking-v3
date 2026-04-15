import { NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = createAnonClient()
    const query = `
        id,
        customer_phone,
        appointment_date,
        created_at,
        attempted_by,
        existing_agent,
        existing_booking_id,
        branch_id
      `
    const { data, error } = await supabase
      .from('duplicate_log')
      .select(query)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) {
      // Fallback for environments where anon RLS cannot read duplicate_log.
      const service = createServiceClient()
      const { data: serviceData, error: serviceError } = await service
        .from('duplicate_log')
        .select(query)
        .order('created_at', { ascending: false })
        .limit(100)
      if (serviceError) throw serviceError
      return NextResponse.json(serviceData ?? [])
    }
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
