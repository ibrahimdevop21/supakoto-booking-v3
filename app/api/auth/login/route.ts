import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    if (!username || !password) {
      return NextResponse.json(
        { error: 'اسم المستخدم وكلمة المرور مطلوبين' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const email = username.trim().toLowerCase().includes('@')
      ? username.trim().toLowerCase()
      : `${username.trim().toLowerCase()}@supakoto.org`

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.user) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو كلمة المرور غلط' },
        { status: 401 }
      )
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('id, name, role, is_active')
      .eq('user_id', data.user.id)
      .single()

    if (!agent || !agent.is_active) {
      return NextResponse.json(
        { error: 'الحساب غير مفعل، تواصل مع الإدارة' },
        { status: 403 }
      )
    }

    const res = NextResponse.json({
      id: agent.id,
      name: agent.name,
      role: agent.role,
    })
    const week = 60 * 60 * 24 * 7
    res.cookies.set('agent_role', String(agent.role ?? ''), {
      path: '/',
      maxAge: week,
      sameSite: 'lax',
    })
    res.cookies.set('agent_name', String(agent.name ?? ''), {
      path: '/',
      maxAge: week,
      sameSite: 'lax',
    })
    return res
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'حصل خطأ، حاول تاني' }, { status: 500 })
  }
}
