import { useMemo, useRef, useState, type ReactNode } from 'react'
import { SidebarBrand, SidebarNavItem } from '../../components/Sidebar/SidebarNavigation'
import { getDecaidEndpoints } from '../../api/decaid/config'
import { importDecaidBackup, setMachineState } from '../../api/decaid/client'
import type { BrewingScreenModel, DataConnection, MachineUtility, ScaleConnection, UtilityMetricId } from '../../domain/brewing'
import { formatTemperatureValue, temperatureBoundToDisplay, temperatureFromDisplay, temperatureStepToDisplay, temperatureUnitLabel, type TemperatureUnit } from '../../domain/temperature'
import { DEFAULT_BESTPRESSO_PREFERENCES, type BestpressoPreferences, type ChartLineWeight, useBestpressoPreferences } from './bestpressoPreferences'
import { SETTINGS_PROTOCOL } from './settingsProtocol'
import { useUnifiedSettings } from './useUnifiedSettings'
import { homeSettingValue } from './homeSettingValue'
import { useValueAdjustment } from '../../components/ValueAdjustment/ValueAdjustmentContext'
import type { SettingsValueAdjustmentKey, ValueAdjustmentMode } from '../../domain/valueAdjustments'
import { formatDecimal, isLanguage, languageName, LANGUAGES, localizeDecimalText, plural, resolveLanguage, t, type MessageKey } from '../../i18n/index.ts'

type SettingsSection = 'overview' | 'prepare' | 'clean' | 'alerts' | 'devices' | 'power' | 'experience' | 'data' | 'extensions' | 'advanced'

interface SettingsScreenProps {
  model: BrewingScreenModel
  connection: DataConnection
  machineConnection: DataConnection
  scale: ScaleConnection
  onClose: () => void
}

type SettingsSectionGroup = 'bestpresso' | 'makeMaintain' | 'machineDevices' | 'system'

const sectionGroupLabel = (group: SettingsSectionGroup) => t(`settings.group.${group}`)

// `t()`'s generic signature infers whether a call needs a `params` object from the *literal* key type;
// with a `MessageKey`-typed variable (not a literal) it can't narrow, so it demands params unconditionally.
// This file only ever looks up plain, param-less keys this way (section copy, the unavailable-id labels),
// so a small same-behaviour wrapper avoids threading `as any` through every call site.
const translateKey = (key: MessageKey): string => (t as (key: MessageKey, params?: Record<string, string | number>) => string)(key)

const sectionDefs: { id: SettingsSection; group: SettingsSectionGroup; labelKey: MessageKey; keywordsKey: MessageKey }[] = [
  { id: 'overview', group: 'bestpresso', labelKey: 'settings.section.overview.label', keywordsKey: 'settings.section.overview.keywords' },
  { id: 'prepare', group: 'makeMaintain', labelKey: 'settings.section.prepare.label', keywordsKey: 'settings.section.prepare.keywords' },
  { id: 'clean', group: 'makeMaintain', labelKey: 'settings.section.clean.label', keywordsKey: 'settings.section.clean.keywords' },
  { id: 'alerts', group: 'makeMaintain', labelKey: 'settings.section.alerts.label', keywordsKey: 'settings.section.alerts.keywords' },
  { id: 'devices', group: 'machineDevices', labelKey: 'settings.section.devices.label', keywordsKey: 'settings.section.devices.keywords' },
  { id: 'power', group: 'machineDevices', labelKey: 'settings.section.power.label', keywordsKey: 'settings.section.power.keywords' },
  { id: 'experience', group: 'bestpresso', labelKey: 'settings.section.experience.label', keywordsKey: 'settings.section.experience.keywords' },
  { id: 'data', group: 'system', labelKey: 'settings.section.data.label', keywordsKey: 'settings.section.data.keywords' },
  { id: 'extensions', group: 'system', labelKey: 'settings.section.extensions.label', keywordsKey: 'settings.section.extensions.keywords' },
  { id: 'advanced', group: 'system', labelKey: 'settings.section.advanced.label', keywordsKey: 'settings.section.advanced.keywords' },
]

/** Recomputed on every render so a language change (App re-renders on `useLanguage()`) updates labels, groups and search terms. */
const getSections = () => sectionDefs.map((def) => ({ id: def.id, label: translateKey(def.labelKey), group: sectionGroupLabel(def.group), keywords: translateKey(def.keywordsKey) }))

const sectionCopyDefs: Record<SettingsSection, { titleKey: MessageKey; descriptionKey: MessageKey }> = {
  overview: { titleKey: 'settings.section.overview.title', descriptionKey: 'settings.section.overview.description' },
  prepare: { titleKey: 'settings.section.prepare.title', descriptionKey: 'settings.section.prepare.description' },
  clean: { titleKey: 'settings.section.clean.title', descriptionKey: 'settings.section.clean.description' },
  alerts: { titleKey: 'settings.section.alerts.title', descriptionKey: 'settings.section.alerts.description' },
  devices: { titleKey: 'settings.section.devices.title', descriptionKey: 'settings.section.devices.description' },
  power: { titleKey: 'settings.section.power.title', descriptionKey: 'settings.section.power.description' },
  experience: { titleKey: 'settings.section.experience.title', descriptionKey: 'settings.section.experience.description' },
  data: { titleKey: 'settings.section.data.title', descriptionKey: 'settings.section.data.description' },
  extensions: { titleKey: 'settings.section.extensions.title', descriptionKey: 'settings.section.extensions.description' },
  advanced: { titleKey: 'settings.section.advanced.title', descriptionKey: 'settings.section.advanced.description' },
}

const getSectionCopy = (): Record<SettingsSection, { title: string; description: string }> => {
  const entries = (Object.keys(sectionCopyDefs) as SettingsSection[]).map((id) => [id, { title: translateKey(sectionCopyDefs[id].titleKey), description: translateKey(sectionCopyDefs[id].descriptionKey) }] as const)
  return Object.fromEntries(entries) as Record<SettingsSection, { title: string; description: string }>
}

