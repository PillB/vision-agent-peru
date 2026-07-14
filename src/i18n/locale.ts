/**
 * Locale configuration — supports English (en) and Peruvian Spanish (es-PE).
 *
 * Uses the full BCP-47 tag `es-PE` (not bare `es`) so native Intl.*Format
 * picks up Peru CLDR data: currency PEN (S/), dates d/MM/yy, AM/PM lowercase
 * "a. m."/"p. m.", timezone America/Lima (UTC-5, no DST).
 */

export const locales = ['en', 'es-PE'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'

export const localeLabels: Record<Locale, { native: string; english: string; flag: string }> = {
  'en':    { native: 'English',      english: 'English',         flag: '🇺🇸' },
  'es-PE': { native: 'Español',      english: 'Spanish (Peru)',  flag: '🇵🇪' },
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value)
}

export function getOtherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'es-PE' : 'en'
}
