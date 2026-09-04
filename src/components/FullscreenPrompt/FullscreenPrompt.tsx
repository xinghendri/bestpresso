import { useEffect, useState } from 'react'
import { isFullscreenActive, isIOSBrowser, isIOSDevice, isWebViewHost, requestFullscreen } from '../../lib/fullscreen'

const dismissedKey = 'fullscreenPromptDismissed'

// Ported from streamline-js's app.js fullscreen-recommendation flow: prompt once per
// session so kiosk-style tablet browsers hide their chrome, but never on desktop, in an
// embedding webview (the host OS already owns fullscreen there), or when already fullscreen.
function initialVariant(): 'hidden' | 'fullscreen' | 'ios' {
  const ua = navigator.userAgent
  // A plain 'Mac' check also matches iPhone/iPad (their UA embeds "like Mac OS X", and
  // iPad Safari's default desktop-site UA is indistinguishable from a real Mac's), so a
  // real Mac is only ever non-touch — iPads and iPhones report touch support.
  const isDesktop = ua.includes('Win') || (ua.includes('Mac') && !isIOSDevice())
  if (isDesktop || isWebViewHost() || isFullscreenActive()) return 'hidden'
  let dismissed = false
  try {
    dismissed = sessionStorage.getItem(dismissedKey) === 'true'
  } catch {
    // sessionStorage can throw in locked-down browser contexts; treat as not dismissed.
  }
  if (dismissed) return 'hidden'
  return isIOSBrowser() ? 'ios' : 'fullscreen'
}

export function FullscreenPrompt() {
  const [variant, setVariant] = useState(initialVariant)

  useEffect(() => {
    if (variant === 'hidden') return
    const handleChange = () => {
      if (isFullscreenActive()) setVariant('hidden')
    }
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
    }
  }, [variant])

  if (variant === 'hidden') return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissedKey, 'true')
    } catch {
      // Best-effort persistence; the dialog still closes for this render.
    }
    setVariant('hidden')
  }

  return <div className="fullscreen-prompt-overlay" role="presentation">
    <section className="fullscreen-prompt" role="dialog" aria-modal="true" aria-labelledby="fullscreen-prompt-title" aria-describedby="fullscreen-prompt-body">
      {variant === 'ios'
        ? <>
          <h2 id="fullscreen-prompt-title">Add to Home Screen</h2>
          <p id="fullscreen-prompt-body">Tap the Share button, then &quot;Add to Home Screen&quot; for a fullscreen experience.</p>
          <div className="fullscreen-prompt__actions">
            <button type="button" className="fullscreen-prompt__primary" onClick={dismiss}>Got it</button>
          </div>
        </>
        : <>
          <h2 id="fullscreen-prompt-title">Fullscreen Recommended</h2>
          <p id="fullscreen-prompt-body">For the best experience, please use fullscreen mode.</p>
          <div className="fullscreen-prompt__actions">
            <button type="button" className="fullscreen-prompt__primary" onClick={() => { requestFullscreen(); dismiss() }}>Enter Fullscreen</button>
            <button type="button" className="fullscreen-prompt__secondary" onClick={dismiss}>Later</button>
          </div>
        </>}
    </section>
  </div>
}
