import { describe, expect, it } from 'vitest'
import { isStoreCurrentlyOpen, normalizeWeeklyHours } from './storeHours.js'

describe('storeHours', () => {
  it('normalizes weekday ranges and marks omitted days closed', () => {
    const hours = normalizeWeeklyHours([
      { dayOfWeek: 1, opensAt: '09:00', closesAt: '17:00' },
      { dayOfWeek: 'TUESDAY', closed: true }
    ])

    expect(hours[0]).toMatchObject({ label: 'Lunes', closed: false })
    expect(hours[0].ranges).toEqual([{ start: 540, end: 1020 }])
    expect(hours[1]).toMatchObject({ label: 'Martes', closed: true })
    expect(hours[2].label).toBe('Miércoles')
    expect(hours.at(-1)).toMatchObject({ label: 'Domingo', closed: true })
    expect(normalizeWeeklyHours([{ dayOfWeek: 7, opensAt: '10:00', closesAt: '14:00' }])[6])
      .toMatchObject({ label: 'Domingo', closed: false })
  })

  it('handles current open, closed, and overnight windows', () => {
    const hours = normalizeWeeklyHours({
      monday: { open: '22:00', close: '02:00' }
    })

    expect(isStoreCurrentlyOpen(hours, new Date(2026, 9, 12, 23, 30))).toBe(true)
    expect(isStoreCurrentlyOpen(hours, new Date(2026, 9, 12, 8, 0))).toBe(false)
    expect(isStoreCurrentlyOpen([], new Date())).toBeNull()
  })
})