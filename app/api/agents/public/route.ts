import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatAgentDisplayName } from '@/lib/agent-display-name'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from('agents')
      .select('id, name, username')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('agents/public error:', error)
      return NextResponse.json([], { status: 500 })
    }

    const rows = data ?? []
    return NextResponse.json(
      rows.map((a: { id: string; name: string; username?: string | null }) => ({
        id: a.id,
        name: formatAgentDisplayName(a.name),
        username: a.username ?? null,
      }))
    )
  } catch (err) {
    console.error('agents/public fatal:', err)
    return NextResponse.json([], { status: 500 })
  }
}
