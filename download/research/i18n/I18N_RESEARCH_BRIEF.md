# i18n Research Brief — Vision Agent (Peru) EN + es-PE

**Task ID:** i18n-research
**Agent:** Research Scout (i18n)
**Scope:** Robust multi-language (English + Peruvian Spanish) for a Next.js 16 App Router SPA, **single `/` route, client-side language toggle (no `/en/` + `/es/` URL prefixes)**.
**Installed dep:** `next-intl@^4.3.4` (already in `package.json`).

---

## 1. TL;DR — Recommended Approach

| Decision | Recommendation |
|---|---|
| **Library** | **`next-intl` v4** (already installed). It officially supports a "no locale-based routing" mode that fits our single-`/` SPA perfectly. No need to switch to react-i18next or react-intl. |
| **Routing** | **None.** Do NOT create `[locale]/` segments. Do NOT add `proxy.ts`/`middleware.ts`. The locale lives in a **cookie** (`NEXT_LOCALE`) read by `i18n/request.ts` via `cookies()`. |
| **State mechanism** | Server-side: `cookies()` in `getRequestConfig`. Client-side: `NextIntlClientProvider` wraps `<body>` (auto-inherits `locale` + `messages` from server config in v4). |
| **Toggle UX** | Client `LocaleSwitcher` component calls a **Server Action** that sets the `NEXT_LOCALE` cookie, then calls `router.refresh()` from `next/navigation`. No full page reload, no URL change. |
| **Locales** | `en` (default) + `es-PE` (Peruvian Spanish). Use the full BCP-47 tag `es-PE` so `Intl.NumberFormat` / `Intl.DateTimeFormat` pick up Peru-specific number/date/currency formats automatically. |
| **Message files** | `messages/en.json` + `messages/es-PE.json`, nested by feature namespace (e.g. `tab1.hero.title`), one JSON file per locale. |
| **Plurals/gender** | Use **ICU MessageFormat** (built into next-intl, no extra dep). Spanish has the same `one`/`other` plural rules as English, so plurals are low-risk. |
| **Dates/numbers/currency** | Use next-intl `useFormatter()` → wraps native `Intl.*Format` with the active locale. PEN currency (`S/`), `dd/MM/yy` short dates, lowercase `a. m.`/`p. m.` all come for free from CLDR when locale = `es-PE`. |
| **Layout safeguards** | Plan for **+30% text width** (EN→ES typically expands 15-25%; 30% is a safe ceiling). Use `min-w-0` on flex children, `truncate`/`line-clamp-n` with tooltip fallback, `text-wrap: balance` for headings, logical properties (`ps-`/`pe-` instead of `pl-`/`pr-`) — even though es-PE is LTR, logical properties future-proof and read better in flex contexts. |

---

## 2. Library Comparison — why next-intl is the right choice for this project

| Library | App Router fit | RSC support | ICU | Bundle | Cookie-mode (no routing) | Verdict for Vision Agent |
|---|---|---|---|---|---|---|
| **next-intl v4** | Native (designed for it) | First-class (`getTranslations` server, `useTranslations` shared) | Built-in | Small | **Officially supported** (`getRequestConfig` + `cookies()`) | ✅ **Use this.** Already installed. |
| react-i18next / next-i18next | Works but next-i18next middleware is built around locale-prefixed routing; `next-i18next` is more App-Router-awkward | OK via `initReactI18next` | Via plugin | Heavier (i18next core + react bindings) | Possible but you fight the framework | ❌ Overkill. Loses next-intl's RSC/`cookies()` ergonomics. |
| react-intl (FormatJS) | Framework-agnostic, works | OK | Native (it IS the ICU reference impl) | Medium | Manual (you wire your own context + cookie) | ❌ More plumbing; you'd reinvent what next-intl gives for free. |
| Intlayer | New, interesting (per-component dictionaries) | Yes | Yes | Small | Yes | ⚠️ Promising but smaller community; stick with the battle-tested next-intl for v1. |

