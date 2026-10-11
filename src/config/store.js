export const API_BASE_URL = 'https://wt7ddvj5-8080.brs.devtunnels.ms'

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