import { API_BASE_URL } from '../../../../src/config/store.js'

const allowedMethods = new Set(['GET', 'POST', 'PUT', 'DELETE'])
const forwardedHeaders = ['accept', 'content-type', 'x-cart-token']

export default async function handler(request, response) {
  if (!allowedMethods.has(request.method)) {
    response.setHeader('Allow', [...allowedMethods].join(', '))
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const requestUrl = new URL(request.url, 'http://localhost')
  const routeSegments = requestUrl.pathname.split('/').filter(Boolean)
  const hasStoreApiPrefix = routeSegments[0] === 'api' &&
    routeSegments[1] === 'v1' &&
    routeSegments[2] === 'stores'
  const encodedStoreSlug = routeSegments[3]
  const encodedPathSegments = routeSegments.slice(4)

  if (!hasStoreApiPrefix || !encodedStoreSlug || encodedPathSegments.length === 0) {
    return response.status(400).json({ error: 'Invalid store API path' })
  }

  let storeSlug
  let pathSegments
  try {
    storeSlug = decodeURIComponent(encodedStoreSlug)
    pathSegments = encodedPathSegments.map((segment) => decodeURIComponent(segment))
  } catch {
    return response.status(400).json({ error: 'Invalid store API path' })
  }

  const upstreamUrl = new URL(
    `/api/v1/stores/${encodeURIComponent(storeSlug)}/${pathSegments.map(encodeURIComponent).join('/')}`,
    API_BASE_URL
  )
  requestUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value))

  const headers = new Headers()
  for (const name of forwardedHeaders) {
    const value = request.headers[name]
    if (value) headers.set(name, value)
  }

  const body = ['GET', 'HEAD'].includes(request.method) || request.body === undefined
    ? undefined
    : typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body)

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      ...(body === undefined ? {} : { body })
    })

    response.status(upstream.status)
    for (const name of ['Content-Type', 'Cache-Control']) {
      const value = upstream.headers.get(name)
      if (value) response.setHeader(name, value)
    }

    if (upstream.status === 204 || upstream.status === 304) return response.end()
    return response.send(await upstream.text())
  } catch {
    return response.status(502).json({ error: 'Could not reach store API' })
  }
}