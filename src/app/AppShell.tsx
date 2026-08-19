import logo from '../assets/figma/decent-logo.png'
import settings from '../assets/figma/settings.svg'
import sleep from '../assets/figma/sleep.svg'
import { StatusPill } from '../components/StatusPill/StatusPill'
import type { BrewingScreenModel, DataConnection, EditableMachineSetting, EditableProfileSetting, LiveBrewState, ScaleConnection, SettingFeedback } from '../domain/brewing'
import { BrewingPanel } from '../features/brew/BrewingPanel'
import { LiveBrewingScreen } from '../features/brew/LiveBrewingScreen'
import { HistoryPanel } from '../features/history/HistoryPanel'
import { MachineUtilityCard } from '../features/machine/MachineUtilityCard'

interface AppShellProps {
  model: BrewingScreenModel
  liveBrew: LiveBrewState
  connection: DataConnection
  gatewayHost: string
  heatingSeconds: number | null
  sleepPending: boolean
  sleepScreenActive: boolean
  machineActionError: string | null
  settingFeedback: SettingFeedback | null
  settingsDisabled: boolean
  scale: ScaleConnection
  onSleep: () => void
  onWake: () => void
  onDismissLiveBrew: () => void
  onSearchScale: () => void
  onUpdateMachineSetting: (setting: EditableMachineSetting, value: number) => void
  onUpdateProfileSetting: (profileId: string, setting: EditableProfileSetting, value: number) => void
  onOpenSettings: () => void
  onManageProfiles: () => void
}

export function AppShell({ model, liveBrew, connection, gatewayHost, heatingSeconds, sleepPending, sleepScreenActive, machineActionError, settingFeedback, settingsDisabled, scale, onSleep, onWake, onDismissLiveBrew, onSearchScale, onUpdateMachineSetting, onUpdateProfileSetting, onOpenSettings, onManageProfiles }: AppShellProps) {
  const sleepLabel = model.readiness === 'sleeping' ? 'Wake' : 'Sleep'
  if (sleepScreenActive) return <button className="sleep-screen" type="button" aria-label="Wake machine" onClick={onWake}><span>Tap to wake</span></button>
  if (liveBrew.visible) return <LiveBrewingScreen model={model} liveBrew={liveBrew} onDismiss={onDismissLiveBrew} />
  return <main className="app-shell">
    <header className="topbar"><img className="logo" src={logo} alt="decent" /><nav aria-label="Machine controls"><span className="gateway-label">{gatewayHost}</span><button className={sleepPending ? 'control-button control-button--pending' : 'control-button'} type="button" aria-label={sleepPending ? `${sleepLabel} request in progress` : sleepLabel} title={sleepLabel} disabled={sleepPending} onClick={onSleep}><img src={sleep} alt="" /></button><button className="control-button" type="button" aria-label="Settings" title="Settings" onClick={onOpenSettings}><img src={settings} alt="" /></button><StatusPill status={model.readiness} connection={connection} heatingSeconds={heatingSeconds} /></nav></header>
    {machineActionError && <div className="action-notice" role="alert">{machineActionError}</div>}
    {settingFeedback && <div className={`setting-feedback setting-feedback--${settingFeedback.status}`} role={settingFeedback.status === 'error' ? 'alert' : 'status'} aria-live="polite">{settingFeedback.message}</div>}
    <div className="dashboard"><aside className="utilities">{model.utilities.map((utility) => <MachineUtilityCard key={utility.id} utility={utility} scale={utility.id === 'scale' ? scale : undefined} onSearchScale={utility.id === 'scale' ? onSearchScale : undefined} settingsDisabled={settingsDisabled} onUpdateSetting={onUpdateMachineSetting} />)}</aside><div className="primary"><BrewingPanel key={model.activeProfileId ?? 'fixture'} profiles={model.profiles} activeProfileId={model.activeProfileId} settingsDisabled={settingsDisabled} onUpdateProfile={onUpdateProfileSetting} onManageProfiles={onManageProfiles} /><HistoryPanel shot={model.previousShot} /></div></div>
  </main>
}
