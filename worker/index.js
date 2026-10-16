const allowedMethods = new Set(['GET', 'POST', 'PUT', 'DELETE'])
const forwardedHeaders = ['accept', 'content-type', 'x-cart-token', 'x-order-tracking-token']
const storeApiPrefix = '/api/v1/stores/'

const isProxyLoggingEnabled = (environment) => environment.API_PROXY_LOGGING === 'true'

const logProxyRequest = (environment, details) => {
  if (!isProxyLoggingEnabled(environment)) return
  console.log(JSON.stringify({ event: 'store-api-proxy', ...details }))
}

const getApiBaseUrl = (environment) => {
  const configuredUrl = environment.API_BASE_URL
  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) return ''

  try {
    const url = new URL(configuredUrl.trim())
    return ['http:', 'https:'].includes(url.protocol)
      ? url.href.replace(/\/$/, '')
      : ''
  } catch {
    return ''
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

  const apiBaseUrl = getApiBaseUrl(environment)
  if (!apiBaseUrl) {
    logProxyRequest(environment, {
      method: request.method,
      requestPath: requestUrl.pathname,
      status: 500,
      error: 'api-base-url-not-configured'
    })
    return createJsonResponse({ error: 'Store API is not configured' }, 500)
  }

  const upstreamUrl = new URL(requestUrl.pathname, apiBaseUrl)
  upstreamUrl.search = requestUrl.search
  const headers = new Headers()
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }

  const startedAt = Date.now()
  const logDetails = {
    method: request.method,
    requestPath: requestUrl.pathname,
    upstream: `${upstreamUrl.origin}${upstreamUrl.pathname}`
  }

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body
    })
    logProxyRequest(environment, {
      ...logDetails,
      status: upstream.status,
      durationMs: Date.now() - startedAt
    })
    const responseHeaders = new Headers()
    for (const name of ['Content-Type', 'Cache-Control']) {
      const value = upstream.headers.get(name)
      if (value) responseHeaders.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
  } catch {
    logProxyRequest(environment, {
      ...logDetails,
      status: 502,
      durationMs: Date.now() - startedAt,
      error: 'upstream-unreachable'
    })
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
