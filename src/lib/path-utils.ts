/**
 * Path utilities for basePath-aware URL construction.
 *
 * On GitHub Pages, the site is served from /vision-agent-peru/
 * so all absolute paths need the basePath prefix.
 *
 * In dev mode (localhost:3000), basePath is empty so paths work as-is.
 */

function getBasePath(): string {
  if (typeof window === 'undefined') return ''
  // Next.js sets __NEXT_DATA__.basePath at runtime
  const nextData = (window as any).__NEXT_DATA__
  if (nextData?.basePath) return nextData.basePath
  // Fallback: check if we're on GitHub Pages by looking at the URL
  const path = window.location.pathname
  if (path.includes('/vision-agent-peru/')) return '/vision-agent-peru'
  return ''
}

/**
 * Prefix a path with the basePath.
 * Use for: camera video sources, image sources, fetch() URLs.
 *
 * Example: prefixPath('/sim/fire.mp4') → '/vision-agent-peru/sim/fire.mp4'
 */
export function prefixPath(path: string): string {
  if (!path.startsWith('/')) return path
  const basePath = getBasePath()
  if (!basePath) return path
  // Avoid double-prefixing
  if (path.startsWith(basePath)) return path
  return `${basePath}${path}`
}
