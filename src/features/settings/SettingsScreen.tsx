import { useMemo, useRef, useState, type ReactNode } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import { getDecaidEndpoints } from '../../api/decaid/config'
import { importDecaidBackup, setMachineState } from '../../api/decaid/client'
import type { BrewingScreenModel, DataConnection, MachineUtility, ScaleConnection } from '../../domain/brewing'
import { formatTemperatureValue, temperatureBoundToDisplay, temperatureFromDisplay, temperatureStepToDisplay, temperatureUnitLabel, type TemperatureUnit } from '../../domain/temperature'
import { DEFAULT_BESTPRESSO_PREFERENCES, type BestpressoPreferences, type ChartLineWeight, useBestpressoPreferences } from './bestpressoPreferences'
import { SETTINGS_PROTOCOL } from './settingsProtocol'
import { useUnifiedSettings } from './useUnifiedSettings'
import { homeSettingValue } from './homeSettingValue'
import { useValueAdjustment } from '../../components/ValueAdjustment/ValueAdjustmentContext'
import type { SettingsValueAdjustmentKey, ValueAdjustmentMode } from '../../domain/valueAdjustments'

type SettingsSection = 'overview' | 'prepare' | 'clean' | 'alerts' | 'devices' | 'power' | 'experience' | 'data' | 'extensions' | 'advanced'

interface SettingsScreenProps {
  model: BrewingScreenModel
  connection: DataConnection
  machineConnection: DataConnection
  scale: ScaleConnection
  onClose: () => void
}

const sections: { id: SettingsSection; label: string; group: string; keywords: string }[] = [
  { id: 'overview', label: 'Overview', group: 'Bestpresso', keywords: 'status version account' },
  { id: 'prepare', label: 'Prepare drinks', group: 'Make & maintain', keywords: 'espresso steam hot water temperature flow volume weight multiplier' },
  { id: 'clean', label: 'Clean & flush', group: 'Make & maintain', keywords: 'rinse flush tank temperature duration flow' },
  { id: 'alerts', label: 'Alerts & water', group: 'Make & maintain', keywords: 'reservoir warning scale required tare' },
  { id: 'devices', label: 'Connected devices', group: 'Machine & devices', keywords: 'machine scale bluetooth wifi scan connect preferred power' },
  { id: 'power', label: 'Power & display', group: 'Machine & devices', keywords: 'brightness sleep wake schedule charging battery presence' },
  { id: 'experience', label: 'App experience', group: 'Bestpresso', keywords: 'sound chart thickness theme appearance' },
  { id: 'data', label: 'Data & privacy', group: 'System', keywords: 'backup restore import export logs history' },
  { id: 'extensions', label: 'Extensions', group: 'System', keywords: 'plugin visualizer upload integration' },
  { id: 'advanced', label: 'Advanced', group: 'System', keywords: 'gateway log heater refill usb fan firmware calibration simulation' },
]

const sectionCopy: Record<SettingsSection, { title: string; description: string }> = {
  overview: { title: 'Settings', description: 'Your machine, preparation and Bestpresso preferences in one place.' },
  prepare: { title: 'Prepare drinks', description: 'Set espresso stopping behaviour and everyday steam and hot-water defaults.' },
  clean: { title: 'Clean & flush', description: 'Control the water sent through the group head and the tank heating policy.' },
  alerts: { title: 'Alerts & water', description: 'Choose when Bestpresso should draw attention and which brewing safeguards apply.' },
  devices: { title: 'Connected devices', description: 'Find, connect and choose the machine and scale Bestpresso should prefer.' },
  power: { title: 'Power & display', description: 'Control brightness, sleep, wake and tablet charging behaviour.' },
  experience: { title: 'App experience', description: 'Tune sound, chart readability and the visual experience.' },
  data: { title: 'Data & privacy', description: 'Back up or restore Decaid data without leaving Bestpresso.' },
  extensions: { title: 'Extensions', description: 'See and control the plugins installed in Decaid.' },
  advanced: { title: 'Advanced', description: 'Specialist Decaid and machine controls. Change these only when you understand their effect.' },
}

