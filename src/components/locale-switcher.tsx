'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setLocale } from '@/app/actions/set-locale'
import { localeLabels, type Locale, getOtherLocale } from '@/i18n/locale'

/**
 * Language toggle — switches between English (en) and Peruvian Spanish (es-PE).
 *
 * Uses a Server Action to set the NEXT_LOCALE cookie, then `router.refresh()`
 * to re-render server components with the new locale. No full page reload —
 * client state (active tab, live ML feed, agent loop) is preserved.
 */
export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const current = useLocale() as Locale
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const next = getOtherLocale(current)

  function onToggle() {
    startTransition(async () => {
      await setLocale(next)
      router.refresh()
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
