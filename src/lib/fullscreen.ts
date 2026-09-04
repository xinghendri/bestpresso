// Shared fullscreen detection/control, ported from streamline-js's app.js/ui.js
// fullscreen handling. Used by both the on-load FullscreenPrompt and the persistent
// FullscreenToggle button.

type DocumentWithVendorFullscreen = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
  webkitFullscreenEnabled?: boolean
  mozFullScreenElement?: Element | null
  mozCancelFullScreen?: () => Promise<void>
  mozFullScreenEnabled?: boolean
  msFullscreenElement?: Element | null
  msExitFullscreen?: () => Promise<void>
  msFullscreenEnabled?: boolean
}

type ElementWithVendorFullscreen = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
  mozRequestFullScreen?: () => Promise<void>
  msRequestFullscreen?: () => Promise<void>
}

export function isFullscreenSupported() {
  const doc = document as DocumentWithVendorFullscreen
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled || doc.mozFullScreenEnabled || doc.msFullscreenEnabled)
}

// Accounts for both the browser fullscreen API and webviews that start fullscreen
// without ever setting fullscreenElement (viewport already matches screen size).
export function isFullscreenActive() {
  const doc = document as DocumentWithVendorFullscreen
  if (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement) return true
  const widthRatio = window.innerWidth / screen.width
  const heightRatio = window.innerHeight / screen.height
  return widthRatio >= 0.95 && heightRatio >= 0.95
}

export function isIOSDevice() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Mac') && 'ontouchend' in document)
}

export function isIOSBrowser() {
  const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return isIOSDevice() && !isStandalone
}

// The host OS owns fullscreen inside an embedding webview, so prompting/toggling
// there is never useful — this only ever hides UI, never a real browser tab.
export function isWebViewHost() {
  const ua = navigator.userAgent
  const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  const isAndroidWebView = /Android/.test(ua) && /wv/.test(ua)
  const isIOSWebView = isIOSDevice() && !isStandalone && !/Safari\//.test(ua)
  const isDecentWebView = ua.includes('Decent')
  const isDecentHost = Boolean((window as Window & { __DECENT_HOST__?: unknown }).__DECENT_HOST__)
  return isAndroidWebView || isIOSWebView || isDecentWebView || isDecentHost
}

export function requestFullscreen() {
  const el = document.documentElement as ElementWithVendorFullscreen
  const request = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen
  if (!request) return
  request.call(el).then(() => {
    screen.orientation?.lock?.('landscape').catch(() => {
      // Orientation lock is best-effort; unsupported browsers keep their current orientation.
    })
  }).catch(() => {
    // Fullscreen can be denied by the browser (e.g. no user-activation); callers just no-op.
  })
}

export function exitFullscreen() {
  const doc = document as DocumentWithVendorFullscreen
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen
  if (!exit) return
  screen.orientation?.unlock?.()
  exit.call(doc).catch(() => {
    // Exiting can be denied in rare cases; callers just no-op.
  })
}
