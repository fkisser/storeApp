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

const requestedSlug = globalThis.window?.location.pathname.split('/').filter(Boolean)[0]
let storeSlug = 'almacen-demo'

export const IS_HOME = !requestedSlug

if (requestedSlug) {
	try {
		storeSlug = decodeURIComponent(requestedSlug)
	} catch {
		storeSlug = requestedSlug
	}
}

export const STORE_SLUG = storeSlug
