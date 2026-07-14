/**
 * /api/report — incident report generator.
 *
 * Receives incident context (camera, time window, peak stats, hits) and calls
 * z-ai-web-dev-sdk to draft a corporate incident report. Returns markdown text
 * that the UI can render.
 */

import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ReportRequestBody {
  cameraId: string
  cameraLabel: string
  windowStart: number
  windowEnd: number
  peakCount: number
  peakZScore: number
  tier: number
  hitCount: number
  sampleReasoning: string
  llmVerdict?: { verdict: string; confidence: number; reason: string }
}

export async function POST(req: NextRequest) {
  let body: ReportRequestBody | null = null
  try {
    body = (await req.json()) as ReportRequestBody
    if (!body || !body.cameraId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const durationMin = ((body.windowEnd - body.windowStart) / 60_000).toFixed(1)
    const windowStart = new Date(body.windowStart).toISOString()
    const windowEnd = new Date(body.windowEnd).toISOString()

    const prompt = `You are an incident report writer for a smart-city camera intelligence system. Draft a concise corporate incident report based on the following telemetry:

Camera: ${body.cameraLabel} (${body.cameraId})
Time window: ${windowStart} to ${windowEnd} (${durationMin} min)
Peak person count: ${body.peakCount}
Peak z-score vs 2-min baseline: ${body.peakZScore.toFixed(2)}
Escalation tier reached: ${body.tier}
Number of anomaly hits logged: ${body.hitCount}
LLM judge verdict: ${body.llmVerdict ? `${body.llmVerdict.verdict} (confidence ${body.llmVerdict.confidence.toFixed(2)}) — ${body.llmVerdict.reason}` : 'not invoked'}

Reasoning trace from agent: ${body.sampleReasoning}

Write the report in this exact structure (markdown):

## Incident Summary
<2-3 sentence executive summary stating what happened, when, and severity>

## Detection Timeline
<2-3 sentences describing how the anomaly evolved>

## Agentic Actions Taken
<bullet list of actions the agent autonomously executed>

## Evidence
<describe the snapshot + telemetry evidence captured>

## Recommended Follow-up
<2-3 concrete next steps for the operations team>

Keep total length under 250 words. Be precise, corporate, and factual. Do not invent details not given above.`

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a precise corporate incident report writer.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 600,
    })

    const markdown = completion.choices?.[0]?.message?.content ?? ''
    return NextResponse.json({
      ok: true,
      markdown: markdown.trim(),
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[/api/report] error:', err)
    return NextResponse.json(
      {
        ok: false,
        markdown: `## Incident Report (fallback)\n\nLLM endpoint error: ${err instanceof Error ? err.message : 'unknown'}. Manual review required.\n\n## Detection Timeline\n- Camera: ${body?.cameraId ?? 'unknown'}\n- Peak count: ${body?.peakCount ?? 'N/A'}\n- Peak z-score: ${body?.peakZScore?.toFixed(2) ?? 'N/A'}\n`,
        error: err instanceof Error ? err.message : 'unknown',
      },
      { status: 200 }
    )
  }
}
