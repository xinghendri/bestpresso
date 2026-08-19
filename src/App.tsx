import { useEffect, useState } from 'react'
import { AppShell } from './app/AppShell'
import { useBrewingData } from './features/brew/useBrewingData'
import { SettingsPanel } from './features/settings/SettingsPanel'
import './styles/index.css'

const isSettingsPage = () => new URLSearchParams(window.location.search).get('page') === 'settings'

export default function App() {
  const data = useBrewingData()
  const [settingsOpen, setSettingsOpen] = useState(isSettingsPage)

  useEffect(() => {
    const handlePopState = () => setSettingsOpen(isSettingsPage())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (open: boolean) => {
    const url = new URL(window.location.href)
    if (open) url.searchParams.set('page', 'settings')
    else url.searchParams.delete('page')
    window.history.pushState({ page: open ? 'settings' : 'home' }, '', url)
    setSettingsOpen(open)
  }

  if (settingsOpen) return <SettingsPanel gatewayHost={data.gatewayHost} connection={data.connection} onClose={() => navigate(false)} />
  return <AppShell {...data} onSleep={data.toggleSleep} onOpenSettings={() => navigate(true)} />
}
