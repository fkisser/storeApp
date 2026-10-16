import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from './store.js'

describe('resolveApiBaseUrl', () => {
  it('returns an empty value when no environment variable is defined', () => {
    expect(resolveApiBaseUrl()).toBe('')
  })

  it('uses API_BASE_URL and removes its trailing slash', () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: 'https://api.example.com/' }))
      .toBe('https://api.example.com')
  })

  it('returns an empty value for an invalid configured value', () => {
    expect(resolveApiBaseUrl({ API_BASE_URL: 'not a url' })).toBe('')
  })
})
