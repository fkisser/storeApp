const DAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado'
]
const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const DAY_ALIASES = new Map([
  ['sunday', 0], ['sun', 0], ['domingo', 0], ['dom', 0],
  ['monday', 1], ['mon', 1], ['lunes', 1], ['lun', 1],
  ['tuesday', 2], ['tue', 2], ['martes', 2], ['mar', 2],
  ['wednesday', 3], ['wed', 3], ['miercoles', 3], ['mie', 3],
  ['thursday', 4], ['thu', 4], ['jueves', 4], ['jue', 4],
  ['friday', 5], ['fri', 5], ['viernes', 5], ['vie', 5],
  ['saturday', 6], ['sat', 6], ['sabado', 6], ['sab', 6]
])

const normaliseDay = (value) => {
  if (Number.isInteger(value) && value >= 0 && value <= 7) return value === 7 ? 0 : value
  if (typeof value !== 'string') return null
  const key = value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (/^[0-6]$/.test(key)) return Number(key)
  return DAY_ALIASES.get(key) ?? null
}

const normaliseTime = (value) => {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null
}

const readRange = (range) => {
  const startsAt = range.startsAt ?? range.start ?? range.startTime ?? range.open ??
    range.openTime ?? range.openingTime ?? range.opensAt
  const endsAt = range.endsAt ?? range.end ?? range.endTime ?? range.close ??
    range.closeTime ?? range.closingTime ?? range.closesAt
  const start = normaliseTime(startsAt)
  const end = normaliseTime(endsAt)
  return start === null || end === null ? null : { start, end }
}

const readRows = (value) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value.days)) return value.days
  if (Array.isArray(value.weeklySchedule)) return value.weeklySchedule
  return Object.entries(value).map(([day, schedule]) => ({ day, ...(schedule ?? {}) }))
}

export const normalizeWeeklyHours = (value) => {
  const rows = readRows(value)
  const schedule = new Map()

  for (const row of rows) {
    const dayIndex = normaliseDay(row.dayOfWeek ?? row.weekday ?? row.day ?? row.dayName)
    if (dayIndex === null) continue

    const rangesValue = row.windows ?? row.ranges ?? row.periods
    const ranges = Array.isArray(rangesValue)
      ? rangesValue.map(readRange).filter(Boolean)
      : [readRange(row)].filter(Boolean)
    const explicitlyClosed = row.closed === true || row.isClosed === true ||
      row.isOpen === false || row.enabled === false
    schedule.set(dayIndex, {
      dayIndex,
      label: DAY_LABELS[dayIndex],
      closed: explicitlyClosed || ranges.length === 0,
      ranges
    })
  }

  if (schedule.size === 0) return []
  return DAY_NAMES.map((_, dayIndex) => schedule.get(dayIndex) ?? {
    dayIndex,
    label: DAY_LABELS[dayIndex],
    closed: true,
    ranges: []
  }).slice(1).concat(schedule.get(0) ?? {
    dayIndex: 0,
    label: DAY_LABELS[0],
    closed: true,
    ranges: []
  })
}

export const isStoreCurrentlyOpen = (weeklyHours, date = new Date(), timeZone = '') => {
  if (!Array.isArray(weeklyHours) || weeklyHours.length === 0) return null
  let dayIndex = date.getDay()
  let currentMinute = date.getHours() * 60 + date.getMinutes()
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(date)
      const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
      dayIndex = DAY_ALIASES.get(values.weekday.toLocaleLowerCase('en')) ?? dayIndex
      currentMinute = Number(values.hour) * 60 + Number(values.minute)
    } catch {
      // Fall back to the browser timezone when the store timezone is invalid.
    }
  }
  const daySchedule = weeklyHours.find((day) => day.dayIndex === dayIndex)
  if (!daySchedule) return null
  if (daySchedule.closed || daySchedule.ranges.length === 0) return false

  return daySchedule.ranges.some(({ start, end }) => start <= end
    ? currentMinute >= start && currentMinute < end
    : currentMinute >= start || currentMinute < end)
}