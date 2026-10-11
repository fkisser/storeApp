import { STORE_SLUG } from '../config/store.js'

export const storeApiPath = `/api/v1/stores/${encodeURIComponent(STORE_SLUG)}`

export const requestStoreApi = async (path, { method = 'GET', cartToken, body } = {}) => {
  const headers = { Accept: 'application/json' }
  if (cartToken) headers['X-Cart-Token'] = cartToken
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const response = await fetch(`${storeApiPath}${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })

  if (!response.ok) {
    let message = `Error de API (${response.status})`
    try {
      const payload = await response.json()
      message = payload.message ?? payload.error ?? message
    } catch {
      // The response may not contain JSON.
    }
    const error = new Error(message)
    error.status = response.status
    throw error
  }

  if (response.status === 204) return null
  return response.json()
}