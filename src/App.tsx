import { useEffect, useState } from 'react'
import { AppShell } from './app/AppShell'
import { useBrewingData } from './features/brew/useBrewingData'
import { ProfilesPanel } from './features/profiles/ProfilesPanel'
import { SettingsPanel } from './features/settings/SettingsPanel'
import './styles/index.css'

type AppPage = 'home' | 'settings' | 'profiles'

const currentPage = (): AppPage => {
  const page = new URLSearchParams(window.location.search).get('page')
  return page === 'settings' || page === 'profiles' ? page : 'home'
}

export default function App() {
  const data = useBrewingData()
  const [page, setPage] = useState(currentPage)

  useEffect(() => {
    const handlePopState = () => setPage(currentPage())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = (nextPage: AppPage) => {
    const url = new URL(window.location.href)
    if (nextPage === 'home') url.searchParams.delete('page')
    else url.searchParams.set('page', nextPage)
    window.history.pushState({ page: nextPage }, '', url)
    setPage(nextPage)
  }

  if (page === 'settings') return <SettingsPanel gatewayHost={data.gatewayHost} connection={data.connection} onClose={() => navigate('home')} />
  if (page === 'profiles') return <ProfilesPanel profiles={data.allProfiles} favoriteProfileIds={data.favoriteProfileIds} onClose={() => navigate('home')} />
  return <AppShell {...data} onSleep={data.toggleSleep} onOpenSettings={() => navigate('settings')} onManageProfiles={() => navigate('profiles')} />
}