**Community consensus (Reddit r/nextjs, SimpleLocalize, dev.to 10-language case study):** "next-intl is the sweet spot for App Router and RSC" (Reddit r/SaaS). The dev.to case study (TaleForge, 10 languages, 1,326 keys on Next.js 16) chose next-intl for "server components, namespaced messages, and per-locale pluralization."

---

## 3. The key insight — next-intl's "Without locale-based routing" mode

From the official next-intl docs (`/docs/usage/configuration` + `/docs/getting-started/app-router`):

> **Without locale-based routing:** You can change the locale by updating the value where the locale is read from (e.g. a cookie, a user setting, etc.).
>
> **Provide a locale.** If your app doesn't require unique pathnames per locale, you can provide a locale to next-intl based on user preferences or other application logic. **The simplest option is to use a cookie.**

This is the exact pattern for our SPA. The setup is dramatically simpler than the locale-prefixed-routing tutorial most people follow:

- ❌ No `[locale]/` dynamic segment
- ❌ No `proxy.ts` (formerly `middleware.ts` in Next.js ≤15)
- ❌ No `i18n/routing.ts`, no `i18n/navigation.ts`
- ✅ Just `i18n/request.ts` (reads cookie), `NextIntlClientProvider` in layout, message JSON files.

### Next.js 16 / next-intl v4 gotchas to bake in from day one

Source: buildwithmatija.com "Fix next-intl in Next.js 16" + official v4 release notes.

1. **`NextIntlClientProvider` is now REQUIRED in v4** (was optional in v3). Any client component calling `useTranslations` without a provider above it throws `Failed to call 'useTranslations' because the context from 'NextIntlClientProvider' was not found.`
2. **`getRequestConfig` must return `locale` explicitly** (was optional in v3). If you omit it, you get the infamous "Unable to find next-intl locale" error.
3. **`NextIntlClientProvider` auto-inherits `locale` + `messages` + `formats` + `now` + `timeZone` from the server config** in v4. You do NOT need to pass them as props if the provider is rendered from a Server Component (which our root layout is).
4. **`middleware.ts` → `proxy.ts` rename in Next.js 16.** Irrelevant for us because we're not using middleware — but if anyone later adds locale-prefixed routing, this is the trap.

---

## 4. Recommended code pattern — minimal, production-ready

### 4.1 File layout (additions to existing project)

```
messages/
  en.json
  es-PE.json
src/
  i18n/
    request.ts          ← server config (reads cookie)
    locale.ts           ← shared constants (locales, default)
  app/
    layout.tsx          ← wrap <body> with NextIntlClientProvider
    actions/
      set-locale.ts     ← Server Action: writes cookie
  components/
    locale-switcher.tsx ← client toggle button
```

### 4.2 `src/i18n/locale.ts`

```ts
export const locales = ['en', 'es-PE'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Human label for the switcher, shown in the OTHER locale. */
export const localeLabels: Record<Locale, { native: string; english: string }> = {
  'en':   { native: 'English',  english: 'English' },
  'es-PE':{ native: 'Español (PE)', english: 'Spanish (Peru)' },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
```

### 4.3 `src/i18n/request.ts` — the heart of the no-routing setup

```ts
import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale } from './locale';

export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get('NEXT_LOCALE')?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,                                            // REQUIRED in v4
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Optional but recommended for Peru:
    timeZone: 'America/Lima',                          // UTC-5, no DST
    now: new Date(),
  };
});
```

> **Why this works without middleware:** `getRequestConfig` runs once per request, server-side. `cookies()` from `next/headers` is a Dynamic API — using it opts the layout/page out of static rendering for that request, which is what we want (the page content depends on the user's chosen language).

### 4.4 `next.config.ts` — add the next-intl plugin

```ts
import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: false,
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
```

### 4.5 `src/app/layout.tsx` — wrap children with the provider

```tsx
import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTimeZone } from 'next-intl/server';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap", style: ["normal", "italic"] });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const timeZone = await getTimeZone();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground`}>
        {/* v4 auto-inherits locale + messages + timeZone from the server config */}
        <NextIntlClientProvider timeZone={timeZone}>
          {children}
        </NextIntlClientProvider>
        <Toaster />
        <SonnerToaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
