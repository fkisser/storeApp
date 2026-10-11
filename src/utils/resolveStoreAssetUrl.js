import { API_BASE_URL } from '../config/store.js'

const supportedProtocols = new Set(['http:', 'https:', 'data:', 'blob:'])

export const resolveStoreAssetUrl = (source) => {
  if (typeof source !== 'string' || !source.trim()) return ''

  try {
    const url = new URL(source.trim(), `${API_BASE_URL}/`)
    return supportedProtocols.has(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}