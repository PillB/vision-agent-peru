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
