import { useState } from 'react'
import logo from '../assets/figma/decent-logo.png'
import settings from '../assets/figma/settings.svg'
import sleep from '../assets/figma/sleep.svg'
import utilityCollapse from '../assets/figma/utility-collapse.svg'
import utilityExpand from '../assets/figma/utility-expand.svg'
import { StatusPill } from '../components/StatusPill/StatusPill'
import type { BrewingScreenModel, DataConnection, EditableMachineSetting, EditableProfileSetting, LiveBrewState, PreviousShotStatus, ScaleConnection, SettingFeedback } from '../domain/brewing'
import { BrewingPanel } from '../features/brew/BrewingPanel'
import { LiveBrewingScreen } from '../features/brew/LiveBrewingScreen'
import { HistoryPanel } from '../features/history/HistoryPanel'
import { MachineUtilityCard } from '../features/machine/MachineUtilityCard'

interface AppShellProps {
  model: BrewingScreenModel
  liveBrew: LiveBrewState
  previousShotStatus: PreviousShotStatus
  connection: DataConnection
  machineConnection: DataConnection
  heatingSeconds: number | null
  sleepPending: boolean
  sleepScreenActive: boolean
  machineActionError: string | null
  settingFeedback: SettingFeedback | null
  settingsDisabled: boolean
  scale: ScaleConnection
  scaleTarePending: boolean
  brewStopPending: boolean
  onSleep: () => void
  onWake: () => void
  onStopEspresso: () => void
  onDismissLiveBrew: () => void
  onSearchScale: () => void
  onTareScale: () => void
  onUpdateMachineSetting: (setting: EditableMachineSetting, value: number) => void
  onUpdateProfileSetting: (profileId: string, setting: EditableProfileSetting, value: number) => void
  onSelectProfile: (profileId: string) => Promise<boolean>
  onOpenSettings: () => void
  onManageProfiles: () => void
  onOpenPreviousShot: () => void
}

const utilityLayoutStorageKey = 'bestpresso.utility-layout-collapsed.v1'

const initialUtilityLayout = () => {
  try {
    return window.localStorage.getItem(utilityLayoutStorageKey) === 'true'
  } catch {
    return false
  }
}

export function AppShell({ model, liveBrew, previousShotStatus, connection, machineConnection, heatingSeconds, sleepPending, sleepScreenActive, machineActionError, settingFeedback, settingsDisabled, scale, scaleTarePending, brewStopPending, onSleep, onWake, onStopEspresso, onDismissLiveBrew, onSearchScale, onTareScale, onUpdateMachineSetting, onUpdateProfileSetting, onSelectProfile, onOpenSettings, onManageProfiles, onOpenPreviousShot }: AppShellProps) {
  const [utilitiesCollapsed, setUtilitiesCollapsed] = useState(initialUtilityLayout)
  const [utilityLayoutHasChanged, setUtilityLayoutHasChanged] = useState(false)
  const sleepLabel = model.readiness === 'sleeping' ? 'Wake' : 'Sleep'
  const toggleUtilityLayout = () => {
    setUtilityLayoutHasChanged(true)
    setUtilitiesCollapsed((collapsed) => {
      const nextCollapsed = !collapsed
      try {
        window.localStorage.setItem(utilityLayoutStorageKey, String(nextCollapsed))
      } catch {
        // Preference persistence is optional; the current session still updates.
      }
      return nextCollapsed
    })
  }

  if (sleepScreenActive) return <button className="sleep-screen" type="button" aria-label="Wake machine" onClick={onWake}><span>Tap to wake</span></button>
  if (liveBrew.visible) return <LiveBrewingScreen model={model} liveBrew={liveBrew} stopPending={brewStopPending} actionError={machineActionError} onStop={onStopEspresso} onDismiss={onDismissLiveBrew} />
  return <main className={`app-shell${utilitiesCollapsed ? ' app-shell--utilities-collapsed' : ''}${utilityLayoutHasChanged ? ' app-shell--utility-layout-transitioned' : ''}`}>
    <header className="topbar"><div className="topbar__brand"><button className="utility-layout-toggle" type="button" aria-label={utilitiesCollapsed ? 'Expand utility panels' : 'Minimize utility panels'} aria-controls="machine-utilities" aria-expanded={!utilitiesCollapsed} title={utilitiesCollapsed ? 'Expand utility panels' : 'Minimize utility panels'} onClick={toggleUtilityLayout}><img src={utilitiesCollapsed ? utilityExpand : utilityCollapse} alt="" /></button><img className="logo" src={logo} alt="decent" /></div><nav aria-label="Machine controls"><button className={sleepPending ? 'control-button control-button--pending' : 'control-button'} type="button" aria-label={sleepPending ? `${sleepLabel} request in progress` : sleepLabel} title={sleepLabel} disabled={sleepPending} onClick={onSleep}><img src={sleep} alt="" /></button><button className="control-button" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}><img src={settings} alt="" /></button><StatusPill status={model.readiness} connection={connection} machineConnection={machineConnection} heatingSeconds={heatingSeconds} /></nav></header>
    {(machineActionError || settingFeedback) && <div className="system-messages">
      {machineActionError && <div className="system-message system-message--error" role="alert">{machineActionError}</div>}
      {settingFeedback && <div className={`system-message system-message--${settingFeedback.status}`} role={settingFeedback.status === 'error' ? 'alert' : 'status'} aria-live="polite">{settingFeedback.message}</div>}
    </div>}
    <div className="dashboard"><aside className="utilities" id="machine-utilities">{model.utilities.map((utility) => <MachineUtilityCard key={utility.id} utility={utility} compact={utilitiesCollapsed} scale={utility.id === 'scale' ? scale : undefined} scaleTarePending={utility.id === 'scale' && scaleTarePending} onExpand={utility.id === 'tank' ? undefined : toggleUtilityLayout} onSearchScale={utility.id === 'scale' ? onSearchScale : undefined} onTareScale={utility.id === 'scale' ? onTareScale : undefined} settingsDisabled={settingsDisabled} onUpdateSetting={onUpdateMachineSetting} />)}</aside><div className="primary"><BrewingPanel profiles={model.profiles} activeProfileId={model.activeProfileId} settingsDisabled={settingsDisabled} onUpdateProfile={onUpdateProfileSetting} onSelectProfile={onSelectProfile} onManageProfiles={onManageProfiles} /><HistoryPanel shot={model.previousShot} status={previousShotStatus} onOpen={onOpenPreviousShot} /></div></div>
  </main>
}
