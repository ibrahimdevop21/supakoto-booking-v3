import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const role = request.cookies.get('agent_role')?.value

  // Not logged in — redirect to login
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

  // Logged in — redirect away from login
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/booking'
    return NextResponse.redirect(url)
  }

  // Role-based protection
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

  // Root redirect
  if (pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/booking'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
