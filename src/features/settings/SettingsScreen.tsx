import { useMemo, useState } from 'react'
import logo from '../../assets/figma/decent-logo.png'
import type { BrewingScreenModel, DataConnection, MachineUtility, ScaleConnection } from '../../domain/brewing'
import { DEFAULT_BESTPRESSO_PREFERENCES, type ChartLineWeight, useBestpressoPreferences } from './bestpressoPreferences'

type SettingsSection = 'overview' | 'prepare' | 'clean' | 'alerts' | 'devices' | 'power' | 'experience' | 'data' | 'extensions' | 'advanced'

interface SettingsScreenProps {
  model: BrewingScreenModel
  connection: DataConnection
  machineConnection: DataConnection
  scale: ScaleConnection
  onClose: () => void
  onOpenDecaidSettings: () => void
}

const sections: { id: SettingsSection; label: string; group: string }[] = [
  { id: 'overview', label: 'Overview', group: 'Bestpresso' },
  { id: 'prepare', label: 'Prepare drinks', group: 'Make & maintain' },
  { id: 'clean', label: 'Clean & flush', group: 'Make & maintain' },
  { id: 'alerts', label: 'Alerts & water', group: 'Make & maintain' },
  { id: 'devices', label: 'Connected devices', group: 'Machine & devices' },
  { id: 'power', label: 'Power & display', group: 'Machine & devices' },
  { id: 'experience', label: 'App experience', group: 'Bestpresso' },
  { id: 'data', label: 'Data & privacy', group: 'System' },
  { id: 'extensions', label: 'Extensions', group: 'System' },
  { id: 'advanced', label: 'Advanced', group: 'System' },
]

const sectionCopy: Record<SettingsSection, { title: string; description: string }> = {
  overview: { title: 'Settings', description: 'Your machine, preparation and Bestpresso preferences in one place.' },
  prepare: { title: 'Prepare drinks', description: 'Set the defaults you reach for when making espresso, steam and hot water.' },
  clean: { title: 'Clean & flush', description: 'Keep routine cleaning actions and cleaning profiles together.' },
  alerts: { title: 'Alerts & water', description: 'Choose when Bestpresso should draw your attention to the reservoir.' },
  devices: { title: 'Connected devices', description: 'Manage the machine and scales used by Bestpresso.' },
  power: { title: 'Power & display', description: 'Control sleep, wake, display and charging behaviour.' },
  experience: { title: 'App experience', description: 'Tune sound, chart readability and the visual experience.' },
  data: { title: 'Data & privacy', description: 'Manage shot history, backups, diagnostics and telemetry.' },
  extensions: { title: 'Extensions', description: 'Manage installed Decaid plugins and their connections.' },
  advanced: { title: 'Advanced', description: 'Gateway, diagnostics, calibration and experimental controls.' },
}

