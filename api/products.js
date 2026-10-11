import { API_BASE_URL, STORE_SLUG } from '../src/config/store.js'

const PRODUCTS_API_URL = `${API_BASE_URL}/api/v1/stores/${STORE_SLUG}/products`

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const upstreamUrl = new URL(PRODUCTS_API_URL)
    const requestUrl = new URL(request.url, 'http://localhost')
    const requestedLimit = Number(requestUrl.searchParams.get('limit'))
    const requestedOffset = Number(requestUrl.searchParams.get('offset'))

    if (Number.isFinite(requestedLimit) && requestedLimit > 0) {
      upstreamUrl.searchParams.set('limit', String(Math.min(requestedLimit, 100)))
    }
    if (Number.isFinite(requestedOffset) && requestedOffset >= 0) {
      upstreamUrl.searchParams.set('offset', String(requestedOffset))
    }
    for (const parameter of ['categoryId', 'q']) {
      const value = requestUrl.searchParams.get(parameter)
      if (value) upstreamUrl.searchParams.set(parameter, value)
    }

    const upstream = await fetch(upstreamUrl, {
      headers: { Accept: 'application/json' }
    })

    if (!upstream.ok) {
      return response.status(upstream.status).json({ error: 'Product service unavailable' })
    }

    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response.status(200).json(await upstream.json())
  } catch {
    return response.status(502).json({ error: 'Could not reach product service' })
  }
}