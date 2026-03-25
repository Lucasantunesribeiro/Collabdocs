import { NextRequest, NextResponse } from 'next/server'

const DOTNET_API_URL = process.env.DOTNET_API_URL || 'http://localhost:5000/api'

type RouteContext = { params: { path: string[] } }

async function proxy(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const targetUrl = `${DOTNET_API_URL}/${params.path.join('/')}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const auth = request.headers.get('Authorization')
  if (auth) headers['Authorization'] = auth

  const init: RequestInit = { method: request.method, headers }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text()
  }

  const upstream = await fetch(targetUrl, init)
  const body = await upstream.text()

  return new NextResponse(body, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const DELETE = proxy
