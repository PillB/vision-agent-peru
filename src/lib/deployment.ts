/**
 * Deployment environment detection.
 * On GitHub Pages, API routes are unavailable — all server-side
 * functionality must be disabled or replaced with local alternatives.
 */

export function isGitHubPages(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname.includes('github.io') ||
    window.location.pathname.includes('/vision-agent-peru/')
}

export function isDevServer(): boolean {
  if (typeof window === 'undefined') return false
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

/**
 * Check if API routes are available.
 * On GH Pages: false (no server).
 * On dev server: true.
 */
export function apiRoutesAvailable(): boolean {
  return isDevServer()
}
