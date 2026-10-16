import { ref, reactive } from 'vue'
import { requestStoreApi } from '../api/store.js'
import { STORE_SLUG } from '../config/store.js'

const ORDER_TTL_MS = 30 * 24 * 60 * 60 * 1000
const MAX_PROOF_SIZE = 5 * 1024 * 1024
const ACCEPTED_PROOF_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const useStoreOrders = ({
  storeSlug = STORE_SLUG,
  apiRequest = requestStoreApi,
  now = () => Date.now()
} = {}) => {
  const storageKey = `vitrinapp-orders-${encodeURIComponent(storeSlug)}`
  const orders = ref([])
  const loading = ref(false)
  const orderErrors = reactive({})
  const transferErrors = reactive({})
  const transferSuccess = reactive({})
  const uploadingProofs = reactive({})

  const persistOrders = () => {
    if (typeof window === 'undefined') return false
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(orders.value))
      return true
    } catch {
      return false
    }
  }

  const restoreOrders = () => {
    if (typeof window === 'undefined') return
    try {
      const savedOrders = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]')
      const currentTime = now()
      orders.value = Array.isArray(savedOrders)
        ? savedOrders.filter((order) =>
          typeof order?.orderTrackingToken === 'string' &&
          order.orderTrackingToken.length > 0 &&
          Number(order.expiresAt) > currentTime &&
          order.orderStatus !== 'COMPLETED'
        )
        : []
      persistOrders()
    } catch {
      orders.value = []
      persistOrders()
    }
  }

  const addOrder = (order) => {
    if (order?.orderId === undefined || order?.orderId === null || !String(order.orderId).trim()) {
      throw new Error('La API no devolvio el identificador del pedido.')
    }
    if (typeof order.orderTrackingToken !== 'string' || !order.orderTrackingToken) {
      throw new Error('La API no devolvio el token de seguimiento del pedido.')
    }
    const createdAt = order.createdAt ?? new Date(now()).toISOString()
    const record = {
      orderId: order.orderId,
      orderTrackingToken: order.orderTrackingToken,
      orderStatus: order.orderStatus,
      paymentProvider: order.paymentProvider,
      fulfillmentType: order.fulfillmentType,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt,
      scheduledDate: order.scheduledDate,
      scheduledStartsAt: order.scheduledStartsAt,
      scheduledEndsAt: order.scheduledEndsAt,
      transferAlias: order.transferAlias,
      transferAccountHolder: order.transferAccountHolder,
      expiresAt: now() + ORDER_TTL_MS
    }
    orders.value = [record, ...orders.value.filter((item) => item.orderId !== record.orderId)]
    if (!persistOrders()) throw new Error('No se pudo guardar el pedido en este navegador.')
    return record
  }

  const removeOrder = (orderId) => {
    orders.value = orders.value.filter((order) => order.orderId !== orderId)
    delete orderErrors[orderId]
    delete transferErrors[orderId]
    delete transferSuccess[orderId]
    delete uploadingProofs[orderId]
    persistOrders()
  }

  const refreshOrder = async (orderId) => {
    const order = orders.value.find((item) => item.orderId === orderId)
    if (!order) return null
    if (Number(order.expiresAt) <= now()) {
      removeOrder(orderId)
      return null
    }

    try {
      const current = await apiRequest('/orders/current', {
        orderTrackingToken: order.orderTrackingToken
      })
      order.orderStatus = current.status
      order.fulfillmentType = current.fulfillmentType
      order.totalAmount = current.totalAmount
      order.currency = current.currency
      order.createdAt = current.createdAt
      order.scheduledDate = current.scheduledDate
      order.scheduledStartsAt = current.scheduledStartsAt
      order.scheduledEndsAt = current.scheduledEndsAt
      delete orderErrors[orderId]
      if (current.status === 'COMPLETED') {
        removeOrder(orderId)
        return null
      }
      persistOrders()
      return order
    } catch (error) {
      if (error.status === 404) removeOrder(orderId)
      else orderErrors[orderId] = error.message || 'No se pudo consultar el pedido.'
      return null
    }
  }

  const refreshAll = async () => {
    loading.value = true
    await Promise.all(orders.value.map((order) => refreshOrder(order.orderId)))
    loading.value = false
  }

  const submitTransferProof = async (orderId, file) => {
    const order = orders.value.find((item) => item.orderId === orderId)
    if (!order) throw new Error('No se encontro el pedido.')
    if (!file || !ACCEPTED_PROOF_TYPES.has(file.type) || file.size > MAX_PROOF_SIZE) {
      throw new Error('El comprobante debe ser JPEG, PNG o WebP y pesar hasta 5 MiB.')
    }

    const formData = new FormData()
    formData.append('file', file)
    uploadingProofs[orderId] = true
    transferErrors[orderId] = ''
    transferSuccess[orderId] = ''
    try {
      const proof = await apiRequest('/orders/current/transfer-proofs', {
        method: 'POST',
        orderTrackingToken: order.orderTrackingToken,
        formData
      })
      transferSuccess[orderId] = 'Comprobante enviado para revision.'
      return proof
    } catch (error) {
      transferErrors[orderId] = error.status === 409
        ? 'Este pedido no admite un comprobante en este momento.'
        : error.status === 422
          ? 'El archivo no es valido. Elige un JPEG, PNG o WebP de hasta 5 MiB.'
          : error.message || 'No se pudo enviar el comprobante.'
      throw error
    } finally {
      uploadingProofs[orderId] = false
    }
  }

  restoreOrders()

  return {
    addOrder,
    loading,
    orderErrors,
    orders,
    refreshAll,
    refreshOrder,
    removeOrder,
    restoreOrders,
    submitTransferProof,
    transferErrors,
    transferSuccess,
    uploadingProofs
  }
}