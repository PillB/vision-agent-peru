'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { localeLabels, type Locale, getOtherLocale } from '@/i18n/locale'

/**
 * Language toggle — switches between English (en) and Peruvian Spanish (es-PE).
 *
 * Uses a plain API route (POST /api/set-locale) to set the NEXT_LOCALE cookie,
 * then `router.refresh()` to re-render server components with the new locale.
 *
 * We use an API route instead of a Server Action because Server Actions
 * require the `Next-Action` header which is stripped by some preview gateways,
 * causing "Invalid Server Actions request" crashes. API routes are robust.
 *
 * No full page reload — client state (active tab, live ML feed, agent loop)
 * is preserved via router.refresh() which only re-runs Server Components.
 */
export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const current = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const next = getOtherLocale(current)

  async function onToggle() {
    startTransition(async () => {
      try {
        const res = await fetch('/api/set-locale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locale: next }),
        })
        if (!res.ok) {
          console.error('[LocaleSwitcher] failed to set locale:', await res.text())
          return
        }
        router.refresh()
      } catch (err) {
        console.error('[LocaleSwitcher] error:', err)
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
