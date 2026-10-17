export const resolveApiBaseUrl = (environment = {}) => {
  const configuredUrl = environment.API_BASE_URL

  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) {
    return ''
  }

  try {
    const url = new URL(configuredUrl.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.href.replace(/\/$/, '')
  } catch {
    return ''
  }
}

const runtimeEnvironment = {
  API_BASE_URL: import.meta.env?.API_BASE_URL ?? globalThis.process?.env?.API_BASE_URL
}

export const API_BASE_URL = resolveApiBaseUrl(runtimeEnvironment)

const pathnameSegments = globalThis.window?.location.pathname.split('/').filter(Boolean) ?? []
const requestedSlug = pathnameSegments[0]
let storeSlug = 'almacen-demo'

export const IS_HOME = !requestedSlug

export const resolveRequestedOrderId = (pathname = '', search = '') => {
  const segments = pathname.split('/').filter(Boolean)
  const pathOrderId = segments[1] === 'orders' ? segments[2] : ''
  const queryOrderId = new URLSearchParams(search).get('orderId')
  if (queryOrderId) return queryOrderId.trim()
  if (!pathOrderId) return ''

  try {
    return decodeURIComponent(pathOrderId).trim()
  } catch {
    return pathOrderId.trim()
  }
}

export const REQUESTED_ORDER_ID = resolveRequestedOrderId(
  globalThis.window?.location.pathname ?? '',
  globalThis.window?.location.search ?? ''
)

if (requestedSlug) {
	try {
		storeSlug = decodeURIComponent(requestedSlug)
	} catch {
		storeSlug = requestedSlug
	}
}

export const STORE_SLUG = storeSlug
