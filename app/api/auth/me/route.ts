import { NextResponse } from 'next/server'
import { formatAgentDisplayName } from '@/lib/agent-display-name'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    let supabase
    try {
      supabase = await createClient()
    } catch (e) {
      console.error('auth/me createClient:', e)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, role, is_active, branch_id')
      .eq('user_id', user.id)
      .single()

    if (!agent || !agent.is_active) {
      await supabase.auth.signOut()
      const res = NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
      res.cookies.delete('agent_role')
      res.cookies.delete('agent_name')
      return res
    }

    return NextResponse.json({
      ...agent,
      name: formatAgentDisplayName(agent.name),
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
