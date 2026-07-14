/**
 * /api/set-locale — Sets the NEXT_LOCALE cookie via a plain API route.
 *
 * Replaces the Server Action `setLocale` which crashed with "Invalid Server
 * Actions request" in preview environments where the gateway strips the
 * `Next-Action` header. API routes don't depend on that header infrastructure.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isLocale, type Locale } from '@/i18n/locale'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const locale = body?.locale as string

    if (!isLocale(locale)) {
      return NextResponse.json(
        { error: `Invalid locale: ${locale}. Must be one of: en, es-PE` },
        { status: 400 }
      )
    }

    const res = NextResponse.json({ ok: true, locale })
    res.cookies.set('NEXT_LOCALE', locale as Locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      httpOnly: false,
    })
    return res
  } catch (err) {
    console.error('[/api/set-locale] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
