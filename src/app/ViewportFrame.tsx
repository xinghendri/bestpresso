import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

const DESIGN_WIDTH = 1194
const DESIGN_HEIGHT = 834

const viewportScale = () => {
  const width = window.visualViewport?.width ?? window.innerWidth
  const height = window.visualViewport?.height ?? window.innerHeight
  return Math.max(0.1, Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT))
}

export function ViewportFrame({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(viewportScale)

  useEffect(() => {
    const updateScale = () => setScale(viewportScale())
    window.addEventListener('resize', updateScale)
    window.visualViewport?.addEventListener('resize', updateScale)
    return () => {
      window.removeEventListener('resize', updateScale)
      window.visualViewport?.removeEventListener('resize', updateScale)
    }
  }, [])

  return <div className="app-viewport" style={{ '--app-scale': scale } as CSSProperties}>{children}</div>
}
