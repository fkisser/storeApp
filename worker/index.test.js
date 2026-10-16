import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './index.js'

describe('Cloudflare Worker store API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

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

  it('logs the upstream endpoint only when proxy logging is enabled', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

    await worker.fetch(
      new Request('https://store.example.com/api/v1/stores/modo-dulce/settings?token=private'),
      { API_BASE_URL: 'https://api.example.com/', API_PROXY_LOGGING: 'true' }
    )

    const [message] = consoleLog.mock.calls[0]
    expect(JSON.parse(message)).toMatchObject({
      event: 'store-api-proxy',
      method: 'GET',
      requestPath: '/api/v1/stores/modo-dulce/settings',
      upstream: 'https://api.example.com/api/v1/stores/modo-dulce/settings',
      status: 204
    })
    expect(JSON.parse(message).durationMs).toEqual(expect.any(Number))
  })

  it('returns a clear error when the upstream API URL is missing', async () => {
    const response = await worker.fetch(
      new Request('https://store.example.com/api/v1/stores/modo-dulce/settings'),
      {}
    )

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Store API is not configured' })
  })
})
