import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('branch_freezes')
      .select('*, branches(name)')
      .order('freeze_start', { ascending: false })
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
      .from('branch_freezes')
      .insert(body)
      .select('*, branches(name)')
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    const service = createServiceClient()
    const { error } = await service
      .from('branch_freezes')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
