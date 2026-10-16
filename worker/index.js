const allowedMethods = new Set(['GET', 'POST', 'PUT', 'DELETE'])
const forwardedHeaders = ['accept', 'content-type', 'x-cart-token', 'x-order-tracking-token']
const storeApiPrefix = '/api/v1/stores/'
const fallbackApiBaseUrl = 'https://wt7ddvj5-8080.brs.devtunnels.ms'

const getApiBaseUrl = (environment) => {
  const configuredUrl = environment.API_BASE_URL ?? environment.VITE_API_BASE_URL
  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) return fallbackApiBaseUrl

  try {
    const url = new URL(configuredUrl.trim())
    return ['http:', 'https:'].includes(url.protocol)
      ? url.href.replace(/\/$/, '')
      : fallbackApiBaseUrl
  } catch {
    return fallbackApiBaseUrl
  }
}

const createJsonResponse = (body, status, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', ...headers }
})

const proxyStoreRequest = async (request, environment) => {
  if (!allowedMethods.has(request.method)) {
    return createJsonResponse(
      { error: 'Method not allowed' },
      405,
      { Allow: [...allowedMethods].join(', ') }
    )
  }

  const requestUrl = new URL(request.url)
  const pathSegments = requestUrl.pathname.slice(storeApiPrefix.length).split('/').filter(Boolean)
  if (pathSegments.length < 2) {
    return createJsonResponse({ error: 'Invalid store API path' }, 400)
  }

  const upstreamUrl = new URL(requestUrl.pathname, getApiBaseUrl(environment))
  upstreamUrl.search = requestUrl.search
  const headers = new Headers()
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  try {
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
    return createJsonResponse({ error: 'Could not reach store API' }, 502)
  }
}

export default {
  fetch(request, environment) {
    const { pathname } = new URL(request.url)
    if (pathname.startsWith(storeApiPrefix)) return proxyStoreRequest(request, environment)
    return new Response('Not found', { status: 404 })
  }
}
