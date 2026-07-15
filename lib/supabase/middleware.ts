import { createServerClient } from '@supabase/ssr'
import { AuthApiError } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  try {
    await supabase.auth.getUser()
  } catch (error) {
    if (error instanceof AuthApiError && error.code === 'refresh_token_not_found') {
      await supabase.auth.signOut()
    } else {
      // Session refresh is best-effort: a transient Auth API failure must not
      // 500 every route. Page-level guards (requireUser) re-validate the user
      // and redirect to /login when there is genuinely no session.
      // eslint-disable-next-line no-console
      console.error('[middleware] session refresh failed:', error)
    }
  }

  return response
}
