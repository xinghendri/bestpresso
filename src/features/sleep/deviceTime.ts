export function formatDeviceTime(date: Date, locales?: Intl.LocalesArgument) {
  // Deliberately leave hour12 unset so the tablet WebView uses the device's
  // preferred hour cycle: 24-hour or 12-hour with the appropriate day period.
  return new Intl.DateTimeFormat(locales, { hour: 'numeric', minute: '2-digit' }).format(date)
}
