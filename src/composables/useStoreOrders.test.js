import { createApp } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStoreOrders } from './useStoreOrders.js'

const createMountedOrders = (options = {}) => {
  let storeOrders
  const app = createApp({
    setup() {
      storeOrders = useStoreOrders(options)
      return () => null
    }
  })
  app.mount(document.createElement('div'))
  return { app, storeOrders }
}

describe('useStoreOrders', () => {
  let mountedOrders

  beforeEach(() => localStorage.clear())
  afterEach(() => {
    mountedOrders?.app.unmount()
    mountedOrders = null
    localStorage.clear()
  })

  it('stores tracking credentials under a key scoped to the store', () => {
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })
    mountedOrders.storeOrders.addOrder({
      orderId: 42,
      orderStatus: 'PENDING_PAYMENT',
      paymentProvider: 'TRANSFER',
      fulfillmentType: 'PICKUP',
      totalAmount: '11000.00',
      currency: 'ARS',
      orderTrackingToken: 'private-token'
    })

    expect(localStorage.getItem('vitrinapp-orders-almacen-demo')).toContain('private-token')
    expect(localStorage.getItem('vitrinapp-orders-another-store')).toBeNull()
    expect(mountedOrders.storeOrders.orders.value[0].expiresAt).toBe(1000 + 30 * 24 * 60 * 60 * 1000)
  })

  it('requires an order id to associate the tracking token with the order', () => {
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })

    expect(() => mountedOrders.storeOrders.addOrder({ orderTrackingToken: 'private-token' }))
      .toThrow('identificador del pedido')
    expect(mountedOrders.storeOrders.orders.value).toEqual([])
  })

  it('refreshes status with the tracking header and removes completed orders', async () => {
    const apiRequest = vi.fn().mockResolvedValue({ status: 'COMPLETED' })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await mountedOrders.storeOrders.refreshOrder(42)

    expect(apiRequest).toHaveBeenCalledWith('/orders/current', {
      orderTrackingToken: 'private-token'
    })
    expect(mountedOrders.storeOrders.orders.value).toEqual([])
  })

  it('purges expired records and records with completed status during restore', () => {
    localStorage.setItem('vitrinapp-orders-almacen-demo', JSON.stringify([
      { orderId: 1, orderTrackingToken: 'expired', expiresAt: 999 },
      { orderId: 2, orderTrackingToken: 'done', expiresAt: 2000, orderStatus: 'COMPLETED' },
      { orderId: 3, orderTrackingToken: 'active', expiresAt: 2000, orderStatus: 'PREPARING' }
    ]))
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', now: () => 1000 })

    expect(mountedOrders.storeOrders.orders.value.map((order) => order.orderId)).toEqual([3])
  })

  it('rejects invalid proof files before making an API request', async () => {
    const apiRequest = vi.fn()
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })

    await expect(mountedOrders.storeOrders.submitTransferProof(42, {
      type: 'application/pdf',
      size: 100
    })).rejects.toThrow('JPEG, PNG o WebP')
    expect(apiRequest).not.toHaveBeenCalled()
  })

  it('sends a valid proof as multipart with the order tracking token', async () => {
    const apiRequest = vi.fn().mockResolvedValue({ id: 5, status: 'PENDING' })
    mountedOrders = createMountedOrders({ storeSlug: 'almacen-demo', apiRequest, now: () => 1000 })
    mountedOrders.storeOrders.addOrder({ orderId: 42, orderTrackingToken: 'private-token' })
    const file = new File(['image'], 'proof.png', { type: 'image/png' })

    await mountedOrders.storeOrders.submitTransferProof(42, file)

    const [path, options] = apiRequest.mock.calls[0]
    expect(path).toBe('/orders/current/transfer-proofs')
    expect(options.orderTrackingToken).toBe('private-token')
    expect(options.formData.get('file')).toBe(file)
  })
})