```

### 4.6 `src/app/actions/set-locale.ts` — Server Action (writes the cookie)

```ts
'use server';
import { cookies } from 'next/headers';
import { defaultLocale, isLocale, type Locale } from '@/i18n/locale';

export async function setLocale(next: Locale) {
  if (!isLocale(next)) return;
  const store = await cookies();
  store.set('NEXT_LOCALE', next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    // secure: true, // enable in production behind HTTPS
  });
}
```

### 4.7 `src/components/locale-switcher.tsx` — the toggle (client)

```tsx
'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLocale } from '@/app/actions/set-locale';
import { locales, localeLabels, type Locale } from '@/i18n/locale';
import { Button } from '@/components/ui/button';
import { Languages } from 'lucide-react';

export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const current = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const next: Locale = current === 'en' ? 'es-PE' : 'en';

  function onToggle() {
    startTransition(async () => {
      await setLocale(next);          // server action sets cookie
      router.refresh();               // re-runs server components with new locale
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      disabled={isPending}
      className="gap-2"
      aria-label={t('toggle', { next: localeLabels[next].native })}
    >
      <Languages className="size-4" />
      <span className="text-xs font-medium">
        {isPending ? t('switching') : localeLabels[next].native}
      </span>
    </Button>
  );
}
```

> **No full page reload.** `router.refresh()` from `next/navigation` only re-runs Server Components and streams the new HTML — client state (the active tab, the live ML feed, the agent loop) is preserved. This is the recommended pattern confirmed by the next-intl docs and the StackOverflow "change language without refreshing" thread.

### 4.8 Using translations in any component (server or client)

```tsx
// Server Component (or shared component rendered on server)
import { getTranslations } from 'next-intl/server';
export default async function Hero() {
  const t = await getTranslations('Tab1.Hero');
  return <h1>{t('title')}</h1>;
}

// Shared/Client Component
import { useTranslations } from 'next-intl';
export function StatCard() {
  const t = useTranslations('Tab2.Stats');
  return <span>{t('personCount', { count: 42 })}</span>;
}

// Numbers, dates, currency — locale-aware, no manual Intl plumbing
import { useFormatter } from 'next-intl';
export function MetaBar({ ts, cost }: { ts: Date; cost: number }) {
  const fmt = useFormatter();
  return (
    <>
      <time>{fmt.dateTime(ts, { dateStyle: 'long', timeStyle: 'short' })}</time>
      <span>{fmt.number(cost, { style: 'currency', currency: 'PEN' })}</span>
    </>
  );
}
```

In `es-PE` this renders: `14 de julio de 2026, 10:30 a. m.` and `S/ 99.99` — correctly, for free, from CLDR.

---

## 5. Translation key structure

### 5.1 Convention (synthesis of locize + lokalise + phrase + dev.to best practices)

- **Structured (semantic) keys**, dot-notation, **2–3 levels max**: `<feature>.<section>.<element>`.
- **Namespaces by feature**, mirroring our tab structure: `Tab1.*`, `Tab2.*`, `Tab3.*`, `Nav.*`, `LocaleSwitcher.*`, `Common.*` (only for genuinely global, context-free strings like the brand name).
- **Never reuse keys across contexts.** "Creating new messages is cheaper than trying to manage shared messages" (locize). Two "Save" buttons → `Tab2.Settings.save` AND `Tab3.Export.save`, NOT a shared `Common.save`. Context-dependent translation diverges fast (e.g. verb vs. status).
- **Never use English text as the key** (brittle — a typo fix breaks every translation).
- **Nest JSON objects** for readability; next-intl supports both flat-dotted and nested-object forms (don't mix in the same file).

### 5.2 Example `messages/en.json`

```json
{
  "LocaleSwitcher": {
    "toggle": "Switch language to {next}",
    "switching": "Switching…"
  },
  "Nav": {
    "tab1": "Overview",
    "tab2": "Live Prototype",
    "tab3": "Strategic Brief"
  },
  "Tab1": {
    "Hero": {
      "title": "Agentic Camera Intelligence for Peru",
      "subtitle": "Turning public plaza feeds into automated, auditable incident response — entirely in the browser."
    },
    "Stats": {
      "personCount": "{count, plural, one {1 person detected} other {# persons detected}}"
    }
  },
  "Tab2": {
    "Tier": {
      "label": "Tier {n}",
      "escalated": "Tier {n} escalated — judge engaged"
    }
  }
}
```

### 5.3 Example `messages/es-PE.json`

```json
{
  "LocaleSwitcher": {
    "toggle": "Cambiar idioma a {next}",
    "switching": "Cambiando…"
  },
  "Nav": {
    "tab1": "Descripción",
    "tab2": "Prototipo en vivo",
    "tab3": "Resumen estratégico"
  },
  "Tab1": {
    "Hero": {
      "title": "Inteligencia de cámaras autónoma para el Perú",
      "subtitle": "Convertimos las cámaras públicas de las plazas en respuesta a incidentes automatizada y auditable, todo en el navegador."
    },
    "Stats": {
      "personCount": "{count, plural, one {1 persona detectada} other {# personas detectadas}}"
    }
  },
  "Tab2": {
    "Tier": {
      "label": "Nivel {n}",
      "escalated": "Nivel {n} escalado — juez activado"
    }
  }
}
```

---

## 6. Peruvian Spanish (es-PE) locale considerations

### 6.1 Why use `es-PE` (not generic `es`) as the locale tag

Using the full BCP-47 tag `es-PE` makes the native `Intl.*Format` APIs (and next-intl's `useFormatter`) automatically pick up **CLDR Peru-specific data**. If you used bare `es`, you'd get Spain's `es-ES` defaults (wrong currency symbol position, wrong month name for September, wrong AM/PM casing, 24h-default clock).

### 6.2 Locale data snapshot (source: LocalePlanet ICU es-PE, CLDR)

| Property | es-PE value | Notes vs. en / es-ES |
|---|---|---|
| Currency code | `PEN` | Peruvian sol |
| Currency symbol | `S/` | Placed BEFORE the amount with a space: `S/ 99.99`. Spain uses `€` after. |
| Decimal separator | `.` (period) | Same as en-US |
| Grouping separator | `,` (comma) | Same as en-US — `1,234.56` |
| Short date | `d/MM/yy` → `14/07/26` | Day-first, slashes. Spain uses `dd/MM/yyyy`. |
| Medium date | `d MMM y` → `14 jul. 2026` | Month abbreviated with period. |
| Long date | `d 'de' MMMM 'de' y` → `14 de julio de 2026` | "de" connectors. |
| Full date | `EEEE, d 'de' MMMM 'de' y` → `martes, 14 de julio de 2026` | Weekday first. |
| AM/PM strings | `a. m.` / `p. m.` | **Lowercase, spaced, with periods.** Distinct from Spain's uppercase `AM`/`PM`. |
| September month name | **`setiembre`** (not `septiembre`) | Peruvian/Andean variant — CLDR's es-PE data uses `setiembre`. Both forms are RAE-accepted; `setiembre` is the local norm. |
| Short September | `set.` | Matches the long form. |
| Time zone | `America/Lima` (UTC-5, **no DST**) | Peru does not observe daylight saving. |
| Character orientation | LTR | No RTL concerns (unlike ar/he). |

**Action:** In `i18n/request.ts`, set `timeZone: 'America/Lima'` explicitly so `useFormatter().dateTime()` produces consistent timestamps regardless of where the server runs. This is critical for our Tab 2 incident timestamps.

### 6.3 Vocabulary — LatAm/Peru Spanish vs. Spain Spanish

For UI strings, prefer the Latin American / Peruvian form. Most relevant to this project:

| Concept | ❌ Spain (es-ES) | ✅ Peru / LatAm (es-PE) | Where it appears |
|---|---|---|---|
| Computer | ordenador | **computadora** | Tab 1 architecture copy |
| Download | descargar (also fine) | **descargar / bajar** | Tab 3 PPTX export button |
| Phone | móvil | **celular** | (if ever shown) |
| Potato | patata | **papa** | (irrelevant for UI) |
| Car | coche | **auto / carro** | (irrelevant for UI) |
| You (plural) | vosotros | **ustedes** | Any "you" copy → use "ustedes" conjugation |
| Browser | navegador | **navegador** | Same in both — OK |
| Camera | cámara | **cámara** | Same — OK |
| To run (execute) | ejecutar | **ejecutar** | Same — OK |
| Alert/warning | alerta | **alerta** | Same — OK |
| Report | informe | **informe / reporte** | "reporte" is more common in Peru for tech contexts |

**Style notes for Peruvian Spanish UI copy:**
- Use **"tú"** (informal) or **"usted"** (formal) consistently — for a B2B/enterprise-ish dashboard like ours, **"usted"** reads more professional. Pick one and stick to it; don't mix.
- "Ustedes" for plural (never vosotros).
- Numbers/dates: let `Intl` handle it, don't hand-format.
- Avoid regional slang ("chibolo", "pata", "causa") in UI copy — those are colloquial and inappropriate for a technical dashboard.
- Currency: always PEN with `S/` symbol via `Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })`. Don't hardcode "S/".

### 6.4 Spanish plural rules (low-risk)

Spanish uses the same plural categories as English: `one` (count = 1) and `other` (everything else). So ICU plural strings translate 1:1 — no extra cases needed (unlike Arabic's 6 forms or Polish's 4). Example:

```json
"en":   "{count, plural, one {1 person detected} other {# persons detected}}"
"es-PE":"{count, plural, one {1 persona detectada} other {# personas detectadas}}"
```

The `#` symbol is substituted with the count in the localized number format.

