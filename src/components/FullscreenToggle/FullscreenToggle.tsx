import { useEffect, useState } from 'react'
import fullscreenEnter from '../../assets/figma/fullscreen-enter.svg'
import fullscreenExit from '../../assets/figma/fullscreen-exit.svg'
import { exitFullscreen, isFullscreenElementActive, isFullscreenSupported, isWebViewHost, requestFullscreen } from '../../lib/fullscreen'

// Persistent header control mirroring streamline-js's #fullscreen-toggle-btn: lets the
// user re-enter or leave fullscreen at any time, not just via the one-time load prompt.
export function FullscreenToggle() {
  const [supported] = useState(() => isFullscreenSupported() && !isWebViewHost())
  const [isFullscreen, setIsFullscreen] = useState(isFullscreenElementActive)

  useEffect(() => {
    if (!supported) return
    const sync = () => setIsFullscreen(isFullscreenElementActive())
    // fullscreenchange covers explicit enter/exit. visibilitychange is the fallback for
    // Android devices that silently drop fullscreen on sleep/lock without ever firing
    // fullscreenchange — without this the button stays stuck until a manual reload.
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [supported])

  if (!supported) return null

  const label = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'

  return <button
    className="control-button"
    type="button"
    aria-label={label}
    title={label}
    onClick={() => (isFullscreen ? exitFullscreen() : requestFullscreen())}
  >
    <img src={isFullscreen ? fullscreenExit : fullscreenEnter} alt="" />
  </button>
}
