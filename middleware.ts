import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl?.trim() || !supabaseAnonKey?.trim()) {
    console.error(
      '[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, responseHeaders) {
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          if (responseHeaders && typeof responseHeaders === 'object') {
            Object.entries(responseHeaders).forEach(([key, value]) => {
              if (typeof value === 'string') {
                supabaseResponse.headers.set(key, value)
              }
            })
          }
        },
      },
    })

    let user: User | null = null
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch (authErr) {
      console.error('[middleware] getUser failed:', authErr)
    }

    const pathname = request.nextUrl.pathname
    const role = request.cookies.get('agent_role')?.value

    if (
      !user &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/_next') &&
      !pathname.startsWith('/api')
    ) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (user && pathname.startsWith('/login')) {
      const url = request.nextUrl.clone()
      url.pathname = '/booking'
      return NextResponse.redirect(url)
    }

    if (user && pathname.startsWith('/ops')) {
      const r = role?.toLowerCase() ?? ''
      const canOps =
        r === 'ops' || r === 'admin' || role === 'أدمن'
      if (!canOps) {
        const url = request.nextUrl.clone()
        url.pathname = '/booking'
        return NextResponse.redirect(url)
      }
    }

    if (user && role) {
      if (role === 'agent') {
        if (
          pathname.startsWith('/ops') ||
          pathname.startsWith('/admin')
        ) {
          const url = request.nextUrl.clone()
          url.pathname = '/booking'
          return NextResponse.redirect(url)
        }
      }

      if (role === 'ops') {
        if (pathname.startsWith('/admin')) {
          const url = request.nextUrl.clone()
          url.pathname = '/ops'
          return NextResponse.redirect(url)
        }
      }
    }

    if (pathname === '/') {
      const url = request.nextUrl.clone()
      url.pathname = '/booking'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  } catch (e) {
    console.error('[middleware]', e)
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
