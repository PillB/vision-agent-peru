'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Languages } from 'lucide-react'
import { prefixPath } from '@/lib/path-utils'
import { Button } from '@/components/ui/button'
import { localeLabels, type Locale, getOtherLocale } from '@/i18n/locale'

/**
 * Language toggle — switches between English (en) and Peruvian Spanish (es-PE).
 *
 * STRATEGY:
 *   1. POST to /api/set-locale to set the NEXT_LOCALE cookie server-side.
 *   2. Call window.location.reload() to force a full browser navigation.
 *
 * WHY NOT router.refresh():
 *   router.refresh() only re-fetches the RSC payload via fetch(). In some
 *   preview gateways, the cookie set by the API route is NOT sent with
 *   that fetch, so the server still renders the old locale. A full page
 *   reload (window.location.reload()) guarantees the browser sends the
 *   new cookie with the request.
 *
 * WHY NOT a Server Action:
 *   Server Actions require the `Next-Action` header which is stripped by
 *   some preview gateways, causing "Invalid Server Actions request" crashes.
 *
 * The trade-off of a full reload (losing client state like the active tab
 * or live ML feed) is acceptable because language switching is an explicit,
 * infrequent user action.
 */
export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const current = useLocale() as Locale
  const [isPending, startTransition] = useTransition()
  const next = getOtherLocale(current)

  async function onToggle() {
    startTransition(async () => {
      try {
        const res = await fetch(prefixPath('/api/set-locale'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: next }),
        })
        if (!res.ok) {
          console.error('[LocaleSwitcher] failed to set locale:', await res.text())
          return
        }
        // Full page reload — guarantees the browser sends the new cookie.
        // This is more robust than router.refresh() in preview gateways.
        window.location.reload()
      } catch (err) {
        console.error('[LocaleSwitcher] error:', err)
        // Fallback: try navigate to root with query param to force reload
        window.location.href = '/'
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      disabled={isPending}
      className="gap-1.5 h-8 px-2 text-xs"
      title={t('switching')}
    >
      <Languages className="h-3.5 w-3.5" />
      <span className="font-medium">
        {isPending ? t('switching') : localeLabels[next].native}
      </span>
    </Button>
  )
}
