import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestStoreApi } from './store.js'

describe('requestStoreApi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('encodes query parameters and sends the tracking token only in a header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ days: [] })
    }))

    await requestStoreApi('/carts/current/fulfillment-windows', {
      cartToken: 'cart-secret',
      query: { fulfillmentType: 'DELIVERY', from: '2026-10-14', days: 14 }
    })

    const [url, options] = fetch.mock.calls[0]
    expect(url).toContain('fulfillmentType=DELIVERY')
    expect(url).toContain('from=2026-10-14')
    expect(options.headers['X-Cart-Token']).toBe('cart-secret')
    expect(url).not.toContain('cart-secret')
  })

  it('sends FormData without setting a JSON content type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: 5 })
    }))
    const formData = new FormData()
    formData.append('file', new Blob(['image'], { type: 'image/png' }), 'proof.png')

    await requestStoreApi('/orders/current/transfer-proofs', {
      method: 'POST',
      orderTrackingToken: 'private-order-token',
      formData
    })

    const [url, options] = fetch.mock.calls[0]
    expect(options.headers['X-Order-Tracking-Token']).toBe('private-order-token')
    expect(options.headers).not.toHaveProperty('Content-Type')
    expect(options.body).toBe(formData)
    expect(url).not.toContain('private-order-token')
  })
})