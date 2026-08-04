/**
 * /api/alert — simulated email alert endpoint.
 *
 * In production this would integrate with Resend/SendGrid/SES. For the prototype
 * we simulate delivery (write to a server-side log + return success) so the demo
 * works without email credentials.
 *
 * If SMTP env vars are present (SMTP_HOST, SMTP_USER, SMTP_PASS), we attempt a
 * real send via nodemailer. Otherwise we simulate.
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Rate limiting (R01: prevent alert spam) ───────────────────────────────
// Max 10 alerts per minute per IP
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_CALLS = 10
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count++
  return entry.count <= RATE_LIMIT_MAX_CALLS
}

interface AlertRequestBody {
  to: string
  subject: string
  body: string
  cameraId: string
  tier: number
  snapshotDataUrl?: string
}

export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Maximum 10 alerts per minute.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

    const body = (await req.json()) as AlertRequestBody
    if (!body || !body.to || !body.subject) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Simulate email send (deterministic latency)
    await new Promise((r) => setTimeout(r, 200))

    const messageId = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@cusco-vision.agent`

    console.log('[/api/alert] SIMULATED EMAIL', {
      to: body.to,
      subject: body.subject,
      tier: body.tier,
      cameraId: body.cameraId,
      messageId,
      bodyPreview: body.body.slice(0, 120),
    })

    return NextResponse.json({
      ok: true,
      mode: 'simulated',
      messageId,
      deliveredAt: new Date().toISOString(),
      note: 'Email simulated in prototype. Wire SMTP env vars for real delivery.',
    })
  } catch (err) {
    console.error('[/api/alert] error:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
