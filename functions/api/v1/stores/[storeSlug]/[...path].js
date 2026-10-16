import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from '../../../../../src/config/store.js'

const allowedMethods = new Set(['GET', 'POST', 'PUT', 'DELETE'])
const forwardedHeaders = ['accept', 'content-type', 'x-cart-token', 'x-order-tracking-token']

const getPathSegments = (path) => (Array.isArray(path) ? path : String(path ?? '').split('/'))
  .filter(Boolean)
  .map(decodeURIComponent)

export const onRequest = async ({ request, env, params }) => {
  if (!allowedMethods.has(request.method)) {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { Allow: [...allowedMethods].join(', '), 'Content-Type': 'application/json' }
    })
  }

  try {
    const storeSlug = decodeURIComponent(params.storeSlug)
    const pathSegments = getPathSegments(params.path)
    if (!storeSlug || pathSegments.length === 0) {
      return Response.json({ error: 'Invalid store API path' }, { status: 400 })
    }

    const apiBaseUrl = resolveApiBaseUrl({
      API_BASE_URL: env.API_BASE_URL,
      VITE_API_BASE_URL: env.VITE_API_BASE_URL
    })
    const upstreamUrl = new URL(
      `/api/v1/stores/${encodeURIComponent(storeSlug)}/${pathSegments.map(encodeURIComponent).join('/')}`,
      apiBaseUrl || DEFAULT_API_BASE_URL
    )
    const requestUrl = new URL(request.url)
    requestUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value))

    const headers = new Headers()
    for (const name of forwardedHeaders) {
      const value = request.headers.get(name)
      if (value) headers.set(name, value)
    }
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body
    })
    const responseHeaders = new Headers()
    for (const name of ['Content-Type', 'Cache-Control']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    return Response.json({ error: 'Could not reach store API' }, { status: 502 })
  }
}