const valueFor = (utility: MachineUtility | undefined, metricId: UtilityMetricId, fallback = '—') => {
  const metric = utility?.metrics.find((candidate) => candidate.id === metricId)
  return metric ? `${localizeDecimalText(metric.value)}${metric.unit ? ` ${metric.unit}` : ''}` : fallback
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

// Decaid's `unavailable` array doubles as an internal id list (compared with `.includes(...)`,
// e.g. `settings.unavailable.includes('Decaid')`) and as display text (joined for the status banner).
// Anzeigetext-als-Logik: the ids stay the exact English strings `useUnifiedSettings` compares against;
// only this lookup translates them for display.
const UNAVAILABLE_KEYS: Record<string, MessageKey> = {
  Decaid: 'settings.unavailable.decaid',
  machine: 'settings.unavailable.machine',
  'advanced machine': 'settings.unavailable.advancedMachine',
  workflow: 'settings.unavailable.workflow',
  display: 'settings.unavailable.display',
  presence: 'settings.unavailable.presence',
  devices: 'settings.unavailable.devices',
  plugins: 'settings.unavailable.plugins',
  system: 'settings.unavailable.system',
  capabilities: 'settings.unavailable.capabilities',
}
const unavailableLabel = (id: string): string => UNAVAILABLE_KEYS[id] ? translateKey(UNAVAILABLE_KEYS[id]) : id
const deviceTypeWord = (type: 'machine' | 'scale') => type === 'machine' ? t('settings.devices.typeMachine') : t('settings.devices.typeScale')
const deviceStateLabel = (state: 'connected' | 'disconnected' | undefined) => state === 'connected' ? t('settings.devices.stateConnected') : t('settings.devices.stateDisconnected')
const chartLineWeightLabel = (weight: ChartLineWeight) => ({ fine: t('settings.chartLineWeight.thin'), standard: t('settings.chartLineWeight.medium'), bold: t('settings.chartLineWeight.thick') }[weight])
// `connection` (Decaid bridge status) falls back to its raw English value when gatewayMode is unset;
// keep the raw value as the EN catalog text (byte-identical to today) and translate only for display.
const rawConnectionLabel = (value: DataConnection): string => value === 'connecting' ? t('settings.connection.connecting') : value === 'fixture' ? t('settings.connection.fixture') : t('settings.connection.disconnected')

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
  const displayValue = value === undefined ? '—' : formatDecimal(value, digits)
  return <div className="settings-number-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><div className="settings-number-control"><button type="button" disabled={disabled || value === undefined} aria-label={t('settings.number.decrease', { label })} onClick={() => move(-1)}>−</button><button className="settings-number-value" type="button" disabled={disabled || value === undefined} aria-label={t('settings.number.adjust', { label, value: `${displayValue}${unit}` })} onClick={open}><span>{displayValue}</span>{unit && <small className={unit === '°' ? 'settings-number-unit--degree' : undefined}>{unit}</small>}</button><button type="button" disabled={disabled || value === undefined} aria-label={t('settings.number.increase', { label })} onClick={() => move(1)}>+</button></div></div>
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
  return <div className="settings-control-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><select value={value ?? ''} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{value === undefined && <option value="">{t('settings.select.unavailable')}</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
}

function TextSetting({ label, hint, value, placeholder, disabled = false, onChange }: { label: string; hint?: string; value?: string | null; placeholder?: string; disabled?: boolean; onChange: (value: string) => void }) {
  return <div className="settings-control-row"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><input className="settings-text-input" type="text" value={value ?? ''} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></div>
}

