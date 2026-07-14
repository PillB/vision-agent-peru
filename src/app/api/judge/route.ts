/**
 * /api/judge — LLM-as-judge endpoint.
 *
 * Receives a snapshot data URL + detection JSON, calls the z-ai-web-dev-sdk
 * to reason about whether the anomaly is a real incident or a false positive
 * (lighting change, occlusion, model hallucination). Returns a structured
 * verdict.
 *
 * Server-side only — z-ai-web-dev-sdk must NOT be imported on the client.
 */

import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface JudgeRequestBody {
  cameraId: string
  cameraLabel: string
  count: number
  zScore: number
  mean: number
  stddev: number
  detections: Array<{ class: string; score: number; bbox: [number, number, number, number] }>
  reasoning: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as JudgeRequestBody

    if (!body || typeof body.count !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Construct a structured prompt — give the LLM the same context the agent had.
    const prompt = `You are a vision-system incident judge. A camera anomaly detector has flagged the following:

Camera: ${body.cameraLabel} (${body.cameraId})
Persons detected (current frame): ${body.count}
2-minute moving average: ${body.mean.toFixed(1)} (σ=${body.stddev.toFixed(1)})
Z-score of current count vs baseline: ${body.zScore.toFixed(2)}
Detection confidences (sample): ${body.detections.slice(0, 5).map((d) => `${d.class}:${d.score.toFixed(2)}`).join(', ')}

Reasoning from the rule engine: ${body.reasoning}

Decide whether this is a REAL incident worth escalating (e.g., genuine crowd surge, unusual gathering, restricted-zone breach) or a FALSE POSITIVE (e.g., sudden lighting change, model hallucination on textures, occlusion artifacts).

Respond ONLY with a compact JSON object on a single line, no markdown fences:
{"verdict":"real"|"false_positive","confidence":0.0-1.0,"reason":"<one short sentence>"}`

    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a precise vision-system incident judge. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 200,
    })

    const raw = completion.choices?.[0]?.message?.content ?? ''
    // Be forgiving when parsing — strip code fences, find the JSON object.
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) {
      return NextResponse.json({
        verdict: 'real',
        confidence: 0.5,
        reason: 'LLM returned unparseable output — defaulting to real (conservative).',
        raw,
      })
    }
    const parsed = JSON.parse(match[0])
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[/api/judge] error:', err)
    return NextResponse.json(
      {
        verdict: 'real',
        confidence: 0.3,
        reason: `Judge endpoint error: ${err instanceof Error ? err.message : 'unknown'}. Defaulting to real (conservative).`,
      },
      { status: 200 } // return 200 with fallback verdict so the UI doesn't crash
    )
  }
}