const nativeSettings: Record<Exclude<SettingsSection, 'overview' | 'alerts' | 'experience'>, { title: string; description: string; rows: { label: string; value: string }[] }[]> = {
  prepare: [
    { title: 'Espresso', description: 'Recipe and stopping behaviour', rows: [{ label: 'Active profile', value: 'Set from Home' }, { label: 'Dose, yield & grind size', value: 'Per profile' }, { label: 'Automatic shot stop', value: 'Profile or personal target' }] },
    { title: 'Steam', description: 'Default steaming controls', rows: [{ label: 'Temperature', value: 'Machine setting' }, { label: 'Duration', value: 'Machine setting' }, { label: 'Flow', value: 'Machine setting' }] },
    { title: 'Hot water', description: 'Default dispenser controls', rows: [{ label: 'Temperature', value: '35–100°C' }, { label: 'Amount', value: 'Volume or scale weight' }, { label: 'Stop using scale', value: 'When available' }] },
  ],
  clean: [
    { title: 'Quick flush', description: 'Water through the group head', rows: [{ label: 'Temperature', value: 'Decaid machine setting' }, { label: 'Flow', value: 'Decaid machine setting' }, { label: 'Duration', value: 'Decaid machine setting' }] },
    { title: 'Cleaning profiles', description: 'Backflush and guided routines', rows: [{ label: 'Available routines', value: 'Managed with profiles' }, { label: 'Upload behaviour', value: 'Verified before start' }] },
  ],
  devices: [
    { title: 'Espresso machine', description: 'Preferred machine and connection', rows: [{ label: 'Machine', value: 'Preferred Decent machine' }, { label: 'Connection', value: 'Decaid gateway' }] },
    { title: 'Scale', description: 'Preferred scale and shot behaviour', rows: [{ label: 'Preferred scale', value: 'Choose in Decaid' }, { label: 'Power with machine', value: 'Follow configured policy' }, { label: 'Tare during shot', value: 'Configurable' }, { label: 'Require for brewing', value: 'Configurable' }] },
  ],
  power: [
    { title: 'Sleep & wake', description: 'When the machine should be available', rows: [{ label: 'Keep awake', value: 'Configurable' }, { label: 'Idle sleep timer', value: 'Configurable' }, { label: 'Presence wake', value: 'Configurable' }, { label: 'Wake schedules', value: 'Configurable' }] },
    { title: 'Display & battery', description: 'Tablet display and charging', rows: [{ label: 'Brightness', value: 'Configurable' }, { label: 'Low-battery limit', value: 'Configurable' }, { label: 'Charging mode', value: 'Configurable' }, { label: 'Overnight charging', value: 'Configurable' }] },
  ],
  data: [
    { title: 'Shot history', description: 'Your brewing records', rows: [{ label: 'Backup', value: 'Export from Decaid' }, { label: 'Restore', value: 'Import into Decaid' }, { label: 'Legacy DE1 data', value: 'Import supported' }] },
    { title: 'Privacy & diagnostics', description: 'What is shared and retained', rows: [{ label: 'Telemetry', value: 'Consent controlled' }, { label: 'Logs', value: 'Export or clear' }, { label: 'Diagnostics', value: 'Available in Decaid' }] },
  ],
  extensions: [
    { title: 'Plugins', description: 'Add services and extra capabilities', rows: [{ label: 'Installed plugins', value: 'Manage in Decaid' }, { label: 'Plugin updates', value: 'Manage in Decaid' }, { label: 'Plugin credentials', value: 'Manage per plugin' }] },
  ],
  advanced: [
    { title: 'Developer controls', description: 'For troubleshooting and specialist setup', rows: [{ label: 'Gateway', value: 'Connection and port' }, { label: 'Log level', value: 'Configurable' }, { label: 'Feature flags', value: 'Configurable' }, { label: 'Simulated devices', value: 'Configurable' }] },
    { title: 'Machine service', description: 'Calibration and recovery', rows: [{ label: 'Calibration', value: 'Machine specific' }, { label: 'Reset options', value: 'Available in Decaid' }] },
  ],
}

const valueFor = (utility: MachineUtility | undefined, label: string, fallback = '—') => {
  const metric = utility?.metrics.find((candidate) => candidate.label === label)
  return metric ? `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}` : fallback
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button className={`settings-toggle${checked ? ' is-on' : ''}`} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><span /></button>
}

function ThresholdControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <div className="settings-threshold"><span><strong>{label}</strong><small>Reservoir estimate</small></span><div><button type="button" aria-label={`Lower ${label}`} onClick={() => onChange(value - 10)}>−</button><output>{value}<small>ml</small></output><button type="button" aria-label={`Raise ${label}`} onClick={() => onChange(value + 10)}>+</button></div></div>
}

function NativeCards({ section, onOpenDecaidSettings }: { section: Exclude<SettingsSection, 'overview' | 'alerts' | 'experience'>; onOpenDecaidSettings: () => void }) {
  return <div className="settings-grid">{nativeSettings[section].map((card) => <section className="settings-card" key={card.title}><header><span><small>Decaid</small><h2>{card.title}</h2><p>{card.description}</p></span></header><div className="settings-list">{card.rows.map((row) => <div className="settings-row" key={row.label}><span>{row.label}</span><strong>{row.value}</strong></div>)}</div><button className="settings-native-link" type="button" onClick={onOpenDecaidSettings}>Open Decaid controls <span>↗</span></button></section>)}</div>
}

