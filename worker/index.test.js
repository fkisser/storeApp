import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index.js'

describe('Cloudflare Worker store API proxy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('forwards a store request to the configured backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"cart":{"revision":2}}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await worker.fetch(
      new Request('https://store.example.com/api/v1/stores/cafe-del-barrio/carts/current?source=web', {
        headers: { 'X-Cart-Token': 'opaque-token' }
      }),
      { API_BASE_URL: 'https://api.example.com/' }
    )

    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://api.example.com/api/v1/stores/cafe-del-barrio/carts/current?source=web'),
      expect.objectContaining({ method: 'GET' })
    )
    expect(await response.json()).toEqual({ cart: { revision: 2 } })
  })
})
