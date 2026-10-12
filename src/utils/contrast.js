export const DARK_TEXT_COLOR = '#1f2937'
export const LIGHT_TEXT_COLOR = '#f3f4f6'

const MIN_TEXT_CONTRAST = 4.5

const parseHexColor = (color) => {
  if (typeof color !== 'string') return null

  const hex = color.trim().replace('#', '')
  const normalizedHex = hex.length === 3
    ? hex.split('').map((channel) => channel + channel).join('')
    : hex

  if (!/^[\da-f]{6}$/i.test(normalizedHex)) return null

  return normalizedHex.match(/[\da-f]{2}/gi).map((channel) => Number.parseInt(channel, 16))
}

const getLuminance = (rgb) => {
  const [red, green, blue] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return red * 0.2126 + green * 0.7152 + blue * 0.0722
}

export const getContrastRatio = (firstColor, secondColor) => {
  const first = parseHexColor(firstColor)
  const second = parseHexColor(secondColor)
  if (!first || !second) return 1

  const [lighter, darker] = [getLuminance(first), getLuminance(second)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

export const blendColors = (foreground, background, alpha) => {
  const top = parseHexColor(foreground)
  const bottom = parseHexColor(background)
  if (!top || !bottom) return background

  const channels = top.map((channel, index) => Math.round(channel * alpha + bottom[index] * (1 - alpha)))
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

const getMinimumRatio = (color, backgrounds) =>
  Math.min(...backgrounds.map((background) => getContrastRatio(color, background)))

export const getContrastColor = (background) => {
  if (!parseHexColor(background)) return LIGHT_TEXT_COLOR

  return getContrastRatio(DARK_TEXT_COLOR, background) >= getContrastRatio(LIGHT_TEXT_COLOR, background)
    ? DARK_TEXT_COLOR
    : LIGHT_TEXT_COLOR
}

// Keeps the brand color when it is readable on every given background; otherwise falls back to light or dark gray.
export const getReadableColor = (preferredColor, backgrounds) => {
  if (!parseHexColor(preferredColor)) return preferredColor
  if (getMinimumRatio(preferredColor, backgrounds) >= MIN_TEXT_CONTRAST) return preferredColor

  return getMinimumRatio(DARK_TEXT_COLOR, backgrounds) >= getMinimumRatio(LIGHT_TEXT_COLOR, backgrounds)
    ? DARK_TEXT_COLOR
    : LIGHT_TEXT_COLOR
}
