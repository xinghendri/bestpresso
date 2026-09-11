export type ClockFormat = 'device' | '12h' | '24h'

export function clockOptions(format: ClockFormat = 'device'): Intl.DateTimeFormatOptions {
  return format === '24h' ? { hourCycle: 'h23' } : format === '12h' ? { hourCycle: 'h12' } : {}
}

export function formatDeviceTime(date: Date, locales?: Intl.LocalesArgument, format: ClockFormat = 'device') {
  return new Intl.DateTimeFormat(locales, { hour: 'numeric', minute: '2-digit', ...clockOptions(format) }).format(date)
}