export function SettingsScreen({ model, connection, machineConnection, scale, onClose, onOpenDecaidSettings }: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('overview')
  const [search, setSearch] = useState('')
  const { preferences, updatePreferences, resetPreferences } = useBestpressoPreferences()
  const water = model.utilities.find((utility) => utility.id === 'water')
  const steam = model.utilities.find((utility) => utility.id === 'steam')
  const section = sectionCopy[activeSection]
  const visibleSections = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? sections.filter((candidate) => `${candidate.label} ${sectionCopy[candidate.id].description}`.toLowerCase().includes(term)) : sections
  }, [search])
  const updateCritical = (value: number) => updatePreferences({ waterCriticalLevelMl: Math.max(0, Math.min(preferences.waterWarningLevelMl - 10, value)) })
  const updateWarning = (value: number) => updatePreferences({ waterWarningLevelMl: Math.max(preferences.waterCriticalLevelMl + 10, Math.min(2_000, value)) })

  const overview = <div className="settings-overview">
    <section className="settings-card settings-card--hero"><small>Connected setup</small><h2>{machineConnection === 'connected' ? 'Your Decent is ready' : 'Machine connection needs attention'}</h2><p>Bestpresso combines everyday controls here and keeps specialist machine settings available through Decaid.</p><div><span className={machineConnection === 'connected' ? 'is-connected' : ''}>{machineConnection === 'connected' ? 'Machine connected' : 'Machine disconnected'}</span><span className={scale.status === 'connected' ? 'is-connected' : ''}>{scale.status === 'connected' ? scale.name || 'Scale connected' : 'No scale connected'}</span></div></section>
    <section className="settings-card"><header><span><small>At a glance</small><h2>Drink preparation</h2><p>Current everyday defaults</p></span></header><div className="settings-summary-metrics"><span><small>Hot water</small><strong>{valueFor(water, 'Temperature')}</strong></span><span><small>Amount</small><strong>{valueFor(water, 'Volume')}</strong></span><span><small>Steam</small><strong>{steam?.enabled === false ? 'Off' : valueFor(steam, 'Target')}</strong></span></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('prepare')}>Review preparation <span>→</span></button></section>
    <section className="settings-card"><header><span><small>Bestpresso</small><h2>Feedback & charts</h2><p>Preferences stored on this device</p></span></header><div className="settings-list"><div className="settings-row"><span>Completion sound</span><strong>{preferences.completionSoundEnabled ? 'On' : 'Off'}</strong></div><div className="settings-row"><span>Chart lines</span><strong>{preferences.chartLineWeight}</strong></div><div className="settings-row"><span>Water warning</span><strong>{preferences.waterWarningLevelMl} ml</strong></div></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('experience')}>Personalize Bestpresso <span>→</span></button></section>
    <section className="settings-card"><header><span><small>Decaid</small><h2>System settings</h2><p>Accounts, updates, data and service controls</p></span></header><div className="settings-list"><div className="settings-row"><span>Gateway</span><strong>{connection === 'connected' ? 'Connected' : connection}</strong></div><div className="settings-row"><span>Updates</span><strong>Decaid managed</strong></div><div className="settings-row"><span>Backup & restore</span><strong>Available</strong></div></div><button className="settings-native-link" type="button" onClick={onOpenDecaidSettings}>Open Decaid controls <span>↗</span></button></section>
  </div>

  const alerts = <div className="settings-grid"><section className="settings-card settings-card--wide"><header><span><small>Bestpresso</small><h2>Reservoir warnings</h2><p>Use two levels so low water becomes visible before brewing is interrupted.</p></span><button className="settings-reset" type="button" onClick={() => updatePreferences({ waterWarningLevelMl: DEFAULT_BESTPRESSO_PREFERENCES.waterWarningLevelMl, waterCriticalLevelMl: DEFAULT_BESTPRESSO_PREFERENCES.waterCriticalLevelMl })}>Reset</button></header><div className="settings-thresholds"><ThresholdControl label="Warn me" value={preferences.waterWarningLevelMl} onChange={updateWarning} /><ThresholdControl label="Needs water" value={preferences.waterCriticalLevelMl} onChange={updateCritical} /></div><p className="settings-helper">“Needs water” also appears whenever the machine reports its own water-required state, regardless of these estimates.</p></section><section className="settings-card"><header><span><small>Decaid</small><h2>Brewing safeguards</h2><p>Scale and machine warnings</p></span></header><div className="settings-list"><div className="settings-row"><span>Require a scale</span><strong>Decaid managed</strong></div><div className="settings-row"><span>Machine alerts</span><strong>Always shown</strong></div></div><button className="settings-native-link" type="button" onClick={onOpenDecaidSettings}>Open Decaid controls <span>↗</span></button></section></div>

  const experience = <div className="settings-grid"><section className="settings-card"><header><span><small>Sound & feedback</small><h2>Completion cue</h2><p>Play a short sound after a shot or cleaning routine completes.</p></span><Toggle checked={preferences.completionSoundEnabled} onChange={(completionSoundEnabled) => updatePreferences({ completionSoundEnabled })} label="Completion sound" /></header></section><section className="settings-card settings-card--wide"><header><span><small>Charts & monitoring</small><h2>Line weight</h2><p>Choose how strongly telemetry and targets appear throughout Bestpresso.</p></span></header><div className="settings-line-options">{(['fine', 'standard', 'bold'] as ChartLineWeight[]).map((weight) => <button className={preferences.chartLineWeight === weight ? 'is-selected' : ''} type="button" key={weight} onClick={() => updatePreferences({ chartLineWeight: weight })}><svg viewBox="0 0 120 34" aria-hidden="true"><path d="M2 27 C27 27 27 8 54 8 S82 25 118 13" /></svg><span>{weight}</span></button>)}</div></section><section className="settings-card"><header><span><small>Appearance</small><h2>Theme & skin</h2><p>Choose Decaid appearance, default skin and navigation guidance.</p></span></header><button className="settings-native-link" type="button" onClick={onOpenDecaidSettings}>Open Decaid controls <span>↗</span></button></section><button className="settings-reset settings-reset--all" type="button" onClick={resetPreferences}>Reset Bestpresso preferences</button></div>

  return <main className="settings-screen">
    <aside className="settings-sidebar"><div className="settings-brand"><img src={logo} alt="Decent" /><button type="button" onClick={onClose} aria-label="Close settings">×</button></div><div className="settings-account"><span className="settings-account__avatar">B</span><span><strong>Bestpresso</strong><small>{connection === 'connected' ? 'Decaid connected' : 'Local preferences'}</small></span></div><nav aria-label="Settings sections">{Array.from(new Set(visibleSections.map((candidate) => candidate.group))).map((group) => <div key={group}><small>{group}</small>{visibleSections.filter((candidate) => candidate.group === group).map((candidate) => <button className={candidate.id === activeSection ? 'is-active' : ''} type="button" key={candidate.id} onClick={() => setActiveSection(candidate.id)}><i aria-hidden="true" />{candidate.label}</button>)}</div>)}</nav><button className="settings-sidebar__decaid" type="button" onClick={onOpenDecaidSettings}>Decaid system settings <span>↗</span></button></aside>
    <section className="settings-content"><header className="settings-content__header"><span><h1>{section.title}</h1><p>{section.description}</p></span><label><span aria-hidden="true">⌕</span><input type="search" value={search} placeholder="Find a setting" aria-label="Find a setting" onChange={(event) => setSearch(event.target.value)} /></label></header><div className="settings-content__body">{activeSection === 'overview' ? overview : activeSection === 'alerts' ? alerts : activeSection === 'experience' ? experience : <NativeCards section={activeSection} onOpenDecaidSettings={onOpenDecaidSettings} />}</div></section>
  </main>
}
