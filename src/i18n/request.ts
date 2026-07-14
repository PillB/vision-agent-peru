/**
 * next-intl request config — reads locale from a cookie (no locale-based routing).
 *
 * This is the officially-supported "without locale-based routing" pattern from
 * next-intl docs: single route `/`, locale stored in `NEXT_LOCALE` cookie,
 * toggled via a Server Action + `router.refresh()`.
 */

import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale, isLocale } from './locale'

export default getRequestConfig(async () => {
  const store = await cookies()
  const cookieLocale = store.get('NEXT_LOCALE')?.value
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: 'America/Lima',
    now: new Date(),
  }
})
