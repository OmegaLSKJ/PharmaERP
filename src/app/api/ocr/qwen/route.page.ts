import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const endpoint = url.searchParams.get('endpoint') || 'http://localhost:11434'

  try {
    const res = await fetch(`${endpoint.replace(/\/+$/, '')}/api/tags`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(3000)
    })

    if (!res.ok) {
      return NextResponse.json({ online: false, models: [] }, { status: 200 })
    }

    const data = await res.json()
    const models = (data.models || []).map((m: any) => m.name || m.model)
    const detectedVisionModel =
      models.find((m: string) => m.toLowerCase().includes('qwen2-vl') || m.toLowerCase().includes('vision') || m.toLowerCase().includes('llava')) ||
      models[0] ||
      null

    return NextResponse.json({
      online: true,
      models,
      detectedVisionModel
    })
  } catch (err: any) {
    return NextResponse.json({
      online: false,
      models: [],
      error: err.message
    }, { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const endpoint = (body.endpoint || 'http://localhost:11434').replace(/\/+$/, '')
    const chatPayload = body.chatPayload
    const generatePayload = body.generatePayload

    if (!chatPayload && !generatePayload) {
      return NextResponse.json({ error: 'Missing Ollama payload' }, { status: 400 })
    }

    // Attempt 1: /api/chat with content-array multimodal format
    if (chatPayload) {
      try {
        const chatRes = await fetch(`${endpoint}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatPayload)
        })
        if (chatRes.ok) {
          const data = await chatRes.json()
          const content = data?.message?.content || ''
          if (content.trim()) {
            return NextResponse.json({ content })
          }
        }
      } catch {
        // Fall through to generate
      }
    }

    // Attempt 2: /api/generate with top-level images (llava / older qwen2-vl)
    if (generatePayload) {
      const genRes = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generatePayload)
      })
      if (genRes.ok) {
        const data = await genRes.json()
        const content = data?.response || ''
        return NextResponse.json({ content, response: content })
      }
      const errText = await genRes.text()
      return NextResponse.json(
        { error: `Ollama /api/generate returned ${genRes.status}: ${errText}` },
        { status: genRes.status }
      )
    }

    return NextResponse.json({ error: 'All Ollama endpoints returned empty or failed' }, { status: 502 })
  } catch (err: any) {
    return NextResponse.json(
      { error: `Gateway error communicating with Ollama: ${err.message}` },
      { status: 502 }
    )
  }
}