---

## 7. ICU MessageFormat — patterns to use (built into next-intl)

next-intl uses ICU MessageFormat natively — no extra dependency, no config. Use it for anything beyond plain interpolation.

### 7.1 Plurals

```json
"Stats.personCount": "{count, plural, =0 {No persons detected} one {1 person detected} other {# persons detected}}"
```

`other` is **always required** (fallback). `=0` is an explicit exact-match override (useful for "No X" UX). Spanish rules are identical to English here.

### 7.2 Select (gender / category) — useful for the LLM "judge" verdicts

```json
"Judge.verdict": "{severity, select, low {Minor anomaly — logged only.} medium {Notable anomaly — Tier 2 alert sent.} high {Critical anomaly — Tier 3 escalation, full report generated.} other {Unknown severity.}}"
```

### 7.3 Nested (plural inside select) — when grammatical agreement is needed

```json
"Alert.escalation": "{tier, select, 2 {{count, plural, one {1 person flagged at Tier 2} other {# persons flagged at Tier 2}}} 3 {{count, plural, one {1 person escalated to Tier 3} other {# persons escalated to Tier 3}}} other {No escalation}}"
```

### 7.4 What NOT to do

- ❌ **String concatenation**: `'Hello ' + name + '!'` → breaks word order in other languages. Always use interpolation: `t('greeting', { name })` → `'Hello, {name}!'`.
- ❌ **Embedding HTML in translations** + `dangerouslySetInnerHTML`. Use next-intl's [rich text rendering](https://next-intl.dev/docs/usage/rich-text) (`t.rich('key', { bold: (c) => <b>{c}</b> })`) instead.
- ❌ **Pluralizing by appending 's'**: doesn't work in any language other than English.

