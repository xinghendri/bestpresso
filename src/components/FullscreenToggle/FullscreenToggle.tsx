import { useEffect, useState } from 'react'
import fullscreenEnter from '../../assets/figma/fullscreen-enter.svg'
import fullscreenExit from '../../assets/figma/fullscreen-exit.svg'
import { exitFullscreen, isFullscreenActive, isFullscreenSupported, isWebViewHost, requestFullscreen } from '../../lib/fullscreen'

// Persistent header control mirroring streamline-js's #fullscreen-toggle-btn: lets the
// user re-enter or leave fullscreen at any time, not just via the one-time load prompt.
export function FullscreenToggle() {
  const [supported] = useState(() => isFullscreenSupported() && !isWebViewHost())
  const [isFullscreen, setIsFullscreen] = useState(isFullscreenActive)

  useEffect(() => {
    if (!supported) return
    const handleChange = () => setIsFullscreen(isFullscreenActive())
    document.addEventListener('fullscreenchange', handleChange)
    document.addEventListener('webkitfullscreenchange', handleChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleChange)
      document.removeEventListener('webkitfullscreenchange', handleChange)
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
