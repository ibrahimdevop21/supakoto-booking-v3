import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('technicians')
      .select('*, branches(name)')
      .order('level')
      .order('name')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const service = createServiceClient()
    const { data, error } = await service
      .from('technicians')
      .insert(body)
      .select('*, branches(name)')
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
