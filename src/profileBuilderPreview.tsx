import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ValueAdjustmentProvider } from './components/ValueAdjustment/ValueAdjustmentProvider'
import { ProfileBuilderScreen } from './features/profiles/ProfileBuilderScreen'
import './styles/index.css'

export function Preview() {
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.pb-stage.is-collapsed')?.click()
      if (new URLSearchParams(window.location.search).get('panel') === 'conditions') {
        window.setTimeout(() => document.querySelector<HTMLElement>('[role="tablist"] [role="tab"]:last-child')?.click(), 40)
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return <ProfileBuilderScreen onClose={() => undefined} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ValueAdjustmentProvider>
      <Preview />
    </ValueAdjustmentProvider>
  </StrictMode>,
)