---

## 8. Layout safeguards for text expansion (EN → ES)

### 8.1 The numbers

Sources: gtelocalize, kwintessential, multilize, eriksen, quicksilver.

- **EN → Spanish: typically +15–25% character count.** Quicksilver: "Spanish text occupies more space than English by approximately 1/5 to 1/4, or 20%." Eriksen: "20-25% expansion."
- Short UI strings (1-3 words) can expand **more** (up to +40%) because connector words like "de" / "del" can't be abbreviated.
- **Plan for +30% headroom** as the design ceiling. Any fixed-width button/label that fits English at width W should be tested at ~1.3×W.

### 8.2 Concrete CSS / Tailwind patterns

| Risk | Pattern | Tailwind |
|---|---|---|
| Fixed-width button truncates Spanish | Don't set fixed `w-` on buttons; use `min-w-` + `max-w-` + auto width. Or let it grow with `w-auto`. | `min-w-0 w-auto max-w-[200px]` |
| Flex child overflows because Spanish is longer | Add `min-w-0` to flex children so they can shrink and wrap. | `flex min-w-0` |
| Long single word breaks layout (rare in ES but possible for compound tech terms) | `overflow-wrap: break-word` | `break-words` |
| Heading wraps awkwardly to 2 lines with 1 word on line 2 | `text-wrap: balance` (Chrome 114+, Safari 16.4+, FF 121+) | `[text-wrap:balance]` |
| Pill/badge text reflows oddly | `white-space: nowrap` only if you've verified both locales fit; otherwise allow wrap. | `whitespace-nowrap` |
| Truncation hides Spanish text | Use `truncate` + a `title=` attribute (or shadcn Tooltip) with the full string. | `truncate` + `<Tooltip>` |
| Grid card heights misalign when one locale's text is 2 lines | Use `grid` with `auto-rows-fr` so all cards in a row stretch to the tallest. | `grid auto-rows-fr` |
| Stats numbers (z-score, count) shift width when locale changes | `tabular-nums` + `font-mono` so digit columns align. | `tabular-nums font-mono` |
| Logical padding flips wrong in some context | Use logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) instead of `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`. Future-proofs for any RTL addition and reads better in flex contexts. | `ps-4 pe-4` |
| Color/spacing tokens break | They won't — Tailwind tokens are locale-agnostic. No action. | — |

