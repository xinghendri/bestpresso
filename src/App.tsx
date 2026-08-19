import { useEffect, useState } from 'react'
import { getDecaidSettingsUrl } from './api/decaid/config'
import { AppShell } from './app/AppShell'
import { useBrewingData } from './features/brew/useBrewingData'
import { ProfilesPanel } from './features/profiles/ProfilesPanel'
import { PreviousShotScreen } from './features/history/PreviousShotScreen'
import './styles/index.css'

type AppPage = 'home' | 'profiles' | 'previous-pull'

const currentPage = (): AppPage => {
  const page = new URLSearchParams(window.location.search).get('page')
  return page === 'profiles' || page === 'previous-pull' ? page : 'home'
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
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  let screen
  if (page === 'profiles' && !data.liveBrew.visible) screen = <ProfilesPanel profiles={data.allProfiles} favoriteProfileIds={data.favoriteProfileIds} onClose={() => navigate('home')} />
  else if (page === 'previous-pull' && !data.liveBrew.visible && data.model.previousShot) screen = <PreviousShotScreen shot={data.model.previousShot} onDismiss={() => navigate('home')} />
  else screen = <AppShell {...data} onSleep={data.toggleSleep} onWake={data.wakeMachine} onDismissLiveBrew={data.dismissLiveBrew} onSearchScale={data.searchForScale} onUpdateMachineSetting={data.updateMachineSetting} onUpdateProfileSetting={data.updateProfileSetting} onOpenSettings={() => window.location.assign(getDecaidSettingsUrl())} onManageProfiles={() => navigate('profiles')} onOpenPreviousShot={() => navigate('previous-pull')} />

  return screen
}
