import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    const res = NextResponse.json({ success: true })
    res.cookies.delete('agent_role')
    res.cookies.delete('agent_name')
    return res
  } catch (err) {
    console.error('logout:', err)
    const res = NextResponse.json({ error: 'Server error' }, { status: 500 })
    res.cookies.delete('agent_role')
    res.cookies.delete('agent_name')
    return res
  }
}