### 8.3 Test protocol

1. Build the EN locale first.
2. Translate to es-PE.
3. **Toggle back and forth at every breakpoint** (390 / 768 / 1280 / 1536) — the Tab 1/2/3 layout must hold in both.
4. Specifically check: nav tab labels, hero CTA buttons, stat-card titles, slide action titles on Tab 3 (Instrument Serif at 36-44px is the highest text-expansion risk).
5. Lint gate: add a check that no `<Button>` has both a fixed `w-` AND contains `t(...)` translation call.

---

## 9. SEO / `<html lang>` / metadata

- The root layout already sets `<html lang={locale}>` dynamically (see §4.5). When `locale = 'es-PE'`, the document correctly advertises `lang="es-PE"`.
- For `generateMetadata`: use `getTranslations()` server-side to localize `title`, `description`, `openGraph`, `twitter` fields. Since we have a single `/` route, only one locale is indexed at a time — acceptable for an internal demo SPA. If SEO becomes a priority later, add `hreflang` alternates via the locale-prefixed routing path (out of scope for v1).
- No `sitemap.ts` changes needed for v1 (single route).

---

## 10. Implementation handoff — concrete steps for the orchestrator

Ordered for smallest-blast-radius-first:

1. **Create the i18n scaffolding** (no UI changes yet):
   - `src/i18n/locale.ts` (§4.2)
   - `src/i18n/request.ts` (§4.3)
   - `messages/en.json` + `messages/es-PE.json` — start with just `{ "LocaleSwitcher": {...} }` so the switcher works.
   - Wire `createNextIntlPlugin()` into `next.config.ts` (§4.4).
   - Wrap `<body>` with `<NextIntlClientProvider>` in `layout.tsx` (§4.5). Set `<html lang={locale}>`.
   - Add `setLocale` server action (§4.6).
   - Add `<LocaleSwitcher />` (§4.7) — mount in the page header next to the tab nav.
   - **Verify:** toggle works, cookie is set, `router.refresh()` swaps copy, no console errors.

