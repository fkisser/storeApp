import { describe, expect, it } from 'vitest'
import { DEFAULT_API_BASE_URL, resolveApiBaseUrl } from './store.js'

describe('resolveApiBaseUrl', () => {
  it('uses the development URL when no environment variable is defined', () => {
    expect(resolveApiBaseUrl()).toBe(DEFAULT_API_BASE_URL)
  })

  it('uses VITE_API_BASE_URL and removes its trailing slash', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: 'https://api.example.com/' }))
      .toBe('https://api.example.com')
  })

  it('falls back to the development URL for an invalid configured value', () => {
    expect(resolveApiBaseUrl({ VITE_API_BASE_URL: 'not a url' })).toBe(DEFAULT_API_BASE_URL)
  })
})