function SwitchSetting({ label, hint, checked, disabled = false, onChange }: { label: string; hint?: string; checked?: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <div className="settings-control-row settings-control-row--switch"><span><strong>{label}</strong>{hint && <small>{hint}</small>}</span><Toggle label={label} checked={checked === true} disabled={disabled || checked === undefined} onChange={onChange} /></div>
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
  const sections = getSections()
  const sectionCopy = getSectionCopy()
  const section = sectionCopy[activeSection]
  const visibleSections = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? sections.filter((candidate) => `${candidate.label} ${candidate.keywords} ${sectionCopy[candidate.id].description}`.toLowerCase().includes(term)) : sections
  }, [search, sections, sectionCopy])
  const machineUnavailable = settings.unavailable.includes('machine')
  const workflowUnavailable = settings.loading || settings.unavailable.includes('workflow')
  const reaUnavailable = settings.unavailable.includes('Decaid')
  const steamTemperatureMax = SETTINGS_PROTOCOL.steam.temperatureMax
  const temperatureUnit = preferences.temperatureUnit
  const temperatureUnitText = temperatureUnitLabel(temperatureUnit)
  const temperatureMetricFor = (utility: MachineUtility | undefined, metricId: UtilityMetricId) => {
    const value = utility?.metrics.find((candidate) => candidate.id === metricId)?.value
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
      setRoutineMessage(error instanceof Error ? error.message : t('settings.message.routineFailed'))
    } finally {
      setRoutinePending(undefined)
    }
  }

  const overview = <div className="settings-overview">
    <section className="settings-card settings-card--hero"><small>{t('settings.overview.hero.eyebrow')}</small><h2>{machineConnection === 'connected' ? t('settings.overview.hero.titleReady') : t('settings.overview.hero.titleAttention')}</h2><p>{t('settings.overview.hero.description')}</p><div><span className={machineConnection === 'connected' ? 'is-connected' : ''}>{machineConnection === 'connected' ? t('settings.overview.hero.machineConnected') : t('settings.overview.hero.machineDisconnected')}</span><span className={scale.status === 'connected' ? 'is-connected' : ''}>{scale.status === 'connected' ? scale.name || t('settings.overview.hero.scaleConnected') : t('settings.overview.hero.scaleNone')}</span><span>{settings.draft.info.fullVersion || settings.draft.info.version || t('settings.overview.hero.versionUnavailable')}</span></div></section>
    <SettingsCard eyebrow={t('settings.overview.glance.eyebrow')} title={t('settings.overview.glance.title')} description={t('settings.overview.glance.description')}><div className="settings-summary-metrics"><span><small>{t('common.utility.water')}</small><strong>{temperatureMetricFor(water, 'temperature')}</strong></span><span><small>{t('settings.metric.amount')}</small><strong>{valueFor(water, 'volume')}</strong></span><span><small>{t('common.utility.steam')}</small><strong>{steam?.enabled === false ? t('settings.state.off') : temperatureMetricFor(steam, 'target')}</strong></span></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('prepare')}>{t('settings.action.reviewPreparation')} <span>→</span></button></SettingsCard>
    <SettingsCard eyebrow={t('settings.group.bestpresso')} title={t('settings.overview.feedback.title')} description={t('settings.overview.feedback.description')}><div className="settings-list"><div className="settings-row"><span>{t('settings.overview.feedback.completionSound')}</span><strong>{preferences.completionSoundEnabled ? t('settings.state.on') : t('settings.state.off')}</strong></div><div className="settings-row"><span>{t('settings.overview.feedback.chartLines')}</span><strong>{chartLineWeightLabel(preferences.chartLineWeight)}</strong></div><div className="settings-row"><span>{t('settings.overview.feedback.waterWarning')}</span><strong>{preferences.waterWarningLevelMl} ml</strong></div></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('experience')}>{t('settings.action.personalize')} <span>→</span></button></SettingsCard>
    <SettingsCard eyebrow={t('settings.eyebrow.decaid')} title={t('settings.group.system')} description={t('settings.overview.system.description')}><div className="settings-list"><div className="settings-row"><span>{t('settings.overview.system.gateway')}</span><strong>{(settings.draft.rea.gatewayMode ? ({ disabled: t('settings.state.disabled'), tracking: t('settings.advanced.gatewayMode.tracking'), full: t('settings.advanced.gatewayMode.full') }[settings.draft.rea.gatewayMode] ?? settings.draft.rea.gatewayMode) : '') || (connection === 'connected' ? t('settings.overview.system.connected') : rawConnectionLabel(connection))}</strong></div><div className="settings-row"><span>{t('settings.overview.system.build')}</span><strong>{settings.draft.info.commitShort || '—'}</strong></div><div className="settings-row"><span>{t('settings.overview.system.unavailableGroups')}</span><strong>{settings.unavailable.length ? settings.unavailable.map(unavailableLabel).join(', ') : t('settings.overview.system.none')}</strong></div></div><button className="settings-card-link" type="button" onClick={() => setActiveSection('advanced')}>{t('settings.action.reviewSystem')} <span>→</span></button></SettingsCard>
  </div>

  const prepare = <div className="settings-grid">
    <SettingsCard eyebrow={t('settings.prepare.calibration.eyebrow')} title={t('settings.prepare.calibration.title')} description={t('settings.prepare.calibration.description')}>
      <SectionList>
        <NumberSetting label={t('settings.prepare.espressoYield')} value={numberValue(settings.draft.rea.weightFlowMultiplier)} min={0} step={0.1} digits={1} disabled={reaUnavailable} onChange={(weightFlowMultiplier) => settings.patchRea({ weightFlowMultiplier })} />
        <NumberSetting label={t('settings.prepare.hotWaterYield')} hint={t('settings.prepare.hotWaterYieldHint')} value={numberValue(settings.draft.rea.hotWaterFlowMultiplier)} unit="s" min={0} step={0.05} digits={2} disabled={reaUnavailable} onChange={(hotWaterFlowMultiplier) => settings.patchRea({ hotWaterFlowMultiplier })} />
        <NumberSetting label={t('common.metric.volume')} hint={t('settings.prepare.volumeHint')} value={numberValue(settings.draft.rea.volumeFlowMultiplier)} unit="s" min={0} step={0.05} digits={2} disabled={reaUnavailable} onChange={(volumeFlowMultiplier) => settings.patchRea({ volumeFlowMultiplier })} />
      </SectionList>
    </SettingsCard>
    <SettingsCard eyebrow={t('common.utility.steam')} title={t('settings.prepare.steam.title')} description={t('settings.prepare.steam.description')}><SectionList><TemperatureSetting label={t('common.metric.temperature')} hint={t('settings.prepare.steam.temperatureHint', { min: temperatureBoundToDisplay(SETTINGS_PROTOCOL.steam.enabledTemperatureMin, temperatureUnit), max: temperatureBoundToDisplay(steamTemperatureMax, temperatureUnit), unit: temperatureUnitText })} value={numberValue(settings.draft.workflow.steamSettings?.targetTemperature) ?? (steam?.enabled === false ? 0 : homeSettingValue(steam, 'target'))} min={0} max={steamTemperatureMax} enabledMinimum={SETTINGS_PROTOCOL.steam.enabledTemperatureMin} unit={temperatureUnit} disabled={workflowUnavailable} onChange={(targetTemperature) => settings.patchWorkflow('steamSettings', { targetTemperature })} /><NumberSetting label={t('common.metric.duration')} value={numberValue(settings.draft.workflow.steamSettings?.duration) ?? homeSettingValue(steam, 'duration')} unit="s" {...SETTINGS_PROTOCOL.steam.duration} disabled={workflowUnavailable} onChange={(duration) => settings.patchWorkflow('steamSettings', { duration })} /><NumberSetting label={t('common.metric.flow')} value={numberValue(settings.draft.workflow.steamSettings?.flow) ?? homeSettingValue(steam, 'flow')} unit="ml/s" {...SETTINGS_PROTOCOL.steam.flow} digits={1} disabled={workflowUnavailable} onChange={(flow) => settings.patchWorkflow('steamSettings', { flow })} /></SectionList></SettingsCard>
    <SettingsCard eyebrow={t('common.utility.water')} title={t('settings.prepare.hotWater.title')} description={t('settings.prepare.hotWater.description')} wide><div className="settings-columns"><SectionList><TemperatureSetting label={t('common.metric.temperature')} value={numberValue(settings.draft.workflow.hotWaterData?.targetTemperature) ?? homeSettingValue(water, 'temperature')} unit={temperatureUnit} {...SETTINGS_PROTOCOL.hotWater.temperature} disabled={workflowUnavailable} onChange={(targetTemperature) => settings.patchWorkflow('hotWaterData', { targetTemperature })} /><NumberSetting label={t('settings.metric.amount')} value={numberValue(settings.draft.workflow.hotWaterData?.volume) ?? homeSettingValue(water, 'volume') ?? homeSettingValue(water, 'weight')} unit={scale.status === 'connected' ? 'g' : 'ml'} {...SETTINGS_PROTOCOL.hotWater.volume} disabled={workflowUnavailable} onChange={(volume) => settings.patchWorkflow('hotWaterData', { volume })} /></SectionList><SectionList><NumberSetting label={t('common.metric.flow')} value={numberValue(settings.draft.workflow.hotWaterData?.flow)} unit="ml/s" {...SETTINGS_PROTOCOL.hotWater.flow} digits={1} disabled={workflowUnavailable} onChange={(flow) => settings.patchWorkflow('hotWaterData', { flow })} /><NumberSetting label={t('common.metric.maxDuration')} value={numberValue(settings.draft.workflow.hotWaterData?.duration)} unit="s" {...SETTINGS_PROTOCOL.hotWater.duration} disabled={workflowUnavailable} onChange={(duration) => settings.patchWorkflow('hotWaterData', { duration })} /></SectionList></div></SettingsCard>
  </div>

  const clean = <div className="settings-grid">
    <SettingsCard eyebrow={t('settings.clean.groupHead.eyebrow')} title={t('settings.clean.groupHead.title')} description={t('settings.clean.groupHead.description')} wide><div className="settings-columns"><SectionList><TemperatureSetting label={t('common.metric.temperature')} value={numberValue(settings.draft.workflow.rinseData?.targetTemperature)} unit={temperatureUnit} {...SETTINGS_PROTOCOL.rinse.temperature} disabled={workflowUnavailable} onChange={(targetTemperature) => settings.patchWorkflow('rinseData', { targetTemperature })} /><NumberSetting label={t('common.metric.flow')} value={numberValue(settings.draft.workflow.rinseData?.flow)} unit="ml/s" {...SETTINGS_PROTOCOL.rinse.flow} digits={1} disabled={workflowUnavailable} onChange={(flow) => settings.patchWorkflow('rinseData', { flow })} /></SectionList><SectionList><NumberSetting label={t('common.metric.duration')} value={numberValue(settings.draft.workflow.rinseData?.duration)} unit="s" {...SETTINGS_PROTOCOL.rinse.duration} disabled={workflowUnavailable} onChange={(duration) => settings.patchWorkflow('rinseData', { duration })} /><TemperatureSetting label={t('settings.clean.tankTemperature')} value={numberValue(settings.draft.machine.tankTemp)} unit={temperatureUnit} {...SETTINGS_PROTOCOL.tankTemperature} disabled={machineUnavailable} onChange={(tankTemp) => settings.patchMachine({ tankTemp })} /></SectionList></div></SettingsCard>
    <SettingsCard eyebrow={t('settings.clean.maintenance.eyebrow')} title={t('settings.clean.maintenance.title')} wide description={t('settings.clean.maintenance.description')}><div className="settings-list"><div className="settings-row"><span>{t('settings.clean.cleaning')}</span><strong>{t('settings.clean.useCleaningProfile')}</strong></div></div><div className="settings-routine-actions"><button type="button" disabled={machineConnection !== 'connected' || routinePending !== undefined} onClick={() => void startRoutine('descaling', t('settings.clean.descaling.confirm'))}><span><strong>{t('settings.clean.descaling.title')}</strong><small>{t('settings.clean.descaling.hint')}</small></span><em>{routinePending === 'descaling' ? t('settings.action.starting') : t('settings.action.start')}</em></button><button type="button" disabled={machineConnection !== 'connected' || routinePending !== undefined} onClick={() => void startRoutine('airPurge', t('settings.clean.transport.confirm'))}><span><strong>{t('settings.clean.transport.title')}</strong><small>{t('settings.clean.transport.hint')}</small></span><em>{routinePending === 'airPurge' ? t('settings.action.starting') : t('settings.action.enable')}</em></button></div>{routineMessage && <p className="settings-helper settings-routine-error" role="alert">{routineMessage}</p>}</SettingsCard>
  </div>

  const alerts = <div className="settings-grid settings-grid--alerts">
    <SettingsCard eyebrow={t('settings.group.bestpresso')} title={t('settings.alerts.reservoir.title')} description={t('settings.alerts.reservoir.description')} action={<button className="settings-reset" type="button" onClick={() => updatePreferences({ waterWarningLevelMl: DEFAULT_BESTPRESSO_PREFERENCES.waterWarningLevelMl })}>{t('settings.action.reset')}</button>}><SectionList><NumberSetting label={t('settings.alerts.warnMe')} hint={t('settings.alerts.warnMeHint')} value={preferences.waterWarningLevelMl} unit="ml" min={preferences.waterCriticalLevelMl + 10} max={2000} step={10} onChange={updateWarning} /></SectionList><p className="settings-helper">{t('settings.alerts.priorityHelper')}</p></SettingsCard>
    <SettingsCard eyebrow={t('settings.alerts.safeguard.eyebrow')} title={t('settings.alerts.safeguard.title')}><SectionList><SwitchSetting label={t('settings.alerts.requireScale')} hint={t('settings.alerts.requireScaleHint')} checked={settings.draft.rea.blockOnNoScale} disabled={reaUnavailable} onChange={(blockOnNoScale) => settings.patchRea({ blockOnNoScale })} /><SwitchSetting label={t('settings.alerts.blockTare')} hint={t('settings.alerts.blockTareHint')} checked={settings.draft.rea.blockTareDuringShot} disabled={reaUnavailable} onChange={(blockTareDuringShot) => settings.patchRea({ blockTareDuringShot })} /></SectionList></SettingsCard>
  </div>

  const devices = <div className="settings-grid">{(['machine', 'scale'] as const).map((type) => <SettingsCard key={type} eyebrow={t('settings.devices.connection.eyebrow')} title={type === 'machine' ? t('settings.devices.machine') : t('common.utility.scale')} description={t('settings.devices.scanHint', { type: deviceTypeWord(type) })} action={<button className="settings-reset" type="button" disabled={settings.acting === 'scan'} onClick={() => void settings.scan()}>{settings.acting === 'scan' ? t('settings.action.scanning') : t('settings.action.scan')}</button>}><div className="settings-device-list">{settings.draft.devices.filter((device) => device.type === type).map((device) => { const id = device.id || ''; const preferred = type === 'machine' ? settings.draft.rea.preferredMachineId === id : settings.draft.rea.preferredScaleId === id; return <div className="settings-device" key={id || device.name}><span><strong>{device.name || deviceTypeWord(type)}</strong><small>{deviceStateLabel(device.state)}{device.available === false ? ` · ${t('settings.state.unavailable')}` : ''}</small></span><div>{!preferred && <button type="button" onClick={() => settings.patchRea(type === 'machine' ? { preferredMachineId: id } : { preferredScaleId: id })}>{t('settings.action.prefer')}</button>}{device.state === 'connected' ? <button type="button" onClick={() => void settings.disconnect(id)}>{t('settings.action.disconnect')}</button> : <button type="button" disabled={device.available === false} onClick={() => void settings.connect(id)}>{t('settings.action.connect')}</button>}<button type="button" className="is-danger" onClick={() => window.confirm(t('settings.devices.forgetConfirm', { name: device.name || t('settings.devices.thisDevice') })) && void settings.forget(id)}>{t('settings.action.forget')}</button></div></div>})}{!settings.draft.devices.some((device) => device.type === type) && <p className="settings-empty">{t('settings.devices.noneFound', { type: deviceTypeWord(type) })}</p>}</div>{type === 'scale' && <SectionList><SelectSetting label={t('settings.devices.sleepPowerMode.label')} value={settings.draft.rea.scalePowerMode} disabled={reaUnavailable} options={[{ value: 'disabled', label: t('settings.devices.sleepPowerMode.doNothing') }, { value: 'displayOff', label: t('settings.devices.sleepPowerMode.displayOff') }, { value: 'disconnect', label: t('settings.devices.sleepPowerMode.disconnectScale') }]} onChange={(scalePowerMode) => settings.patchRea({ scalePowerMode: scalePowerMode as 'disabled' | 'displayOff' | 'disconnect' })} /></SectionList>}</SettingsCard>)}</div>

  const power = <div className="settings-grid"><div className="settings-stack"><SettingsCard eyebrow={t('settings.power.display.eyebrow')} title={t('settings.power.display.title')}><SectionList><NumberSetting label={t('settings.power.brightness')} hint={settings.draft.display.lowBatteryBrightnessActive ? t('settings.power.brightnessHintCapped') : t('settings.power.brightnessHintDefault')} value={numberValue(settings.draft.display.requestedBrightness ?? settings.draft.display.brightness)} unit="%" {...SETTINGS_PROTOCOL.brightness} disabled={settings.unavailable.includes('display') || settings.draft.display.platformSupported?.brightness === false} onChange={(requestedBrightness) => settings.patchDisplay({ requestedBrightness })} /><SwitchSetting label={t('settings.power.limitBrightness')} checked={settings.draft.rea.lowBatteryBrightnessLimit} disabled={reaUnavailable} onChange={(lowBatteryBrightnessLimit) => settings.patchRea({ lowBatteryBrightnessLimit })} /><NumberSetting label={t('settings.power.screensaverBrightness')} hint={t('settings.power.screensaverBrightnessHint')} value={preferences.screensaverBrightness} unit="%" min={0} max={100} step={1} onChange={(screensaverBrightness) => updatePreferences({ screensaverBrightness })} /><NumberSetting label={t('settings.power.screenOffAfter')} hint={t('settings.power.screenOffAfterHint')} value={preferences.screensaverScreenOffDelaySeconds} unit="s" min={0} max={3600} step={15} onChange={(screensaverScreenOffDelaySeconds) => updatePreferences({ screensaverScreenOffDelaySeconds })} /></SectionList></SettingsCard><SettingsCard eyebrow={t('settings.power.battery.eyebrow')} title={t('settings.power.battery.title')}><SectionList><SelectSetting label={t('settings.power.chargingMode')} value={settings.draft.rea.chargingMode} disabled={reaUnavailable} options={[{ value: 'disabled', label: t('settings.state.disabled') }, { value: 'longevity', label: t('settings.power.chargingMode.longevity') }, { value: 'balanced', label: t('settings.power.chargingMode.balanced') }, { value: 'highAvailability', label: t('settings.power.chargingMode.highAvailability') }]} onChange={(chargingMode) => settings.patchRea({ chargingMode: chargingMode as 'disabled' | 'longevity' | 'balanced' | 'highAvailability' })} /><SwitchSetting label={t('settings.power.overnightSchedule')} checked={settings.draft.rea.nightModeEnabled} disabled={reaUnavailable} onChange={(nightModeEnabled) => settings.patchRea({ nightModeEnabled })} /><div className="settings-time-pair"><label><span>{t('settings.power.sleepTime')}</span><input type="time" disabled={reaUnavailable} value={timeText(settings.draft.rea.nightModeSleepTime)} onChange={(event) => settings.patchRea({ nightModeSleepTime: timeMinutes(event.target.value) })} /></label><label><span>{t('settings.power.morningTime')}</span><input type="time" disabled={reaUnavailable} value={timeText(settings.draft.rea.nightModeMorningTime)} onChange={(event) => settings.patchRea({ nightModeMorningTime: timeMinutes(event.target.value) })} /></label></div></SectionList></SettingsCard></div><div className="settings-stack"><SettingsCard eyebrow={t('settings.power.sleepWake.eyebrow')} title={t('settings.power.sleepWake.title')}><SectionList><SwitchSetting label={t('settings.power.keepScreenAwake')} checked={settings.draft.rea.keepAwake} disabled={reaUnavailable} onChange={(keepAwake) => settings.patchRea({ keepAwake })} /><SwitchSetting label={t('settings.power.presenceDetection')} checked={settings.draft.presence.userPresenceEnabled} disabled={settings.unavailable.includes('presence')} onChange={(userPresenceEnabled) => settings.patchPresence({ userPresenceEnabled })} /><NumberSetting label={t('settings.power.sleepAfter')} hint={t('settings.power.sleepAfterHint')} value={numberValue(settings.draft.presence.sleepTimeoutMinutes)} unit="min" {...SETTINGS_PROTOCOL.presenceTimeout} disabled={settings.unavailable.includes('presence')} onChange={(sleepTimeoutMinutes) => settings.patchPresence({ sleepTimeoutMinutes })} /></SectionList></SettingsCard><SettingsCard eyebrow={t('settings.power.schedule.eyebrow')} title={t('settings.power.schedule.title')} description={t('settings.power.schedule.description')} action={<button className="settings-reset" type="button" disabled={settings.unavailable.includes('presence')} onClick={() => void settings.createSchedule({ time: '07:00', daysOfWeek: [1, 2, 3, 4, 5], enabled: true, keepAwakeFor: 60 })}>{t('settings.action.addSchedule')}</button>}><div className="settings-schedule-list">{(settings.draft.presence.schedules || []).map((schedule) => <div className="settings-schedule" key={schedule.id}><input aria-label={t('settings.power.schedule.wakeTime')} type="time" value={schedule.time || timeText(schedule.hour === undefined ? undefined : schedule.hour * 60 + (schedule.minute || 0))} onChange={(event) => schedule.id && void settings.updateSchedule(schedule.id, { time: event.target.value })} /><span>{schedule.daysOfWeek?.length ? schedule.daysOfWeek.length === 7 ? t('settings.power.schedule.everyDay') : plural('settings.power.schedule.daysCount', schedule.daysOfWeek.length) : t('settings.power.schedule.everyDay')}</span><Toggle label={t('settings.power.schedule.enabled')} checked={schedule.enabled !== false} onChange={(enabled) => schedule.id && void settings.updateSchedule(schedule.id, { enabled })} /><button type="button" className="settings-reset" onClick={() => schedule.id && window.confirm(t('settings.power.schedule.deleteConfirm')) && void settings.deleteSchedule(schedule.id)}>{t('settings.action.remove')}</button></div>)}{!(settings.draft.presence.schedules || []).length && <p className="settings-empty">{t('settings.power.schedule.empty')}</p>}</div></SettingsCard></div></div>

  const experience = <div className="settings-grid"><SettingsCard eyebrow={t('settings.experience.sound.eyebrow')} title={t('settings.experience.playSound')} wide action={<Toggle checked={preferences.completionSoundEnabled} onChange={(completionSoundEnabled) => updatePreferences({ completionSoundEnabled })} label={t('settings.experience.playSound')} />}><></></SettingsCard><SettingsCard eyebrow={t('settings.experience.appearance.eyebrow')} title={t('settings.experience.appearance.title')}><SectionList><SwitchSetting label={t('settings.experience.animations')} hint={t('settings.experience.animationsHint')} checked={preferences.animationsEnabled} onChange={(animationsEnabled) => updatePreferences({ animationsEnabled })} /><SelectSetting label={t('common.language.label')} hint={t('common.language.hint')} value={preferences.language} options={[{ value: 'auto', label: t('common.language.auto', { language: languageName(resolveLanguage('auto')) }) }, ...LANGUAGES.map((language) => ({ value: language, label: languageName(language) }))]} onChange={(value) => updatePreferences({ language: isLanguage(value) ? value : 'auto' })} /><SelectSetting label={t('settings.experience.bestpressoTheme')} hint={t('settings.experience.bestpressoThemeHint')} value={preferences.theme} options={[{ value: 'dark', label: t('settings.theme.dark') }, { value: 'light', label: t('settings.theme.lightBeta') }]} onChange={(value) => updatePreferences({ theme: value === 'light' ? 'light' : 'dark' })} /><SelectSetting label={t('settings.experience.decaidTheme')} hint={t('settings.experience.decaidThemeHint')} value={settings.draft.rea.themeMode} disabled={reaUnavailable} options={[{ value: 'system', label: t('settings.option.followDevice') }, { value: 'light', label: t('settings.theme.light') }, { value: 'dark', label: t('settings.theme.dark') }]} onChange={(themeMode) => settings.patchRea({ themeMode: themeMode as 'system' | 'light' | 'dark' })} /><SelectSetting label={t('settings.experience.clockFormat')} hint={t('settings.experience.clockFormatHint')} value={preferences.clockFormat} options={[{ value: 'device', label: t('settings.option.followDevice') }, { value: '12h', label: t('settings.clock.12h') }, { value: '24h', label: t('settings.clock.24h') }]} onChange={(value) => updatePreferences({ clockFormat: value === '24h' ? '24h' : value === '12h' ? '12h' : 'device' })} /><SelectSetting label={t('common.metric.temperature')} hint={t('settings.experience.temperatureUnitHint')} value={temperatureUnit} options={[{ value: 'C', label: t('settings.unit.celsius') }, { value: 'F', label: t('settings.unit.fahrenheit') }]} onChange={(value) => updatePreferences({ temperatureUnit: value === 'F' ? 'F' : 'C' })} /></SectionList></SettingsCard><div className="settings-stack"><SettingsCard eyebrow={t('settings.experience.charts.eyebrow')} title={t('settings.experience.lineWeight.title')} description={t('settings.experience.lineWeight.description')}><div className="settings-line-options">{(['fine', 'standard', 'bold'] as ChartLineWeight[]).map((weight) => <button className={preferences.chartLineWeight === weight ? 'is-selected' : ''} type="button" key={weight} onClick={() => updatePreferences({ chartLineWeight: weight })}><svg viewBox="0 0 120 34" aria-hidden="true"><path d="M2 27 C27 27 27 8 54 8 S82 25 118 13" /></svg><span>{chartLineWeightLabel(weight)}</span></button>)}</div></SettingsCard><SettingsCard eyebrow={t('settings.group.bestpresso')} title={t('settings.experience.reset.title')} description={t('settings.experience.reset.description')}><button className="settings-reset settings-reset--all" type="button" onClick={resetPreferences}>{t('settings.action.resetPreferences')}</button></SettingsCard></div></div>

  const onImport = async (file?: File) => { if (!file) return; setImporting(true); try { await importDecaidBackup(file); await settings.reload() } finally { setImporting(false); if (importInput.current) importInput.current.value = '' } }
  const data = <div className="settings-grid"><SettingsCard eyebrow={t('settings.data.backup.eyebrow')} title={t('settings.data.backup.title')} description={t('settings.data.backup.description')}><a className="settings-action-button" href={`${getDecaidEndpoints().apiBase}/data/export`} download>{t('settings.action.download')}</a></SettingsCard><SettingsCard eyebrow={t('settings.data.restore.eyebrow')} title={t('settings.data.restore.title')} description={t('settings.data.restore.description')}><input ref={importInput} className="settings-file-input" type="file" accept=".zip,application/zip" onChange={(event) => void onImport(event.target.files?.[0])} /><button className="settings-action-button" type="button" disabled={importing} onClick={() => importInput.current?.click()}>{importing ? t('settings.action.importing') : t('settings.action.chooseBackupZip')}</button></SettingsCard><SettingsCard eyebrow={t('settings.data.diagnostics.eyebrow')} title={t('settings.data.diagnostics.title')} wide description={t('settings.data.diagnostics.description')} action={<a className="settings-action-button" href={`${getDecaidEndpoints().apiBase}/logs?kb=1024&order=desc`} target="_blank" rel="noreferrer">{t('settings.action.viewLogs')}</a>}><></></SettingsCard></div>

  const extensions = <div className="settings-grid">{settings.draft.plugins.map((plugin) => <SettingsCard key={plugin.id || plugin.name} eyebrow={t('settings.extensions.eyebrow')} title={plugin.name || plugin.id || t('settings.extensions.fallbackTitle')} description={plugin.description || plugin.version || t('settings.extensions.fallbackDescription')} action={<Toggle checked={plugin.loaded === true} label={t('settings.extensions.pluginEnabledLabel', { name: plugin.name || plugin.id || '' })} disabled={!plugin.id || settings.acting === `plugin:${plugin.id}`} onChange={(enabled) => plugin.id && void settings.togglePlugin(plugin.id, enabled)} />}><div className="settings-list"><div className="settings-row"><span>{t('settings.extensions.version')}</span><strong>{plugin.version || '—'}</strong></div><div className="settings-row"><span>{t('settings.extensions.autoLoad')}</span><strong>{plugin.autoLoad === false ? t('settings.state.off') : t('settings.state.on')}</strong></div><div className="settings-row"><span>{t('settings.extensions.update')}</span><strong>{plugin.pendingUpdate ? t('settings.state.available') : t('common.metric.current')}</strong></div></div></SettingsCard>)}{!settings.draft.plugins.length && <SettingsCard eyebrow={t('settings.eyebrow.decaid')} title={t('settings.extensions.noPlugins.title')} description={t('settings.extensions.noPlugins.description')}><p className="settings-helper">{t('settings.extensions.noPlugins.helper')}</p></SettingsCard>}</div>

  const simulatedDevices = settings.draft.rea.simulatedDevices || []
  const toggleSimulatedDevice = (device: 'machine' | 'scale' | 'sensor' | 'bengle', enabled: boolean) => settings.patchRea({
    simulatedDevices: enabled ? Array.from(new Set([...simulatedDevices, device])) : simulatedDevices.filter((candidate) => candidate !== device),
  })
  const advanced = <div className="settings-grid">
    <SettingsCard eyebrow={t('settings.eyebrow.decaid')} title={t('settings.advanced.gateway.title')}>
      <SectionList>
        <SelectSetting label={t('settings.advanced.gatewayMode')} value={settings.draft.rea.gatewayMode} disabled={reaUnavailable} options={[{ value: 'disabled', label: t('settings.state.disabled') }, { value: 'tracking', label: t('settings.advanced.gatewayMode.tracking') }, { value: 'full', label: t('settings.advanced.gatewayMode.full') }]} onChange={(gatewayMode) => settings.patchRea({ gatewayMode: gatewayMode as 'disabled' | 'tracking' | 'full' })} />
        {/* Decaid's Java-style log-level names (ALL/FINEST/…/OFF) are technical enum values, not translated UI text; the option label intentionally equals its value. */}
        <SelectSetting label={t('settings.advanced.logLevel')} value={settings.draft.rea.logLevel} disabled={reaUnavailable} options={['ALL', 'FINEST', 'FINER', 'FINE', 'CONFIG', 'INFO', 'WARNING', 'SEVERE', 'SHOUT', 'OFF'].map((value) => ({ value, label: value }))} onChange={(logLevel) => settings.patchRea({ logLevel })} />
        <SwitchSetting label={t('settings.advanced.autoUpdateChecks')} checked={settings.draft.rea.automaticUpdateCheck} disabled={reaUnavailable} onChange={(automaticUpdateCheck) => settings.patchRea({ automaticUpdateCheck })} />
        <TextSetting label={t('settings.advanced.customWebUiFolder')} hint={t('settings.advanced.customWebUiFolderHint')} value={settings.draft.rea.webUiPath} placeholder={t('settings.advanced.customWebUiFolderPlaceholder')} disabled={reaUnavailable} onChange={(webUiPath) => settings.patchRea({ webUiPath: webUiPath || null })} />
      </SectionList>
    </SettingsCard>
    <SettingsCard eyebrow={t('settings.advanced.machine.eyebrow')} title={t('settings.advanced.general.title')}>
      <SectionList>
        <SwitchSetting label={t('settings.advanced.usbCharging')} checked={settings.draft.machine.usb} disabled={machineUnavailable} onChange={(usb) => settings.patchMachine({ usb })} />
        <NumberSetting label={t('settings.advanced.fanThreshold')} value={numberValue(settings.draft.machine.fan)} unit="%" {...SETTINGS_PROTOCOL.fan} disabled={machineUnavailable} onChange={(fan) => settings.patchMachine({ fan })} />
        <SelectSetting label={t('settings.advanced.steamPurgeMode')} value={settings.draft.machine.steamPurgeMode} disabled={machineUnavailable} options={[{ value: 0, label: t('settings.purge.normal') }, { value: 1, label: t('settings.purge.twoTap') }]} onChange={(steamPurgeMode) => settings.patchMachine({ steamPurgeMode: Number(steamPurgeMode) })} />
      </SectionList>
    </SettingsCard>
    <SettingsCard eyebrow={t('settings.advanced.machine.eyebrow')} title={t('settings.advanced.heating.title')} wide>
      <div className="settings-columns"><SectionList>
        <NumberSetting label={t('settings.advanced.heatingFlowPhase1')} value={numberValue(settings.draft.advanced.heaterPh1Flow)} unit="ml/s" {...SETTINGS_PROTOCOL.heater.flow} digits={1} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterPh1Flow) => settings.patchAdvanced({ heaterPh1Flow })} />
        <NumberSetting label={t('settings.advanced.heatingFlowPhase2')} value={numberValue(settings.draft.advanced.heaterPh2Flow)} unit="ml/s" {...SETTINGS_PROTOCOL.heater.flow} digits={1} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterPh2Flow) => settings.patchAdvanced({ heaterPh2Flow })} />
      </SectionList><SectionList>
        <TemperatureSetting label={t('settings.advanced.idleHeaterTemp')} value={numberValue(settings.draft.advanced.heaterIdleTemp)} unit={temperatureUnit} {...SETTINGS_PROTOCOL.heater.idleTemperature} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterIdleTemp) => settings.patchAdvanced({ heaterIdleTemp })} />
        <NumberSetting label={t('settings.advanced.stabilizationTimeout')} value={numberValue(settings.draft.advanced.heaterPh2Timeout)} unit="s" {...SETTINGS_PROTOCOL.heater.phase2Timeout} disabled={settings.unavailable.includes('advanced machine')} onChange={(heaterPh2Timeout) => settings.patchAdvanced({ heaterPh2Timeout })} />
      </SectionList></div>
    </SettingsCard>
    <SettingsCard eyebrow={t('settings.advanced.machine.eyebrow')} title={t('settings.advanced.installation.title')} description={t('settings.advanced.installation.description')} wide>
      <div className="settings-columns"><SectionList>
        <SelectSetting label={t('settings.advanced.refillKit')} value={settings.draft.advanced.refillKitSetting} disabled={settings.unavailable.includes('advanced machine')} options={[{ value: 2, label: t('settings.refill.automatic') }, { value: 1, label: t('settings.refill.forceOn') }, { value: 0, label: t('settings.refill.forceOff') }]} onChange={(refillKitSetting) => settings.patchAdvanced({ refillKitSetting: Number(refillKitSetting) as 0 | 1 | 2 })} />
        <SelectSetting label={t('settings.advanced.heaterVoltage')} hint={t('settings.advanced.heaterVoltageHint')} value={settings.draft.advanced.heaterVoltage} disabled={settings.unavailable.includes('advanced machine')} options={[...(settings.draft.advanced.heaterVoltage === -1 ? [{ value: -1, label: t('settings.voltage.notSet') }] : []), { value: 120, label: t('settings.voltage.120') }, { value: 230, label: t('settings.voltage.230') }]} onChange={(heaterVoltage) => { const value = Number(heaterVoltage); if (value === 120 || value === 230) settings.patchAdvanced({ heaterVoltage: value }) }} />
      </SectionList><div className="settings-list settings-capability-list"><div className="settings-row"><span>{t('settings.advanced.capabilities')}</span><strong>{Array.isArray(settings.draft.capabilities.capabilities) && settings.draft.capabilities.capabilities.length ? settings.draft.capabilities.capabilities.join(', ') : t('settings.advanced.capabilitiesFallback')}</strong></div><p className="settings-helper">{t('settings.advanced.capabilitiesHelper')}</p></div></div>
    </SettingsCard>
    <SettingsCard eyebrow={t('settings.advanced.developer.eyebrow')} title={t('settings.advanced.developer.title')} description={t('settings.advanced.developer.description')} wide>
      <div className="settings-columns"><SectionList>
        <SwitchSetting label={t('settings.advanced.mockMachine')} checked={simulatedDevices.includes('machine')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('machine', enabled)} />
        <SwitchSetting label={t('settings.advanced.mockScale')} checked={simulatedDevices.includes('scale')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('scale', enabled)} />
      </SectionList><SectionList>
        <SwitchSetting label={t('settings.advanced.mockSensor')} checked={simulatedDevices.includes('sensor')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('sensor', enabled)} />
        <SwitchSetting label={t('settings.advanced.mockBengle')} checked={simulatedDevices.includes('bengle')} disabled={reaUnavailable} onChange={(enabled) => toggleSimulatedDevice('bengle', enabled)} />
      </SectionList></div>
    </SettingsCard>
  </div>

  const content: Record<SettingsSection, ReactNode> = { overview, prepare, clean, alerts, devices, power, experience, data, extensions, advanced }
  return <main className="settings-screen"><aside className="settings-sidebar"><SidebarBrand onClose={onClose} closeLabel={t('settings.sidebar.closeSettings')} /><div className="settings-account"><span className="settings-account__avatar">B</span><span><strong>{t('settings.group.bestpresso')}</strong><small>{connection === 'connected' ? t('settings.sidebar.accountConnected') : t('settings.sidebar.accountLocal')}</small></span></div><nav aria-label={t('settings.sidebar.navLabel')}>{Array.from(new Set(visibleSections.map((candidate) => candidate.group))).map((group) => <div key={group}><small>{group}</small>{visibleSections.filter((candidate) => candidate.group === group).map((candidate) => <SidebarNavItem active={candidate.id === activeSection} key={candidate.id} onClick={() => setActiveSection(candidate.id)}><i aria-hidden="true" />{candidate.label}</SidebarNavItem>)}</div>)}</nav></aside><section className="settings-content"><header className="settings-content__header"><span><h1>{section.title}</h1></span><div className="settings-header-actions"><label><span aria-hidden="true">⌕</span><input type="search" value={search} placeholder={t('settings.search.placeholder')} aria-label={t('settings.search.placeholder')} onChange={(event) => setSearch(event.target.value)} /></label>{(settings.dirty || preferencesDirty) && <button type="button" className="settings-cancel" onClick={() => { settings.reset(); setPreferencePatch({}) }}>{t('settings.action.cancel')}</button>}<button type="button" className="settings-save" disabled={(!settings.dirty && !preferencesDirty) || settings.saving || settings.loading} onClick={() => { if (preferencesDirty) { persistPreferences(preferences); setPreferencePatch({}) } if (settings.dirty) void settings.save() }}>{settings.saving ? t('settings.action.saving') : t('settings.action.save')}</button></div></header>{(settings.message || settings.loading || settings.unavailable.length > 0) && <div className={`settings-status${settings.messageError ? ' is-error' : ''}`} role="status">{settings.loading ? t('settings.status.loading') : settings.message || t('settings.status.unavailable', { list: settings.unavailable.map(unavailableLabel).join(', ') })}</div>}<div className="settings-content__body">{content[activeSection]}</div></section></main>
}
