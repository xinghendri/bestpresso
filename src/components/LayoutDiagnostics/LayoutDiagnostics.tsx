import { useEffect, useState } from 'react'
import { formatViewportDiagnostics } from '../../domain/layout'

function readViewport() {
  return formatViewportDiagnostics(
    window.innerWidth,
    window.innerHeight,
    window.devicePixelRatio,
    window.visualViewport?.width,
    window.visualViewport?.height,
  )
}

export function LayoutDiagnostics() {
  const enabled = new URLSearchParams(window.location.search).get('layoutDebug') === '1'
  const [viewport, setViewport] = useState(enabled ? readViewport : '')

  useEffect(() => {
    if (!enabled) return
    const update = () => setViewport(readViewport())
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('resize', update)
    }
  }, [enabled])

  if (!enabled) return null
  return <output className="layout-diagnostics" aria-live="polite">{viewport}</output>
}
