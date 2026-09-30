import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting Middleware (H-4)
//
// Three independent limiters keyed by client IP:
//
//   1. auth      — 10 login attempts per 15 minutes (brute-force protection)
//   2. mutations — 120 write/delete ops per minute (POST/PATCH/DELETE)
//   3. global    — 600 total requests per minute (general DoS protection)
//
// When Upstash is not configured (UPSTASH_REDIS_REST_URL is absent or a
// placeholder) the middleware is a no-op so local development continues
// to work without Redis.
// ─────────────────────────────────────────────────────────────────────────────

function buildLimiters() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  // Skip rate limiting when Upstash is not configured
  if (!url || !token || url.includes('your-upstash') || token.includes('your-upstash')) {
    return null
  }

  const redis = new Redis({ url, token })

  return {
    auth: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '15 m'),
      prefix: 'rl:auth',
      analytics: false,
    }),
    mutations: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(120, '1 m'),
      prefix: 'rl:mut',
      analytics: false,
    }),
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(600, '1 m'),
      prefix: 'rl:global',
      analytics: false,
    }),
  }
}

// Instantiate once at module load — Next.js middleware runs in the Edge runtime
// and is reused across requests in the same isolate.
const limiters = buildLimiters()

/** Returns the real client IP, preferring Vercel's x-real-ip header. */
function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-real-ip') ??
    request.headers.get('cf-connecting-ip') ??
    // x-forwarded-for may be a comma-separated list; take the first entry
    (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ||
    'unknown'
  )
}

function rateLimitedResponse(retryAfter: number, requestId: string) {
  return NextResponse.json(
    { error: { message: 'Too many requests. Please slow down and try again shortly.', requestId } },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-Request-Id': requestId,
        'Cache-Control': 'no-store',
      },
    }
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Pass through if Upstash is not configured (local dev / CI without Redis)
  if (!limiters) {
    return NextResponse.next()
  }

  const ip = clientIp(request)
  const requestId = crypto.randomUUID()
  const method = request.method.toUpperCase()

  // ── 1. Auth endpoints: strict limiter (brute-force protection) ───────────
  if (pathname.startsWith('/api/auth/')) {
    const { success, reset } = await limiters.auth.limit(ip)
    if (!success) {
      const retryAfterSecs = Math.ceil((reset - Date.now()) / 1000)
      console.warn(JSON.stringify({ level: 'warn', event: 'rate_limit_auth', ip, requestId }))
      return rateLimitedResponse(retryAfterSecs, requestId)
    }
  }

  // ── 2. Mutation endpoints: moderate limiter (POST/PATCH/DELETE) ───────────
  if (
    pathname.startsWith('/api/v1/') &&
    (method === 'POST' || method === 'PATCH' || method === 'DELETE')
  ) {
    const { success, reset } = await limiters.mutations.limit(ip)
    if (!success) {
      const retryAfterSecs = Math.ceil((reset - Date.now()) / 1000)
      console.warn(JSON.stringify({ level: 'warn', event: 'rate_limit_mutation', ip, method, path: pathname, requestId }))
      return rateLimitedResponse(retryAfterSecs, requestId)
    }
  }

  // ── 3. Global API limiter (all /api/* routes) ─────────────────────────────
  const { success, reset } = await limiters.global.limit(ip)
  if (!success) {
    const retryAfterSecs = Math.ceil((reset - Date.now()) / 1000)
    console.warn(JSON.stringify({ level: 'warn', event: 'rate_limit_global', ip, path: pathname, requestId }))
    return rateLimitedResponse(retryAfterSecs, requestId)
  }

  return NextResponse.next()
}

export const config = {
  // Only run this middleware on API routes — skip static assets and pages
  matcher: ['/api/:path*'],
}
