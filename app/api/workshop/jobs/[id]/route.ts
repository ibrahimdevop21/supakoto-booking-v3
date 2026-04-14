import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const supabase = createAnonClient()

    const updates: Record<string, unknown> = { ...body }
    if (body.status === 'RECEIVED' && !body.received_at) {
      updates.received_at = new Date().toISOString()
    }
    if (body.status === 'DELIVERED' && !body.delivered_at) {
      updates.delivered_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('workshop_jobs')
      .update(updates)
      .eq('id', id)
      .select(`*, branches(name)`)
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAnonClient()
    const { error } = await supabase
      .from('workshop_jobs')
      .delete()
      .eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
