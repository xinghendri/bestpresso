import { useEffect, useState } from 'react'
import { browserFullscreenPromptVariant, isFullscreenElementActive, requestFullscreen, type FullscreenPromptVariant } from '../../lib/fullscreen'

const dismissedKey = 'bestpresso.fullscreen-prompt-dismissed.v1'

const initialVariant = (): FullscreenPromptVariant => {
  try {
    if (sessionStorage.getItem(dismissedKey) === 'true') return 'hidden'
  } catch {
    // Locked-down browser contexts may not expose session storage.
  }
  return browserFullscreenPromptVariant()
}

export function FullscreenPrompt({ defer = false }: { defer?: boolean }) {
  const [variant, setVariant] = useState(initialVariant)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (variant === 'hidden') return
    const sync = () => {
      if (isFullscreenElementActive()) setVariant('hidden')
    }
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    }
  }, [variant])

  if (variant === 'hidden' || defer) return null

  const dismiss = () => {
    try {
      sessionStorage.setItem(dismissedKey, 'true')
    } catch {
      // The prompt still closes for this session render.
    }
    setVariant('hidden')
  }

  const enterFullscreen = async () => {
    setPending(true)
    setError(false)
    const entered = await requestFullscreen()
    setPending(false)
    if (entered) dismiss()
    else setError(true)
  }

  return <div className="fullscreen-prompt-overlay">
    <section className="fullscreen-prompt" role="dialog" aria-modal="true" aria-labelledby="fullscreen-prompt-title" aria-describedby="fullscreen-prompt-body">
      {variant === 'ios'
        ? <>
          <h2 id="fullscreen-prompt-title">Add to Home Screen</h2>
          <p id="fullscreen-prompt-body">Tap Share, then Add to Home Screen for the best fullscreen experience.</p>
          <div className="fullscreen-prompt__actions"><button type="button" className="fullscreen-prompt__primary" onClick={dismiss}>Got it</button></div>
        </>
        : <>
          <h2 id="fullscreen-prompt-title">Fullscreen recommended</h2>
          <p id="fullscreen-prompt-body">Use fullscreen to give your controls more room.</p>
          {error && <p className="fullscreen-prompt__error" role="alert">Fullscreen could not be opened. You can continue normally.</p>}
          <div className="fullscreen-prompt__actions">
            <button type="button" className="fullscreen-prompt__primary" disabled={pending} onClick={() => void enterFullscreen()}>{pending ? 'Opening…' : 'Enter fullscreen'}</button>
            <button type="button" className="fullscreen-prompt__secondary" disabled={pending} onClick={dismiss}>Later</button>
          </div>
        </>}
    </section>
  </div>
}
