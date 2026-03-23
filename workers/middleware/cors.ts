const FALLBACK_ORIGIN = 'http://localhost:3000';

function resolveOrigin(
  requestOrigin: string | null,
  allowedOriginsEnv: string
): string {
  if (!requestOrigin) return FALLBACK_ORIGIN;

  const origins = allowedOriginsEnv
    ? allowedOriginsEnv
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];

  if (origins.length === 0) {
    // No env configured — allow localhost in development only
    return FALLBACK_ORIGIN;
  }

  if (origins.includes(requestOrigin)) {
    return requestOrigin;
  }

  // Not in the allow-list — return the first allowed origin as a safe default
  // (browser will block the request due to Origin mismatch)
  return origins[0];
}

export function getCORSHeaders(
  request: Request,
  allowedOriginsEnv: string
): Record<string, string> {
  const requestOrigin = request.headers.get('Origin');
  const origin = resolveOrigin(requestOrigin, allowedOriginsEnv);

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export function corsResponse(
  status: number,
  body: string | null,
  request: Request,
  allowedOriginsEnv: string,
  extraHeaders: Record<string, string> = {}
): Response {
  const corsHeaders = getCORSHeaders(request, allowedOriginsEnv);
  const allHeaders = { ...corsHeaders, ...extraHeaders };

  return new Response(body, { status, headers: allHeaders });
}
