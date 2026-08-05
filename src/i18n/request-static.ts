/**
 * Static i18n request config for GitHub Pages deployment.
 * Does NOT use cookies() — always returns default locale (es-PE).
 * The client-side locale switcher handles locale changes via window.location.reload().
 */
import { getRequestConfig } from 'next-intl/server'
import { defaultLocale } from './locale'

export default getRequestConfig(async () => {
  return {
    locale: defaultLocale,
    messages: (await import(`../../messages/${defaultLocale}.json`)).default,
    timeZone: 'America/Lima',
  }
})
