'use server'

import { cookies } from 'next/headers'
import { isLocale, type Locale } from '@/i18n/locale'

/**
 * Server Action — sets the NEXT_LOCALE cookie, then the client calls
 * `router.refresh()` to re-render server components with the new locale.
 * No full page reload — client state (active tab, live ML feed) is preserved.
 */
export async function setLocale(next: Locale) {
  if (!isLocale(next)) return
  const store = await cookies()
  store.set('NEXT_LOCALE', next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })
}
