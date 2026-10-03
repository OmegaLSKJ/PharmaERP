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
    const payload = body.payload

    if (!payload) {
      return NextResponse.json({ error: 'Missing Ollama payload' }, { status: 400 })
    }

    const res = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: `Ollama returned ${res.status}: ${errText}` }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json(
      { error: `Gateway error communicating with Ollama: ${err.message}` },
      { status: 502 }
    )
  }
}
