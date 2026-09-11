import { useEffect, useState } from 'react'
import fullscreenEnter from '../../assets/figma/fullscreen-enter-glyph.svg'
import fullscreenExit from '../../assets/figma/fullscreen-exit-glyph.svg'
import { exitFullscreen, isFullscreenElementActive, isFullscreenSupported, isWebViewHost, requestFullscreen } from '../../lib/fullscreen'

export function FullscreenToggle() {
  const [supported] = useState(() => isFullscreenSupported() && !isWebViewHost())
  const [isFullscreen, setIsFullscreen] = useState(isFullscreenElementActive)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!supported) return
    const sync = () => setIsFullscreen(isFullscreenElementActive())
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

  const label = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
  const toggle = async () => {
    setPending(true)
    const changed = isFullscreen ? await exitFullscreen() : await requestFullscreen()
    if (changed) setIsFullscreen(isFullscreenElementActive())
    setPending(false)
  }

  return <button className="control-button control-button--fullscreen" type="button" aria-label={label} aria-pressed={isFullscreen} title={label} disabled={pending} onClick={() => void toggle()}>
    <img src={isFullscreen ? fullscreenExit : fullscreenEnter} alt="" />
  </button>
}
