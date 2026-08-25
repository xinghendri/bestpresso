import { useEffect, useState } from 'react'
import { getDecaidSettingsUrl } from './api/decaid/config'
import { AppShell } from './app/AppShell'
import { InteractionSound } from './components/InteractionSound/InteractionSound'
import { ValueAdjustmentProvider } from './components/ValueAdjustment/ValueAdjustmentProvider'
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
  const [, setPage] = useState(currentPage)
  const page = data.utilityOperation ? 'home' : currentPage()
  const utilityOperationKind = data.utilityOperation?.kind

  useEffect(() => {
    const handlePopState = () => setPage(currentPage())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (!utilityOperationKind || currentPage() === 'home') return
    const url = new URL(window.location.href)
    url.searchParams.delete('page')
    window.history.replaceState({ page: 'home' }, '', url)
  }, [utilityOperationKind])

  const navigate = (nextPage: AppPage) => {
    const url = new URL(window.location.href)
    if (nextPage === 'home') url.searchParams.delete('page')
    else url.searchParams.set('page', nextPage)
    window.history.pushState({ page: nextPage }, '', url)
    setPage(nextPage)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }

  let screen
  if (page === 'profiles' && !data.liveBrew.visible) screen = <ProfilesPanel profiles={data.allProfiles} favoriteProfileSlots={data.favoriteProfileSlots} activeProfileId={data.model.activeProfileId} feedback={data.settingFeedback} onSelectProfile={async (profileId) => { const selected = await data.selectProfile(profileId); if (selected) navigate('home'); return selected }} onSetFavoriteSlot={data.setFavoriteProfileSlot} onRemoveFavorite={data.removeFavoriteProfile} onClose={() => navigate('home')} />
  else if (page === 'previous-pull' && !data.liveBrew.visible) screen = <PreviousShotScreen shots={data.shotHistory} initialShot={data.model.previousShot} status={data.previousShotStatus} onSelectShot={data.loadHistoryShot} onDismiss={() => navigate('home')} />
  else screen = <AppShell {...data} onSleep={data.toggleSleep} onWake={data.wakeMachine} onStopEspresso={data.stopEspresso} onDismissLiveBrew={data.dismissLiveBrew} onSearchScale={data.searchForScale} onTareScale={data.tareConnectedScale} onUpdateMachineSetting={data.updateMachineSetting} onUpdateProfileSetting={data.updateProfileSetting} onSelectProfile={data.selectProfile} onOpenSettings={() => window.location.assign(getDecaidSettingsUrl())} onManageProfiles={() => navigate('profiles')} onOpenPreviousShot={() => navigate('previous-pull')} />

  return <ValueAdjustmentProvider><InteractionSound />{screen}</ValueAdjustmentProvider>
}
