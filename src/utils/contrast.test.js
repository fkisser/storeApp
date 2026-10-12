import { describe, expect, it } from 'vitest'
import {
  DARK_TEXT_COLOR,
  LIGHT_TEXT_COLOR,
  blendColors,
  getContrastColor,
  getContrastRatio,
  getReadableColor
} from './contrast.js'

describe('contrast utilities', () => {
  it('chooses dark text on light backgrounds and light text on dark backgrounds', () => {
    expect(getContrastColor('#ffffff')).toBe(DARK_TEXT_COLOR)
    expect(getContrastColor('#ffb703')).toBe(DARK_TEXT_COLOR)
    expect(getContrastColor('#111111')).toBe(LIGHT_TEXT_COLOR)
    expect(getContrastColor('#2e7d32')).toBe(LIGHT_TEXT_COLOR)
  })

  it('supports short hex colors and falls back to light text for invalid values', () => {
    expect(getContrastColor('#fff')).toBe(DARK_TEXT_COLOR)
    expect(getContrastColor('not-a-color')).toBe(LIGHT_TEXT_COLOR)
  })

  it('blends a translucent color over a background', () => {
    expect(blendColors('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(blendColors('#ffffff', '#000000', 1)).toBe('#ffffff')
  })

  it('keeps a readable brand color and replaces an unreadable one', () => {
    expect(getReadableColor('#2e7d32', ['#ffffff'])).toBe('#2e7d32')
    expect(getReadableColor('#ffe066', ['#ffffff'])).toBe(DARK_TEXT_COLOR)
    expect(getReadableColor('#2e7d32', ['#102010'])).toBe(LIGHT_TEXT_COLOR)
  })

  it('computes the WCAG contrast ratio', () => {
    expect(getContrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })
})
