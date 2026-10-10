const CATEGORIES_API_URL = 'https://wt7ddvj5-8080.brs.devtunnels.ms/api/v1/stores/cafe-del-barrio/categories'

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const upstream = await fetch(CATEGORIES_API_URL, {
      headers: { Accept: 'application/json' }
    })

    if (!upstream.ok) {
      return response.status(upstream.status).json({ error: 'Categories unavailable' })
    }

    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return response.status(200).json(await upstream.json())
  } catch {
    return response.status(502).json({ error: 'Could not reach categories service' })
  }
}