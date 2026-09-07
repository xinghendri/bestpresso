type DocumentWithVendorFullscreen = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenEnabled?: boolean
  mozFullScreenElement?: Element | null
  mozCancelFullScreen?: () => Promise<void> | void
  mozFullScreenEnabled?: boolean
  msFullscreenElement?: Element | null
  msExitFullscreen?: () => Promise<void> | void
  msFullscreenEnabled?: boolean
}

type ElementWithVendorFullscreen = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
  mozRequestFullScreen?: () => Promise<void> | void
  msRequestFullscreen?: () => Promise<void> | void
}

type NavigatorWithStandalone = Navigator & { standalone?: boolean }
type WindowWithDecentHost = Window & { __DECENT_HOST__?: unknown }

export type FullscreenPromptVariant = 'hidden' | 'fullscreen' | 'ios'

export interface FullscreenPromptSignals {
  active: boolean
  fullscreenSupported: boolean
  ios: boolean
  mobileOrTablet: boolean
  standalone: boolean
  webView: boolean
}

export function fullscreenPromptVariant(signals: FullscreenPromptSignals): FullscreenPromptVariant {
  if (signals.active || signals.standalone || signals.webView) return 'hidden'
  if (signals.ios) return 'ios'
  return signals.mobileOrTablet && signals.fullscreenSupported ? 'fullscreen' : 'hidden'
}

export function isFullscreenSupported() {
  const doc = document as DocumentWithVendorFullscreen
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled || doc.mozFullScreenEnabled || doc.msFullscreenEnabled)
}

export function isFullscreenElementActive() {
  const doc = document as DocumentWithVendorFullscreen
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement)
}

export function isFullscreenActive() {
  if (isFullscreenElementActive()) return true
  if (!screen.width || !screen.height) return false
  return window.innerWidth / screen.width >= .95 && window.innerHeight / screen.height >= .95
}

export function isIOSDevice() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/i.test(ua) || (ua.includes('Mac') && (navigator.maxTouchPoints > 0 || 'ontouchend' in document))
}

const isStandaloneDisplay = () => {
  const iosStandalone = (window.navigator as NavigatorWithStandalone).standalone === true
  const displayStandalone = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayStandalone
}

export function isWebViewHost() {
  const ua = navigator.userAgent
  const standalone = isStandaloneDisplay()
  const androidWebView = /Android/i.test(ua) && /\bwv\b/i.test(ua)
  const iosWebView = isIOSDevice() && !standalone && !/Safari\//i.test(ua)
  return androidWebView || iosWebView || /Decent/i.test(ua) || Boolean((window as WindowWithDecentHost).__DECENT_HOST__)
}

const isMobileOrTabletBrowser = () => {
  const ua = navigator.userAgent
  const coarsePointer = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
  return isIOSDevice() || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) || (navigator.maxTouchPoints > 0 && coarsePointer)
}

export function browserFullscreenPromptVariant(): FullscreenPromptVariant {
  return fullscreenPromptVariant({
    active: isFullscreenActive(),
    fullscreenSupported: isFullscreenSupported(),
    ios: isIOSDevice(),
    mobileOrTablet: isMobileOrTabletBrowser(),
    standalone: isStandaloneDisplay(),
    webView: isWebViewHost(),
  })
}

export async function requestFullscreen() {
  const element = document.documentElement as ElementWithVendorFullscreen
  const request = element.requestFullscreen || element.webkitRequestFullscreen || element.mozRequestFullScreen || element.msRequestFullscreen
  if (!request) return false
  try {
    await Promise.resolve(request.call(element))
    try {
      await screen.orientation?.lock?.('landscape')
    } catch {
      // Orientation locking is optional; fullscreen itself has already succeeded.
    }
    return true
  } catch {
    return false
  }
}

export async function exitFullscreen() {
  const doc = document as DocumentWithVendorFullscreen
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen
  if (!exit) return false
  try {
    try {
      screen.orientation?.unlock?.()
    } catch {
      // A failed orientation unlock must not prevent leaving fullscreen.
    }
    await Promise.resolve(exit.call(doc))
    return true
  } catch {
    return false
  }
}
