import { useEffect, useState } from 'react'
import { getDecaidSettingsUrl } from './api/decaid/config'
import { AppShell } from './app/AppShell'
import { useBrewingData } from './features/brew/useBrewingData'
import { ProfilesPanel } from './features/profiles/ProfilesPanel'
import './styles/index.css'

type AppPage = 'home' | 'profiles'

const currentPage = (): AppPage => {
  const page = new URLSearchParams(window.location.search).get('page')
  return page === 'profiles' ? page : 'home'
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

  if (page === 'profiles') return <ProfilesPanel profiles={data.allProfiles} favoriteProfileIds={data.favoriteProfileIds} onClose={() => navigate('home')} />
  return <AppShell {...data} onSleep={data.toggleSleep} onSearchScale={data.searchForScale} onOpenSettings={() => window.location.assign(getDecaidSettingsUrl())} onManageProfiles={() => navigate('profiles')} />
}