const valueFor = (utility: MachineUtility | undefined, label: string, fallback = '—') => {
  const metric = utility?.metrics.find((candidate) => candidate.label === label)
  return metric ? `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}` : fallback
}
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : undefined
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const timeText = (minutes: number | undefined) => {
  const value = Number.isFinite(minutes) ? Number(minutes) : 0
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
const timeMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number)
  return clamp((hour || 0) * 60 + (minute || 0), 0, 1439)
}

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return <button className={`settings-toggle${checked ? ' is-on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}><span /></button>
}

function SettingsCard({ eyebrow, title, description, children, wide = false, action }: { eyebrow: string; title: string; description?: string; children: ReactNode; wide?: boolean; action?: ReactNode }) {
  return <section className={`settings-card${wide ? ' settings-card--wide' : ''}`}><header><span><small>{eyebrow}</small><h2>{title}</h2>{description && <p>{description}</p>}</span>{action}</header>{children}</section>
}

function NumberSetting({ label, hint, value, unit = '', min, max, step = 1, digits = 0, disabled = false, adjustmentKey, presets, coerce, adjust, onChange }: { label: string; hint?: string; value?: number; unit?: string; min: number; max?: number; step?: number; digits?: number; disabled?: boolean; adjustmentKey?: string; presets?: readonly number[]; coerce?: (value: number) => number; adjust?: (value: number, direction: -1 | 1) => number; onChange: (value: number) => void }) {
  const openAdjustment = useValueAdjustment()
  const normalize = (candidate: number) => {
    const bounded = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, candidate))
    return Number((coerce ? coerce(bounded) : bounded).toFixed(digits))
  }
  const move = (direction: -1 | 1) => {
    const current = value ?? min
    const next = normalize(adjust ? adjust(current, direction) : current + (step * direction))
    onChange(next)
  }
  const open = () => {
    if (disabled || value === undefined) return
    const mode: ValueAdjustmentMode = digits > 0 ? 'decimal' : 'integer'
    const key = `settings:${adjustmentKey ?? `${label}-${unit}-${min}-${max}-${step}`}` as SettingsValueAdjustmentKey
    const adjustmentMax = max ?? Math.max(600, Math.ceil(value / 60) * 60)
    openAdjustment({
      label,
      value,
      unit,
      min,
      max: adjustmentMax,
      step,
      mode,
      suggestionKey: key,
      presets,
      onSave: (next) => onChange(normalize(next)),
    })
  }
  const displayValue = value === undefined ? '—' : value.toFixed(digits)
  return <div className="settings-number-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><div className="settings-number-control"><button type="button" disabled={disabled || value === undefined} aria-label={`Decrease ${label}`} onClick={() => move(-1)}>−</button><button className="settings-number-value" type="button" disabled={disabled || value === undefined} aria-label={`Adjust ${label}, current value ${displayValue}${unit}`} onClick={open}><span>{displayValue}</span>{unit && <small className={unit === '°' ? 'settings-number-unit--degree' : undefined}>{unit}</small>}</button><button type="button" disabled={disabled || value === undefined} aria-label={`Increase ${label}`} onClick={() => move(1)}>+</button></div></div>
}

function TemperatureSetting({ label, hint, value, min, max, step = 1, disabled = false, unit, enabledMinimum, onChange }: { label: string; hint?: string; value?: number; min: number; max: number; step?: number; disabled?: boolean; unit: TemperatureUnit; enabledMinimum?: number; onChange: (celsius: number) => void }) {
  const off = enabledMinimum !== undefined && value === 0
  const displayValue = value === undefined ? undefined : off ? 0 : temperatureBoundToDisplay(value, unit)
  const displayMin = enabledMinimum === undefined ? temperatureBoundToDisplay(min, unit) : 0
  const displayMax = temperatureBoundToDisplay(max, unit)
  const enabledDisplayMinimum = enabledMinimum === undefined ? undefined : temperatureBoundToDisplay(enabledMinimum, unit)
  const displayStep = temperatureStepToDisplay(step, unit)
  return <NumberSetting
    label={label}
    hint={hint}
    value={displayValue}
    unit={temperatureUnitLabel(unit)}
    min={displayMin}
    max={displayMax}
    step={displayStep}
    disabled={disabled}
    coerce={enabledDisplayMinimum === undefined ? undefined : (candidate) => candidate <= 0 ? 0 : Math.max(enabledDisplayMinimum, candidate)}
    adjust={enabledDisplayMinimum === undefined ? undefined : (current, direction) => current === 0 && direction > 0 ? enabledDisplayMinimum : current === enabledDisplayMinimum && direction < 0 ? 0 : current + displayStep * direction}
    onChange={(display) => onChange(display === 0 && enabledDisplayMinimum !== undefined ? 0 : temperatureFromDisplay(display, unit))}
  />
}

function SelectSetting({ label, hint, value, options, disabled = false, onChange }: { label: string; hint?: string; value?: string | number; options: { value: string | number; label: string }[]; disabled?: boolean; onChange: (value: string) => void }) {
  return <div className="settings-control-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><select value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{value === undefined && <option value="">Unavailable</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
}

function TextSetting({ label, hint, value, placeholder, disabled = false, onChange }: { label: string; hint?: string; value?: string | null; placeholder?: string; disabled?: boolean; onChange: (value: string) => void }) {
  return <div className="settings-control-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><input className="settings-text-input" type="text" value={value ?? ''} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></div>
}

function SwitchSetting({ label, hint, checked, disabled = false, onChange }: { label: string; hint?: string; checked?: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <div className="settings-control-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><Toggle label={label} checked={checked === true} disabled={disabled || checked === undefined} onChange={onChange} /></div>
}
function SectionList({ children }: { children: ReactNode }) { return <div className="settings-form-list">{children}</div> }

export function SettingsScreen({ model, connection, machineConnection, scale, onClose }: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('overview')
  const [search, setSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [routinePending, setRoutinePending] = useState<'descaling' | 'airPurge'>()
  const [routineMessage, setRoutineMessage] = useState('')
  const importInput = useRef<HTMLInputElement>(null)
  const { preferences: savedPreferences, updatePreferences: persistPreferences } = useBestpressoPreferences()
  const [preferencePatch, setPreferencePatch] = useState<Partial<BestpressoPreferences>>({})
  const preferences = { ...savedPreferences, ...preferencePatch }
  const preferencesDirty = JSON.stringify(preferences) !== JSON.stringify(savedPreferences)
  const updatePreferences = (patch: Partial<BestpressoPreferences>) => setPreferencePatch((current) => ({ ...current, ...patch }))
  const resetPreferences = () => setPreferencePatch(DEFAULT_BESTPRESSO_PREFERENCES)
  const settings = useUnifiedSettings(true)
  const water = model.utilities.find((utility) => utility.id === 'water')
  const steam = model.utilities.find((utility) => utility.id === 'steam')
  const section = sectionCopy[activeSection]
  const visibleSections = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? sections.filter((candidate) => `${candidate.label} ${candidate.keywords} ${sectionCopy[candidate.id].description}`.toLowerCase().includes(term)) : sections
  }, [search])
  const machineUnavailable = settings.unavailable.includes('machine')
  const workflowUnavailable = settings.loading || settings.unavailable.includes('workflow')
  const reaUnavailable = settings.unavailable.includes('Decaid')
  const steamTemperatureMax = SETTINGS_PROTOCOL.steam.temperatureMax
  const temperatureUnit = preferences.temperatureUnit
  const temperatureUnitText = temperatureUnitLabel(temperatureUnit)
  const temperatureMetricFor = (utility: MachineUtility | undefined, label: string) => {
    const value = utility?.metrics.find((candidate) => candidate.label === label)?.value
    return `${formatTemperatureValue(value, temperatureUnit)}${temperatureUnitText}`
  }
  const updateWarning = (value: number) => updatePreferences({ waterWarningLevelMl: Math.max(preferences.waterCriticalLevelMl + 10, Math.min(2_000, value)) })
  const startRoutine = async (state: 'descaling' | 'airPurge', confirmation: string) => {
    if (!window.confirm(confirmation)) return
    setRoutinePending(state)
    setRoutineMessage('')
    try {
      await setMachineState(state)
      onClose()
    } catch (error) {
      setRoutineMessage(error instanceof Error ? error.message : 'The machine could not start this routine.')
    } finally {
      setRoutinePending(undefined)
    }
  }

  const overview = <div className="settings-overview">
    <section className="settings-card settings-card--hero"><small>Connected setup</small><h2>{machineConnection === 'connected' ? 'Your Decent is ready' : 'Machine connection needs attention'}</h2><p>Everyday Bestpresso and Decaid controls now share this settings surface.</p><div><span className={machineConnection === 'connected' ? 'is-connected' : ''}>{machineConnection === 'connected' ? 'Machine connected' : 'Machine disconnected'}</span><span className={scale.status === 'connected' ? 'is-connected' : ''}>{scale.status === 'connected' ? scale.name || 'Scale connected' : 'No scale connected'}</span><span>{settings.draft.info.fullVersion || settings.draft.info.version || 'Decaid version unavailable'}</span></div></section>
    <SettingsCard eyebrow="At a glance" title="Drink preparation" description="Current defaults"><div className="settings-summary-metrics"><span><small>Hot water</small><strong>{temperatureMetricFor(water, 'Temperature')}</strong></span><span><small>Amount</small><strong>{valueFor(water, 'Volume')}</strong></span><span><small>Steam</small><strong>{steam?.enabled === false ? 'Off' : temperatureMetricFor(steam, 'Target')}</strong></span></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('prepare')}>Review preparation <span>→</span></button></SettingsCard>
    <SettingsCard eyebrow="Bestpresso" title="Feedback & charts" description="Preferences stored for this skin"><div className="settings-list"><div className="settings-row"><span>Completion sound</span><strong>{preferences.completionSoundEnabled ? 'On' : 'Off'}</strong></div><div className="settings-row"><span>Chart lines</span><strong>{preferences.chartLineWeight}</strong></div><div className="settings-row"><span>Water warning</span><strong>{preferences.waterWarningLevelMl} ml</strong></div></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('experience')}>Personalize Bestpresso <span>→</span></button></SettingsCard>
    <SettingsCard eyebrow="Decaid" title="System" description="Live bridge information"><div className="settings-list"><div className="settings-row"><span>Gateway</span><strong>{settings.draft.rea.gatewayMode || (connection === 'connected' ? 'Connected' : connection)}</strong></div><div className="settings-row"><span>Build</span><strong>{settings.draft.info.commitShort || '—'}</strong></div><div className="settings-row"><span>Unavailable groups</span><strong>{settings.unavailable.length ? settings.unavailable.join(', ') : 'None'}</strong></div></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('advanced')}>Review system controls <span>→</span></button></SettingsCard>
  </div>

  const prepare = <div className="settings-grid">
    <SettingsCard eyebrow="Shared drink settings" title="Stopping calibration" description="Compensate for the short delay between deciding to stop and flow actually stopping."><SectionList><NumberSetting label="Yield" hint="Espresso and hot water; higher stops earlier" value={numberValue(settings.draft.rea.weightFlowMultiplier)} min={0} step={0.1} digits={1} disabled={reaUnavailable} onChange={(weightFlowMultiplier) => settings.patchRea({ weightFlowMultiplier })} /><NumberSetting label="Volume" hint="Machine-flow projection" value={numberValue(settings.draft.rea.volumeFlowMultiplier)} unit="s" min={0} step={0.05} digits={2} disabled={reaUnavailable} onChange={(volumeFlowMultiplier) => settings.patchRea({ volumeFlowMultiplier })} /></SectionList></SettingsCard>
    <SettingsCard eyebrow="Steam" title="Steam defaults" description="Uploaded together through the current Decaid workflow."><SectionList><TemperatureSetting label="Temperature" hint={`Off, or ${temperatureBoundToDisplay(SETTINGS_PROTOCOL.steam.enabledTemperatureMin, temperatureUnit)}–${temperatureBoundToDisplay(steamTemperatureMax, temperatureUnit)}${temperatureUnitText}`} value={numberValue(settings.draft.workflow.steamSettings?.targetTemperature) ?? (steam?.enabled === false ? 0 : homeSettingValue(steam, 'Target'))} min={0} max={steamTemperatureMax} enabledMinimum={SETTINGS_PROTOCOL.steam.enabledTemperatureMin} unit={temperatureUnit} disabled={workflowUnavailable} onChange={(targetTemperature) => settings.patchWorkflow('steamSettings', { targetTemperature })} /><NumberSetting label="Duration" value={numberValue(settings.draft.workflow.steamSettings?.duration) ?? homeSettingValue(steam, 'Duration')} unit="s" {...SETTINGS_PROTOCOL.steam.duration} disabled={workflowUnavailable} onChange={(duration) => settings.patchWorkflow('steamSettings', { duration })} /><NumberSetting label="Flow" value={numberValue(settings.draft.workflow.steamSettings?.flow) ?? homeSettingValue(steam, 'Flow')} unit="ml/s" {...SETTINGS_PROTOCOL.steam.flow} digits={1} disabled={workflowUnavailable} onChange={(flow) => settings.patchWorkflow('steamSettings', { flow })} /></SectionList></SettingsCard>
    <SettingsCard eyebrow="Hot water" title="Dispenser defaults" description="Automatically stops by weight when a scale is connected; otherwise uses volume and time." wide><div className="settings-columns"><SectionList><TemperatureSetting label="Temperature" value={numberValue(settings.draft.workflow.hotWaterData?.targetTemperature) ?? homeSettingValue(water, 'Temperature')} unit={temperatureUnit} {...SETTINGS_PROTOCOL.hotWater.temperature} disabled={workflowUnavailable} onChange={(targetTemperature) => settings.patchWorkflow('hotWaterData', { targetTemperature })} /><NumberSetting label="Amount" value={numberValue(settings.draft.workflow.hotWaterData?.volume) ?? homeSettingValue(water, 'Volume') ?? homeSettingValue(water, 'Weight')} unit={scale.status === 'connected' ? 'g' : 'ml'} {...SETTINGS_PROTOCOL.hotWater.volume} disabled={workflowUnavailable} onChange={(volume) => settings.patchWorkflow('hotWaterData', { volume })} /><NumberSetting label="Duration backstop" value={numberValue(settings.draft.workflow.hotWaterData?.duration)} unit="s" {...SETTINGS_PROTOCOL.hotWater.duration} disabled={workflowUnavailable} onChange={(duration) => settings.patchWorkflow('hotWaterData', { duration })} /></SectionList><SectionList><NumberSetting label="Flow" value={numberValue(settings.draft.workflow.hotWaterData?.flow)} unit="ml/s" {...SETTINGS_PROTOCOL.hotWater.flow} digits={1} disabled={workflowUnavailable} onChange={(flow) => settings.patchWorkflow('hotWaterData', { flow })} /></SectionList></div></SettingsCard>
  </div>

  const clean = <div className="settings-grid">
    <SettingsCard eyebrow="Group head" title="Quick flush" description="Stored in the active Decaid workflow and applied to the machine through that single path." wide><div className="settings-columns"><SectionList><TemperatureSetting label="Temperature" value={numberValue(settings.draft.workflow.rinseData?.targetTemperature)} unit={temperatureUnit} {...SETTINGS_PROTOCOL.rinse.temperature} disabled={workflowUnavailable} onChange={(targetTemperature) => settings.patchWorkflow('rinseData', { targetTemperature })} /><NumberSetting label="Flow" value={numberValue(settings.draft.workflow.rinseData?.flow)} unit="ml/s" {...SETTINGS_PROTOCOL.rinse.flow} digits={1} disabled={workflowUnavailable} onChange={(flow) => settings.patchWorkflow('rinseData', { flow })} /></SectionList><SectionList><NumberSetting label="Duration" value={numberValue(settings.draft.workflow.rinseData?.duration)} unit="s" {...SETTINGS_PROTOCOL.rinse.duration} disabled={workflowUnavailable} onChange={(duration) => settings.patchWorkflow('rinseData', { duration })} /><TemperatureSetting label="Tank temperature" value={numberValue(settings.draft.machine.tankTemp)} unit={temperatureUnit} {...SETTINGS_PROTOCOL.tankTemperature} disabled={machineUnavailable} onChange={(tankTemp) => settings.patchMachine({ tankTemp })} /></SectionList></div></SettingsCard>
    <SettingsCard eyebrow="Maintenance" title="Guided machine routines" description="Cleaning profiles stay in Profiles. Start machine-owned service routines here."><div className="settings-list"><div className="settings-row"><span>Cleaning</span><strong>Use a cleaning profile</strong></div></div><div className="settings-routine-actions"><button type="button" disabled={machineConnection !== 'connected' || routinePending !== undefined} onClick={() => void startRoutine('descaling', 'Start the machine-guided descaling routine? Prepare the machine and descaling solution before continuing.')}><span><strong>Descaling</strong><small>Machine-guided routine</small></span><em>{routinePending === 'descaling' ? 'Starting…' : 'Start'}</em></button><button type="button" disabled={machineConnection !== 'connected' || routinePending !== undefined} onClick={() => void startRoutine('airPurge', 'Enter transport mode? This runs the air-purge routine to prepare the machine for transport.')}><span><strong>Transport mode</strong><small>Air-purge preparation</small></span><em>{routinePending === 'airPurge' ? 'Starting…' : 'Enable'}</em></button></div>{routineMessage && <p className="settings-helper settings-routine-error" role="alert">{routineMessage}</p>}</SettingsCard>
  </div>

  const alerts = <div className="settings-grid settings-grid--alerts">
    <SettingsCard eyebrow="Bestpresso" title="Reservoir warning" description="Choose when to show an early low-water warning." action={<button className="settings-reset" type="button" onClick={() => updatePreferences({ waterWarningLevelMl: DEFAULT_BESTPRESSO_PREFERENCES.waterWarningLevelMl })}>Reset</button>}><SectionList><NumberSetting label="Warn me" hint="Reservoir estimate" value={preferences.waterWarningLevelMl} unit="ml" min={preferences.waterCriticalLevelMl + 10} max={2000} step={10} onChange={updateWarning} /></SectionList><p className="settings-helper">The machine’s own needs-water state always takes priority.</p></SettingsCard>
    <SettingsCard eyebrow="Brewing safeguard" title="Scale policy"><SectionList><SwitchSetting label="Require a scale" hint="Prevent a shot from starting without one" checked={settings.draft.rea.blockOnNoScale} disabled={reaUnavailable} onChange={(blockOnNoScale) => settings.patchRea({ blockOnNoScale })} /><SwitchSetting label="Block app tare during a shot" hint="The scale’s physical tare button is unaffected" checked={settings.draft.rea.blockTareDuringShot} disabled={reaUnavailable} onChange={(blockTareDuringShot) => settings.patchRea({ blockTareDuringShot })} /></SectionList></SettingsCard>
  </div>

  const devices = <div className="settings-grid">{(['machine', 'scale'] as const).map((type) => <SettingsCard key={type} eyebrow="Connection" title={type === 'machine' ? 'Espresso machine' : 'Scale'} description={`Scan, connect and choose the preferred ${type}.`} action={<button className="settings-reset" type="button" disabled={settings.acting === 'scan'} onClick={() => void settings.scan()}>{settings.acting === 'scan' ? 'Scanning…' : 'Scan'}</button>}><div className="settings-device-list">{settings.draft.devices.filter((device) => device.type === type).map((device) => { const id = device.id || ''; const preferred = type === 'machine' ? settings.draft.rea.preferredMachineId === id : settings.draft.rea.preferredScaleId === id; return <div className="settings-device" key={id || device.name}><span><strong>{device.name || type}</strong><small>{device.state || 'disconnected'}{device.available === false ? ' · unavailable' : ''}</small></span><div>{!preferred && <button type="button" onClick={() => settings.patchRea(type === 'machine' ? { preferredMachineId: id } : { preferredScaleId: id })}>Prefer</button>}{device.state === 'connected' ? <button type="button" onClick={() => void settings.disconnect(id)}>Disconnect</button> : <button type="button" disabled={device.available === false} onClick={() => void settings.connect(id)}>Connect</button>}<button type="button" className="is-danger" onClick={() => window.confirm(`Forget ${device.name || 'this device'}?`) && void settings.forget(id)}>Forget</button></div></div>})}{!settings.draft.devices.some((device) => device.type === type) && <p className="settings-empty">No {type} found. Run a scan to look for nearby devices.</p>}</div>{type === 'scale' && <SectionList><SelectSetting label="When the machine sleeps" value={settings.draft.rea.scalePowerMode} disabled={reaUnavailable} options={[{ value: 'disabled', label: 'Do nothing' }, { value: 'displayOff', label: 'Turn display off' }, { value: 'disconnect', label: 'Disconnect scale' }]} onChange={(scalePowerMode) => settings.patchRea({ scalePowerMode: scalePowerMode as 'disabled' | 'displayOff' | 'disconnect' })} /></SectionList>}</SettingsCard>)}</div>

  const power = <div className="settings-grid">
    <SettingsCard eyebrow="Display" title="Brightness & battery"><SectionList><NumberSetting label="Brightness" hint={settings.draft.display.lowBatteryBrightnessActive ? 'Currently capped by low battery' : '100 returns control to the operating system'} value={numberValue(settings.draft.display.requestedBrightness ?? settings.draft.display.brightness)} unit="%" {...SETTINGS_PROTOCOL.brightness} disabled={settings.unavailable.includes('display') || settings.draft.display.platformSupported?.brightness === false} onChange={(requestedBrightness) => settings.patchDisplay({ requestedBrightness })} /><SwitchSetting label="Limit brightness on low battery" checked={settings.draft.rea.lowBatteryBrightnessLimit} disabled={reaUnavailable} onChange={(lowBatteryBrightnessLimit) => settings.patchRea({ lowBatteryBrightnessLimit })} /><SwitchSetting label="Keep screen awake" checked={settings.draft.rea.keepAwake} disabled={reaUnavailable} onChange={(keepAwake) => settings.patchRea({ keepAwake })} /></SectionList></SettingsCard>
    <SettingsCard eyebrow="Sleep & wake" title="Presence"><SectionList><SwitchSetting label="Presence detection" checked={settings.draft.presence.userPresenceEnabled} disabled={settings.unavailable.includes('presence')} onChange={(userPresenceEnabled) => settings.patchPresence({ userPresenceEnabled })} /><NumberSetting label="Sleep after" hint="0 disables automatic idle sleep" value={numberValue(settings.draft.presence.sleepTimeoutMinutes)} unit="min" {...SETTINGS_PROTOCOL.presenceTimeout} disabled={settings.unavailable.includes('presence')} onChange={(sleepTimeoutMinutes) => settings.patchPresence({ sleepTimeoutMinutes })} /></SectionList></SettingsCard>
    <SettingsCard eyebrow="Schedule" title="Wake times" description="Each schedule is an independent Decaid record and saves immediately." wide action={<button className="settings-reset" type="button" disabled={settings.unavailable.includes('presence')} onClick={() => void settings.createSchedule({ time: '07:00', daysOfWeek: [1, 2, 3, 4, 5], enabled: true, keepAwakeFor: 60 })}>Add schedule</button>}><div className="settings-schedule-list">{(settings.draft.presence.schedules || []).map((schedule) => <div className="settings-schedule" key={schedule.id}><input aria-label="Wake time" type="time" value={schedule.time || timeText(schedule.hour === undefined ? undefined : schedule.hour * 60 + (schedule.minute || 0))} onChange={(event) => schedule.id && void settings.updateSchedule(schedule.id, { time: event.target.value })} /><span>{schedule.daysOfWeek?.length ? schedule.daysOfWeek.length === 7 ? 'Every day' : `${schedule.daysOfWeek.length} days` : 'Every day'}</span><Toggle label="Schedule enabled" checked={schedule.enabled !== false} onChange={(enabled) => schedule.id && void settings.updateSchedule(schedule.id, { enabled })} /><button type="button" className="settings-reset" onClick={() => schedule.id && window.confirm('Delete this wake schedule?') && void settings.deleteSchedule(schedule.id)}>Remove</button></div>)}{!(settings.draft.presence.schedules || []).length && <p className="settings-empty">No wake schedules configured.</p>}</div></SettingsCard>
    <SettingsCard eyebrow="Battery" title="Charging"><SectionList><SelectSetting label="Charging mode" value={settings.draft.rea.chargingMode} disabled={reaUnavailable} options={[{ value: 'disabled', label: 'Disabled' }, { value: 'longevity', label: 'Battery longevity' }, { value: 'balanced', label: 'Balanced' }, { value: 'highAvailability', label: 'High availability' }]} onChange={(chargingMode) => settings.patchRea({ chargingMode: chargingMode as 'disabled' | 'longevity' | 'balanced' | 'highAvailability' })} /><SwitchSetting label="Overnight charging schedule" checked={settings.draft.rea.nightModeEnabled} disabled={reaUnavailable} onChange={(nightModeEnabled) => settings.patchRea({ nightModeEnabled })} /><div className="settings-time-pair"><label><span>Sleep time</span><input type="time" disabled={reaUnavailable} value={timeText(settings.draft.rea.nightModeSleepTime)} onChange={(event) => settings.patchRea({ nightModeSleepTime: timeMinutes(event.target.value) })} /></label><label><span>Morning time</span><input type="time" disabled={reaUnavailable} value={timeText(settings.draft.rea.nightModeMorningTime)} onChange={(event) => settings.patchRea({ nightModeMorningTime: timeMinutes(event.target.value) })} /></label></div></SectionList></SettingsCard>
  </div>

  const experience = <div className="settings-grid"><SettingsCard eyebrow="Sound & feedback" title="Play sound on shot complete" wide action={<Toggle checked={preferences.completionSoundEnabled} onChange={(completionSoundEnabled) => updatePreferences({ completionSoundEnabled })} label="Play sound on shot complete" />}><></></SettingsCard><SettingsCard eyebrow="Appearance" title="Display"><SectionList><SelectSetting label="System theme" value={settings.draft.rea.themeMode} disabled={reaUnavailable} options={[{ value: 'system', label: 'Follow device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(themeMode) => settings.patchRea({ themeMode: themeMode as 'system' | 'light' | 'dark' })} /><SelectSetting label="Clock format" hint="Screensaver and history times in Bestpresso" value={preferences.clockFormat} options={[{ value: 'device', label: 'Follow device' }, { value: '12h', label: '12-hour (AM/PM)' }, { value: '24h', label: '24-hour' }]} onChange={(value) => updatePreferences({ clockFormat: value === '24h' ? '24h' : value === '12h' ? '12h' : 'device' })} /><SelectSetting label="Temperature" hint="Bestpresso display only; Decaid stays in Celsius" value={temperatureUnit} options={[{ value: 'C', label: 'Celsius (°C)' }, { value: 'F', label: 'Fahrenheit (°F)' }]} onChange={(value) => updatePreferences({ temperatureUnit: value === 'F' ? 'F' : 'C' })} /></SectionList></SettingsCard><SettingsCard eyebrow="Charts & monitoring" title="Line weight" description="Apply one telemetry line weight throughout Bestpresso."><div className="settings-line-options">{(['fine', 'standard', 'bold'] as ChartLineWeight[]).map((weight) => <button className={preferences.chartLineWeight === weight ? 'is-selected' : ''} type="button" key={weight} onClick={() => updatePreferences({ chartLineWeight: weight })}><svg viewBox="0 0 120 34" aria-hidden="true"><path d="M2 27 C27 27 27 8 54 8 S82 25 118 13" /></svg><span>{{ fine: 'Thin · 1px', standard: 'Medium · 2px', bold: 'Thick · 3px' }[weight]}</span></button>)}</div></SettingsCard><button className="settings-reset settings-reset--all" type="button" onClick={resetPreferences}>Reset Bestpresso preferences</button></div>

  const onImport = async (file?: File) => { if (!file) return; setImporting(true); try { await importDecaidBackup(file); await settings.reload() } finally { setImporting(false); if (importInput.current) importInput.current.value = '' } }
  const data = <div className="settings-grid"><SettingsCard eyebrow="Backup" title="Export Decaid data" description="Downloads profiles, shots, workflow, settings, beans, grinders and the shared store in one ZIP."><a className="settings-action-button" href={`${getDecaidEndpoints().apiBase}/data/export`} download>Download backup</a></SettingsCard><SettingsCard eyebrow="Restore" title="Import a backup" description="Existing records are preserved when duplicate IDs are found."><input ref={importInput} className="settings-file-input" type="file" accept=".zip,application/zip" onChange={(event) => void onImport(event.target.files?.[0])} /><button className="settings-action-button" type="button" disabled={importing} onClick={() => importInput.current?.click()}>{importing ? 'Importing…' : 'Choose backup ZIP'}</button></SettingsCard><SettingsCard eyebrow="Diagnostics" title="Recent Decaid logs" description="Open the latest log window as plain text."><a className="settings-action-button" href={`${getDecaidEndpoints().apiBase}/logs?kb=1024&order=desc`} target="_blank" rel="noreferrer">View recent logs</a></SettingsCard></div>

  const extensions = <div className="settings-grid">{settings.draft.plugins.map((plugin) => <SettingsCard key={plugin.id || plugin.name} eyebrow="Decaid plugin" title={plugin.name || plugin.id || 'Plugin'} description={plugin.description || plugin.version || 'Installed extension'} action={<Toggle checked={plugin.loaded === true} label={`${plugin.name || plugin.id} enabled`} disabled={!plugin.id || settings.acting === `plugin:${plugin.id}`} onChange={(enabled) => plugin.id && void settings.togglePlugin(plugin.id, enabled)} />}><div className="settings-list"><div className="settings-row"><span>Version</span><strong>{plugin.version || '—'}</strong></div><div className="settings-row"><span>Auto load</span><strong>{plugin.autoLoad === false ? 'Off' : 'On'}</strong></div><div className="settings-row"><span>Update</span><strong>{plugin.pendingUpdate ? 'Available' : 'Current'}</strong></div></div></SettingsCard>)}{!settings.draft.plugins.length && <SettingsCard eyebrow="Decaid" title="No plugins reported" description="Plugin management will appear when Decaid returns installed manifests."><p className="settings-helper">This is live Decaid state, not placeholder content.</p></SettingsCard>}</div>

  const simulatedDevices = settings.draft.rea.simulatedDevices || []
  const toggleSimulatedDevice = (device: 'machine' | 'scale' | 'sensor' | 'bengle', enabled: boolean) => settings.patchRea({
    simulatedDevices: enabled ? Array.from(new Set([...simulatedDevices, device])) : simulatedDevices.filter((candidate) => candidate !== device),
  })
  const advanced = <div className="settings-grid">
    <SettingsCard eyebrow="Decaid" title="Gateway & diagnostics">
      <SectionList>
        <SelectSetting label="Gateway mode" value={settings.draft.rea.gatewayMode} disabled={reaUnavailable} options={[{ value: 'disabled', label: 'Disabled' }, { value: 'tracking', label: 'Tracking' }, { value: 'full', label: 'Full control' }]} onChange={(gatewayMode) => settings.patchRea({ gatewayMode: gatewayMode as 'disabled' | 'tracking' | 'full' })} />
        <SelectSetting label="Log level" value={settings.draft.rea.logLevel} disabled={reaUnavailable} options={['ALL', 'FINEST', 'FINER', 'FINE', 'CONFIG', 'INFO', 'WARNING', 'SEVERE', 'SHOUT', 'OFF'].map((value) => ({ value, label: value }))} onChange={(logLevel) => settings.patchRea({ logLevel })} />
        <SwitchSetting label="Automatic update checks" checked={settings.draft.rea.automaticUpdateCheck} disabled={reaUnavailable} onChange={(automaticUpdateCheck) => settings.patchRea({ automaticUpdateCheck })} />
        <TextSetting label="Custom WebUI folder" hint="Leave blank to use installed skins" value={settings.draft.rea.webUiPath} placeholder="No custom folder" disabled={reaUnavailable} onChange={(webUiPath) => settings.patchRea({ webUiPath: webUiPath || null })} />
      </SectionList>
    </SettingsCard>
    <SettingsCard eyebrow="Machine" title="General">
      <SectionList>
        <SwitchSetting label="USB charging" checked={settings.draft.machine.usb} disabled={machineUnavailable} onChange={(usb) => settings.patchMachine({ usb })} />
        <NumberSetting label="Fan threshold" value={numberValue(settings.draft.machine.fan)} unit="%" {...SETTINGS_PROTOCOL.fan} disabled={machineUnavailable} onChange={(fan) => settings.patchMachine({ fan })} />
        <SelectSetting label="Steam purge mode" value={settings.draft.machine.steamPurgeMode} disabled={machineUnavailable} options={[{ value: 0, label: 'Normal' }, { value: 1, label: 'Two-tap stop' }]} onChange={(steamPurgeMode) => settings.patchMachine({ steamPurgeMode: Number(steamPurgeMode) })} />
      </SectionList>
    </SettingsCard>
    <SettingsCard eyebrow="Machine" title="Heating" wide>
      <div className="settings-columns"><SectionList>
        <NumberSetting label="Heating flow · phase 1" value={numberValue(settings.draft.advanced.heaterPh1Flow)} unit="ml/s" {...SETTINGS_PROTOCOL.heater.flow} digits={1} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterPh1Flow) => settings.patchAdvanced({ heaterPh1Flow })} />
        <NumberSetting label="Heating flow · phase 2" value={numberValue(settings.draft.advanced.heaterPh2Flow)} unit="ml/s" {...SETTINGS_PROTOCOL.heater.flow} digits={1} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterPh2Flow) => settings.patchAdvanced({ heaterPh2Flow })} />
      </SectionList><SectionList>
        <TemperatureSetting label="Idle heater temperature" value={numberValue(settings.draft.advanced.heaterIdleTemp)} unit={temperatureUnit} {...SETTINGS_PROTOCOL.heater.idleTemperature} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterIdleTemp) => settings.patchAdvanced({ heaterIdleTemp })} />
        <NumberSetting label="Stabilization timeout" value={numberValue(settings.draft.advanced.heaterPh2Timeout)} unit="s" {...SETTINGS_PROTOCOL.heater.phase2Timeout} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterPh2Timeout) => settings.patchAdvanced({ heaterPh2Timeout })} />
      </SectionList></div>
    </SettingsCard>
    <SettingsCard eyebrow="Machine" title="Installation" description="Settings written to Decent firmware." wide>
      <div className="settings-columns"><SectionList>
        <SelectSetting label="Refill kit" value={settings.draft.advanced.refillKitSetting} disabled={settings.unavailable.includes('advanced machine')} options={[{ value: 2, label: 'Automatic' }, { value: 1, label: 'Force on' }, { value: 0, label: 'Force off' }]} onChange={(refillKitSetting) => settings.patchAdvanced({ refillKitSetting: Number(refillKitSetting) as 0 | 1 | 2 })} />
        <SelectSetting label="Heater voltage" hint="Choose the mains region for the heater" value={settings.draft.advanced.heaterVoltage} disabled={settings.unavailable.includes('advanced machine')} options={[...(settings.draft.advanced.heaterVoltage === -1 ? [{ value: -1, label: 'Not set' }] : []), { value: 120, label: '110–120 V region' }, { value: 230, label: '220–230 V region' }]} onChange={(heaterVoltage) => { const value = Number(heaterVoltage); if (value === 120 || value === 230) settings.patchAdvanced({ heaterVoltage: value }) }} />
      </SectionList><div className="settings-list settings-capability-list"><div className="settings-row"><span>Reported capabilities</span><strong>{Array.isArray(settings.draft.capabilities.capabilities) && settings.draft.capabilities.capabilities.length ? settings.draft.capabilities.capabilities.join(', ') : 'Standard DE1'}</strong></div><p className="settings-helper">Bengle-only controls are shown only when the connected machine reports support for them.</p></div></div>
    </SettingsCard>
    <SettingsCard eyebrow="Developer" title="Simulated hardware" description="Expose Decaid’s test devices during discovery." wide>
      <div className="settings-columns"><SectionList>
        <SwitchSetting label="Mock machine" checked={simulatedDevices.includes('machine')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('machine', enabled)} />
        <SwitchSetting label="Mock scale" checked={simulatedDevices.includes('scale')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('scale', enabled)} />
      </SectionList><SectionList>
        <SwitchSetting label="Mock sensor" checked={simulatedDevices.includes('sensor')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('sensor', enabled)} />
        <SwitchSetting label="Mock Bengle" checked={simulatedDevices.includes('bengle')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('bengle', enabled)} />
      </SectionList></div>
    </SettingsCard>
  </div>

  const content: Record<SettingsSection, ReactNode> = { overview, prepare, clean, alerts, devices, power, experience, data, extensions, advanced }
  return <main className="settings-screen"><aside className="settings-sidebar"><div className="settings-brand"><img src={logo} alt="Decent" /><button type="button" onClick={onClose} aria-label="Close settings">×</button></div><div className="settings-account"><span className="settings-account__avatar">B</span><span><strong>Bestpresso</strong><small>{connection === 'connected' ? 'Decaid connected' : 'Local preferences'}</small></span></div><nav aria-label="Settings sections">{Array.from(new Set(visibleSections.map((candidate) => candidate.group))).map((group) => <div key={group}><small>{group}</small>{visibleSections.filter((candidate) => candidate.group === group).map((candidate) => <button className={candidate.id === activeSection ? 'is-active' : ''} type="button" key={candidate.id} onClick={() => setActiveSection(candidate.id)}><i aria-hidden="true" />{candidate.label}</button>)}</div>)}</nav></aside><section className="settings-content"><header className="settings-content__header"><span><h1>{section.title}</h1></span><div className="settings-header-actions"><label><span aria-hidden="true">⌕</span><input type="search" value={search} placeholder="Find a setting" aria-label="Find a setting" onChange={(event) => setSearch(event.target.value)} /></label>{(settings.dirty || preferencesDirty) && <button type="button" className="settings-cancel" onClick={() => { settings.reset(); setPreferencePatch({}) }}>Cancel</button>}<button type="button" className="settings-save" disabled={(!settings.dirty && !preferencesDirty) || settings.saving || settings.loading} onClick={() => { if (preferencesDirty) { persistPreferences(preferences); setPreferencePatch({}) } if (settings.dirty) void settings.save() }}>{settings.saving ? 'Saving…' : 'Save'}</button></div></header>{(settings.message || settings.loading || settings.unavailable.length > 0) && <div className={`settings-status${settings.message?.includes('could not') || settings.message?.includes('returned') ? ' is-error' : ''}`} role="status">{settings.loading ? 'Loading settings from Decaid…' : settings.message || `Some controls are unavailable: ${settings.unavailable.join(', ')}.`}</div>}<div className="settings-content__body">{content[activeSection]}</div></section></main>
}
