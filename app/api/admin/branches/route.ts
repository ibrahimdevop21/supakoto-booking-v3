import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .order('name')
    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json()
    const service = createServiceClient()
    const { data, error } = await service
      .from('branches')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