2. **Migrate Tab 1 (Overview) strings** → `Tab1.*` namespace. Replace hardcoded English in `src/components/tab1-overview.tsx`. Test both locales.

3. **Migrate Tab 2 (Live Prototype)** → `Tab2.*` namespace. Pay special attention to:
   - Tier labels, alert copy, agent-state badges.
   - Live `Intl` formatting for timestamps (`fmt.dateTime`) and counts (`fmt.number`).
   - LLM-generated incident reports — these come from the server route `/api/*` and are generated in English; **decision needed:** do we pass the locale to the LLM prompt and regenerate in Spanish, or leave LLM output in English and only localize the chrome? **Recommendation for v1:** pass `locale` cookie to the report API and instruct the LLM to write in the requested language (the z-ai SDK handles multilingual output natively). Low cost, high value.

4. **Migrate Tab 3 (Strategic Brief)** → `Tab3.*` namespace. This is the heaviest text volume (~10 slides × ~200 words each). Use nested namespaces per slide: `Tab3.Slide1.title`, `Tab3.Slide1.body`, etc. The PPTX export API (`/api/export-pptx`) should also read the cookie and produce the slide in the active locale — but PPTX text box sizing is fixed, so verify Spanish fits each box (text expansion risk is highest here).

5. **Localize metadata** in `layout.tsx` via `generateMetadata` + `getTranslations`.

6. **Layout audit:** run the test protocol from §8.3 at 390 / 768 / 1280 / 1536 in both locales. Fix any truncation/overflow.

7. **Lint gate:** add an ESLint rule or simple grep-based check that flags raw English strings in `.tsx` files outside of `messages/*.json` (allowlist: brand name "Cusco Vision Agent", technical proper nouns like "COCO-SSD", "TF.js", "Next.js").

### Estimated effort
- Scaffolding (steps 1): ~1 hour.
- Tab 1: ~1 hour.
- Tab 2: ~2 hours (lots of small dynamic strings + Intl formatting + LLM locale pass-through).
- Tab 3: ~3 hours (heavy text volume, PPTX sizing recheck).
- Metadata + layout audit + lint gate: ~1.5 hours.
- **Total: ~8-9 hours of focused implementation.**

---

## 11. Risks & open questions for the orchestrator

| Risk | Mitigation |
|---|---|
| LLM incident reports stay English when user switches to Spanish | Pass `locale` cookie to `/api/agent-report` and `/api/judge`; add "Respond in {locale === 'es-PE' ? 'Peruvian Spanish' : 'English'}" to the system prompt. z-ai SDK supports this natively. |
| PPTX export has fixed text-box widths; Spanish overflows | Either (a) reduce font size by 1pt for es-PE, or (b) shorten Spanish translations to fit, or (c) auto-resize text to fit box (pptxgenjs supports `valign: 'middle'` + `shrinkText`). Recommend (c). |
| `cookies()` makes the layout dynamic — loses some static optimization | Acceptable for an SPA dashboard. If needed later, use `generateStaticParams` + locale-prefixed routing (v2 scope). |
| First paint shows default `en` before cookie is read | Mitigated by server-side `getLocale()` in the layout (the cookie is read on the server, so the first paint is already correct). No flash. |
| `router.refresh()` re-runs ALL server components | For our SPA this is fine (small tree). If perf becomes an issue, wrap the layout in React `cache()` boundaries or split into route segments. |
| User's browser `Accept-Language` is ignored | Intentional for v1 — we default to `en` and let the user toggle. Could add `Accept-Language` sniffing as the initial cookie value in a future `/api/set-initial-locale` route. |

---

## 12. Sources (key URLs)

