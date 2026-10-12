import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './storeProxy.js'

const createResponse = () => ({
  headers: {},
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code
    return this
  },
  setHeader(name, value) {
    this.headers[name.toLowerCase()] = value
  },
  json(body) {
    this.body = body
    return this
  },
  send(body) {
    this.body = body
    return this
  },
  end() {
    this.body = null
    return this
  }
})

describe('Vercel store API proxy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('forwards the store path, query, and opaque cart token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => '{"cart":{"revision":2}}'
    })
    vi.stubGlobal('fetch', fetchMock)
    const request = {
      method: 'PUT',
      url: '/api/v1/stores/cafe-del-barrio/carts/current/items/p-1?source=web',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-cart-token': 'opaque-token'
      },
      body: { quantity: '2.000', revision: 1 }
    }
    const response = createResponse()

    await handler(request, response)

    const [upstreamUrl, options] = fetchMock.mock.calls[0]
    expect(upstreamUrl.pathname).toBe('/api/v1/stores/cafe-del-barrio/carts/current/items/p-1')
    expect(upstreamUrl.searchParams.get('source')).toBe('web')
    expect(options.method).toBe('PUT')
    expect(options.headers.get('X-Cart-Token')).toBe('opaque-token')
    expect(options.body).toBe(JSON.stringify({ quantity: '2.000', revision: 1 }))
    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('{"cart":{"revision":2}}')
  })

  it('reads the store slug and multi-segment path from the rewrite query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => '{}'
    })
    vi.stubGlobal('fetch', fetchMock)
    const request = {
      method: 'GET',
      url: '/api/store?storeSlug=kiosko-juanita&path=carts%2Fcurrent&source=web',
      query: { storeSlug: 'kiosko-juanita', path: 'carts/current', source: 'web' },
      headers: { 'x-cart-token': 'opaque-token' }
    }

    await handler(request, createResponse())

    const [upstreamUrl] = fetchMock.mock.calls[0]
    expect(upstreamUrl.pathname).toBe('/api/v1/stores/kiosko-juanita/carts/current')
    expect([...upstreamUrl.searchParams.keys()]).toEqual(['source'])
  })

  it('keeps cart creation bodyless and forwards its status and opaque token response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 201,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      text: async () => '{"cart":{"revision":0},"accessToken":"opaque-token"}'
    })
    vi.stubGlobal('fetch', fetchMock)
    const request = {
      method: 'POST',
      url: '/api/v1/stores/almacen-demo/carts',
      headers: { accept: 'application/json' }
    }
    const response = createResponse()

    await handler(request, response)

    const [upstreamUrl, options] = fetchMock.mock.calls[0]
    expect(upstreamUrl.pathname).toBe('/api/v1/stores/almacen-demo/carts')
    expect(options.method).toBe('POST')
    expect(options).not.toHaveProperty('body')
    expect(response.statusCode).toBe(201)
    expect(response.body).toContain('opaque-token')
  })
})