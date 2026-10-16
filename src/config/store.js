export const DEFAULT_API_BASE_URL = 'https://wt7ddvj5-8080.brs.devtunnels.ms'

export const resolveApiBaseUrl = (environment = {}) => {
  const configuredUrl = environment.VITE_API_BASE_URL ?? environment.API_BASE_URL

  if (typeof configuredUrl !== 'string' || !configuredUrl.trim()) {
    return DEFAULT_API_BASE_URL
  }

  try {
    const url = new URL(configuredUrl.trim())
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_API_BASE_URL
    return url.href.replace(/\/$/, '')
  } catch {
    return DEFAULT_API_BASE_URL
  }
}

const runtimeEnvironment = {
  VITE_API_BASE_URL: import.meta.env?.VITE_API_BASE_URL ?? globalThis.process?.env?.VITE_API_BASE_URL,
  API_BASE_URL: globalThis.process?.env?.API_BASE_URL
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
