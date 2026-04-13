import { NextResponse } from 'next/server'
import { createAnonClient } from '@/lib/supabase/anon'

export async function GET() {
  try {
    const supabase = createAnonClient()
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
    if (error) return NextResponse.json([], { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('branches GET:', err)
    return NextResponse.json([], { status: 500 })
  }
}