**next-intl docs (primary, fetched & verified):**
- https://next-intl.dev/docs/getting-started/app-router — confirms "Provide a locale" cookie path for no-routing setup
- https://next-intl.dev/docs/usage/configuration — `getRequestConfig` + `NextIntlClientProvider` + "Without locale-based routing" section
- https://next-intl.dev/docs/environments/server-client-components — `useTranslations`/`getTranslations` duality, `NextIntlClientProvider` auto-inherits
- https://next-intl.dev/docs/routing/middleware — confirms `proxy.ts` rename for Next.js 16 (we don't need this)
- https://next-intl.dev/docs/usage/numbers — `useFormatter().number()` for currency
- https://next-intl.dev/docs/usage/dates-times — `useFormatter().dateTime()` for Peru timestamps

**Next.js 16 + next-intl v4 breaking changes:**
- https://www.buildwithmatija.com/blog/next-intl-nextjs-16-proxy-fix — `middleware.ts`→`proxy.ts`, v4 required provider, v4 required `locale` return

**Comparisons:**
- https://simplelocalize.io/blog/posts/react-i18next-vs-next-intl — "next-intl natural choice for App Router"
- https://www.reddit.com/r/SaaS/comments/1nuxnk5/full_i18n_comparison_nexti18next_vs_nextintl_vs — "next-intl sweet spot for App Router and RSC"
- https://github.com/vercel/next.js/discussions/35691 — community consensus

**Real-world case study (10 languages, Next.js 16 + next-intl):**
- https://dev.to/samdreamsmaker/internationalization-in-nextjs-16-lessons-from-supporting-10-languages-15nb — confirms stack choice, nested namespace pattern, ICU plural usage, RTL handling (N/A for us), performance via namespace splitting

**Peruvian Spanish (es-PE) locale data:**
- https://www.localeplanet.com/icu/es-PE/index.html — ICU es-PE: `S/` symbol, `setiembre`, `a. m.`/`p. m.`, date patterns
- https://simplelocalize.io/data/locale-code/es-PE — locale metadata, PEN currency, UTC-5, country codes
- https://en.wikipedia.org/wiki/Peruvian_sol — currency background

**Vocabulary (LatAm vs. Spain Spanish):**
- https://www.speakeasybcn.com/en/blog/the-differences-between-spanish-in-spain-and-latin-america
- https://www.timekettle.co/blogs/tips-and-tricks/latin-american-spanish-vs-european-spanish — computadora vs. ordenador, celular vs. móvil, papas vs. patatas
- https://www.facebook.com/babbel.languages/posts/... — Spain "ordenador" vs LatAm "computadora" explicit

**ICU MessageFormat:**
- https://simplelocalize.io/blog/posts/what-is-icu — syntax guide, plurals + select + nesting
- https://crowdin.com/blog/icu-guide — comprehensive ICU reference

**Translation key naming:**
- https://www.locize.com/blog/guide-to-i18n-key-naming — structured keys, "never reuse keys", 2-3 level nesting
- https://lokalise.com/blog/translation-keys-naming-and-organizing — naming best practices
- https://phrase.com/blog/posts/ruby-lessons-learned-naming-and-managing-rails-i18n-keys — don't nest deeper than 2 levels

**Text expansion:**
- https://www.kwintessential.co.uk/blog/translation-text-expansion-how-it-affects-design-2 — 25-35% general
- https://quicksilvertranslate.com/2783/desktop-publishing-and-text-length — EN→ES ~20%
- https://eriksen.com/language/text-expansion — EN→ES 20-25%, EN→DE up to 35%
- https://multilize.com/blog/why-layout-matters-translation — EN→ES 15-25%

**Client-side language switcher patterns:**
- https://stackoverflow.com/questions/78873430/how-to-change-the-language-without-refreshing-the-page-using-next-intl-client-co — cookie + `router.refresh()` pattern (no full reload)
- https://github.com/amannn/next-intl/discussions/532 — LocaleSwitcher component example

All raw search results preserved in `/home/z/my-project/download/research/i18n/01_*.json` through `16_*.json`. Fetched HTML articles in `/home/z/my-project/download/research/i18n/fetched/`.
