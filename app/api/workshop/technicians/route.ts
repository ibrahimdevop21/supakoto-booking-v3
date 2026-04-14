import { NextRequest, NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const branchId = searchParams.get('branchId')
  const supabase = createAnonClient()

  let q = supabase
    .from('technicians')
    .select('*')
    .eq('is_active', true)
    .order('level', { ascending: true })
    .order('name', { ascending: true })

  if (branchId) {
    q = q.or(`branch_id.eq.${branchId},branch_id.is.null`)
  }

  const { data, error } = await q
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('technicians')
      .insert(body)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
