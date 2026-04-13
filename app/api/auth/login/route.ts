import { NextRequest, NextResponse } from 'next/server'
import { formatAgentDisplayName } from '@/lib/agent-display-name'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const username = typeof body.username === 'string' ? body.username : ''
    const agentId = typeof body.agentId === 'string' ? body.agentId : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!password) {
      return NextResponse.json(
        { error: 'كلمة المرور مطلوبة' },
        { status: 400 }
      )
    }

    if (!username.trim() && !agentId.trim()) {
      return NextResponse.json(
        { error: 'اسم المستخدم أو اختيار المندوب مطلوب' },
        { status: 400 }
      )
    }

    let supabase
    try {
      supabase = await createClient()
    } catch (e) {
      console.error('auth/login createClient:', e)
      return NextResponse.json(
        { error: 'حصل خطأ، حاول تاني' },
        { status: 500 }
      )
    }

    let emailToUse: string

    if (agentId.trim()) {
      const { data: agentRow, error: agentErr } = await supabase
        .from('agents')
        .select('id, name, role, is_active, username, user_id')
        .eq('id', agentId.trim())
        .single()

      if (agentErr || !agentRow) {
        return NextResponse.json(
          { error: 'الحساب غير موجود' },
          { status: 404 }
        )
      }

      if (!agentRow.is_active) {
        return NextResponse.json(
          { error: 'الحساب غير مفعل، تواصل مع الإدارة' },
          { status: 403 }
        )
      }

      const u = agentRow.username?.trim().toLowerCase()
      if (!u) {
        return NextResponse.json(
          { error: 'الحساب غير مكتمل — شغّل SQL لحقل username' },
          { status: 400 }
        )
      }

      emailToUse = `${u}@supakoto.org`
    } else {
      emailToUse = username.trim().toLowerCase().includes('@')
        ? username.trim().toLowerCase()
        : `${username.trim().toLowerCase()}@supakoto.org`
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
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

    if (agentId.trim() && agent.id !== agentId.trim()) {
      return NextResponse.json(
        { error: 'الجلسة لا تطابق المندوب' },
        { status: 403 }
      )
    }

    const displayName = formatAgentDisplayName(agent.name)
    const res = NextResponse.json({
      id: agent.id,
      name: displayName,
      role: agent.role,
    })
    const week = 60 * 60 * 24 * 7
    res.cookies.set('agent_role', String(agent.role ?? ''), {
      path: '/',
      maxAge: week,
      sameSite: 'lax',
    })
    res.cookies.set('agent_name', displayName, {
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
