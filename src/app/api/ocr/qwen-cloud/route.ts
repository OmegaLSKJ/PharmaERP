import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/ocr/qwen-cloud
 *
 * Multi-provider vision OCR route. Tries providers in this priority order:
 *
 * 1. OpenRouter  (FREE — qwen/qwen2-vl-7b-instruct:free)
 *    → OPENROUTER_API_KEY  | https://openrouter.ai/keys  (free, no credit card)
 *
 * 2. Groq        (FREE — llama-3.2-11b-vision-preview)
 *    → GROQ_API_KEY        | https://console.groq.com    (free tier, very fast)
 *
 * 3. Together AI (PAID — Qwen2-VL-7B, ~$0.18/M tokens)
 *    → TOGETHER_API_KEY    | https://api.together.xyz    ($25 free credit on signup)
 *
 * Set any ONE (or more for automatic fallback) in Vercel → Settings → Env Vars.
 * No key needed at all when running locally via Ollama.
 */

export const maxDuration = 60

// ── Provider definitions ──────────────────────────────────────────────────────

interface Provider {
  name: string
  envKey: string
  baseUrl: string
  models: string[]
  buildHeaders: (apiKey: string) => Record<string, string>
  buildBody: (model: string, imageUrl: string, prompt: string) => object
  extractContent: (data: any) => string
}

const PROVIDERS: Provider[] = [
  // ── 1. OpenRouter (FREE vision models — verified live 2026-10) ───────────
  {
    name: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      // ★ Best for document OCR: 31B dense, 262K ctx, native image, reasoning mode
      'google/gemma-4-31b-it:free',
      // ★ Strong: 27B Qwen vision-language, 262K ctx, excellent tabular extraction
      'qwen/qwen3.8-27b:free',
      // ★ MoE 26B (only 3.8B active/token), near-31B quality, very fast
      'google/gemma-4-26b-a4b-it:free',
      // Large MoE (41B active / 975B total), general reasoning + vision
      'thinkingmachines/inkling:free',
      // Smaller MoE (12B active), faster inference
      'thinkingmachines/inkling-small:free',
      // 512K context MoE — fallback for very large multi-page invoices
      'dots-studio/dots-3-note-preview:free',
    ],
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
      'HTTP-Referer': 'https://pharmapp.vercel.app',
      'X-Title': 'PharmaERP Invoice OCR',
    }),
    buildBody: (model, imageUrl, prompt) => ({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
    extractContent: (data) => data?.choices?.[0]?.message?.content || '',
  },

  // ── 2. Groq (FREE — llama-3.2 vision, extremely fast) ────────────────────
  {
    name: 'Groq',
    envKey: 'GROQ_API_KEY',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
    ],
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    }),
    buildBody: (model, imageUrl, prompt) => ({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
    extractContent: (data) => data?.choices?.[0]?.message?.content || '',
  },

  // ── 3. Together AI (paid, ~$0.18/M tokens — $25 free credit on signup) ───
  {
    name: 'Together AI',
    envKey: 'TOGETHER_API_KEY',
    baseUrl: 'https://api.together.xyz/v1',
    models: [
      'Qwen/Qwen2-VL-7B-Instruct',
      'Qwen/Qwen2-VL-72B-Instruct',
      'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
    ],
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    }),
    buildBody: (model, imageUrl, prompt) => ({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
      stream: false,
    }),
    extractContent: (data) => data?.choices?.[0]?.message?.content || '',
  },
]

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { base64, mimeType = 'image/jpeg', prompt, preferProvider } = body

  if (!base64 || !prompt) {
    return NextResponse.json(
      { error: 'Missing required fields: base64, prompt' },
      { status: 400 }
    )
  }

  const imageUrl = `data:${mimeType};base64,${base64}`

  // Determine which providers are configured (have API keys set)
  const configuredProviders = PROVIDERS.filter(
    (p) => !!process.env[p.envKey]
  )

  if (configuredProviders.length === 0) {
    return NextResponse.json(
      {
        error:
          'No cloud OCR provider is configured. Set at least one of: ' +
          PROVIDERS.map((p) => p.envKey).join(', ') +
          ' in Vercel → Project Settings → Environment Variables. ' +
          'OpenRouter is free: https://openrouter.ai/keys',
      },
      { status: 500 }
    )
  }

  // Sort: put preferred provider first if specified
  const orderedProviders = preferProvider
    ? [
        ...configuredProviders.filter((p) =>
          p.name.toLowerCase().includes(preferProvider.toLowerCase())
        ),
        ...configuredProviders.filter(
          (p) => !p.name.toLowerCase().includes(preferProvider.toLowerCase())
        ),
      ]
    : configuredProviders

  const errors: string[] = []

  for (const provider of orderedProviders) {
    const apiKey = process.env[provider.envKey]!

    for (const model of provider.models) {
      try {
        console.log(`[qwen-cloud] Trying ${provider.name} / ${model}`)

        const res = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: provider.buildHeaders(apiKey),
          body: JSON.stringify(provider.buildBody(model, imageUrl, prompt)),
          signal: AbortSignal.timeout(55_000),
        })

        if (!res.ok) {
          const errText = await res.text()
          const msg = `${provider.name}[${model}] → ${res.status}: ${errText.slice(0, 200)}`
          errors.push(msg)
          console.warn('[qwen-cloud]', msg)
          // 429 = rate limited — try next provider instead of next model
          if (res.status === 429) break
          continue
        }

        const data = await res.json()
        const content = provider.extractContent(data)

        if (!content.trim()) {
          const msg = `${provider.name}[${model}] returned empty content`
          errors.push(msg)
          console.warn('[qwen-cloud]', msg)
          continue
        }

        console.log(`[qwen-cloud] ✓ Success via ${provider.name} / ${model}`)
        return NextResponse.json({
          content,
          model,
          provider: provider.name,
          usage: data.usage || null,
        })
      } catch (err: any) {
        const msg = `${provider.name}[${model}] network error: ${err.message}`
        errors.push(msg)
        console.warn('[qwen-cloud]', msg)
      }
    }
  }

  return NextResponse.json(
    {
      error: 'All configured cloud providers failed.',
      details: errors,
      hint: 'Get a free OpenRouter key at https://openrouter.ai/keys and set OPENROUTER_API_KEY in Vercel env vars.',
    },
    { status: 502 }
  )
}

// ── GET health-check ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url)

  const providers = PROVIDERS.map((p) => ({
    name: p.name,
    envKey: p.envKey,
    configured: !!process.env[p.envKey],
    free: p.name === 'OpenRouter' || p.name === 'Groq',
    models: p.models,
    signupUrl:
      p.name === 'OpenRouter'
        ? 'https://openrouter.ai/keys'
        : p.name === 'Groq'
        ? 'https://console.groq.com'
        : 'https://api.together.xyz',
  }))

  const anyConfigured = providers.some((p) => p.configured)

  return NextResponse.json({
    status: anyConfigured ? 'ready' : 'no_keys_set',
    providers,
    hint: !anyConfigured
      ? 'Set OPENROUTER_API_KEY for free Qwen2-VL inference. Get key at https://openrouter.ai/keys'
      : undefined,
  })
}
