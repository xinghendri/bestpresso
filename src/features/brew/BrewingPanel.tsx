import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { Metric } from '../../components/Metric/Metric'
import type { BrewProfile, EditableProfileSetting } from '../../domain/brewing'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { ProfileTargetChart } from './ProfileTargetChart'

function wrappedOffset(index: number, activeIndex: number, length: number) {
  const direct = index - activeIndex
  if (direct > length / 2) return direct - length
  if (direct < -length / 2) return direct + length
  return direct
}

function doseToYieldRatio(dose: string | number, targetYield: string | number) {
  const doseValue = Number(dose)
  const yieldValue = Number(targetYield)
  if (!Number.isFinite(doseValue) || doseValue <= 0 || !Number.isFinite(yieldValue)) return undefined
  return `1:${(yieldValue / doseValue).toFixed(1)} ratio`
}

export function BrewingPanel({ profiles, activeProfileId, settingsDisabled, onUpdateProfile, onManageProfiles }: { profiles: BrewProfile[]; activeProfileId?: string; settingsDisabled?: boolean; onUpdateProfile: (profileId: string, setting: EditableProfileSetting, value: number) => void; onManageProfiles: () => void }) {
  const initialIndex = Math.max(0, profiles.findIndex((profile) => profile.id === activeProfileId || profile.id === 'adaptive-v2'))
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const pointerStart = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const activeProfile = profiles[activeIndex] ?? profiles[0]
  const ratio = doseToYieldRatio(activeProfile.dose, activeProfile.targetYield)
  const doseValue = Number(activeProfile.dose)
  const yieldValueHint = Number.isFinite(doseValue) && doseValue > 0
    ? (targetYield: number) => doseToYieldRatio(doseValue, targetYield)
    : undefined

  const editProfileSetting = (setting: EditableProfileSetting, valueHint?: (value: number) => string | undefined) => {
    const definition = VALUE_ADJUSTMENTS[setting]
    return {
      title: definition.title,
      min: definition.min,
      max: definition.max,
      step: definition.step,
      mode: definition.mode,
      initialValue: 'defaultValue' in definition ? definition.defaultValue : undefined,
      suggestionKey: setting,
      presets: definition.suggestions,
      valueHint,
      disabled: settingsDisabled,
      onSave: (value: number) => onUpdateProfile(activeProfile.id, setting, value),
    }
  }

  const selectRelative = (direction: number) => {
    setActiveIndex((current) => (current + direction + profiles.length) % profiles.length)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    pointerStart.current = event.clientX
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current === null) return
    const distance = event.clientX - pointerStart.current
    pointerStart.current = null
    if (Math.abs(distance) >= 42) {
      suppressClick.current = true
      selectRelative(distance < 0 ? 1 : -1)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') selectRelative(1)
    if (event.key === 'ArrowLeft') selectRelative(-1)
  }

  return <section className="brew-panel">
    <div className="profile-carousel" aria-label="Profiles" aria-roledescription="carousel" tabIndex={0} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} onPointerCancel={() => { pointerStart.current = null }}>
      {profiles.map((profile, index) => {
        const offset = wrappedOffset(index, activeIndex, profiles.length)
        const position = offset === 0
          ? 'active'
          : offset === -1
            ? 'left'
            : offset === 1
              ? 'right'
              : offset === -2
                ? 'far-left'
                : offset === 2
                  ? 'far-right'
                  : 'hidden'
        return <button key={profile.id} className={`profile-card profile-card--${position}`} type="button" onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } setActiveIndex(index) }} aria-current={offset === 0 ? 'true' : undefined} aria-label={`${profile.name}${offset === 0 ? ', selected' : ''}`}>
          <h1>{profile.name}</h1>
          {offset === 0 && <ProfileTargetChart profileName={profile.name} points={profile.targetPoints} />}
        </button>
      })}
    </div>
    <button className="manage-profiles" type="button" onClick={onManageProfiles}>Manage profiles →</button>
    <div className="brew-metrics" key={activeProfile.id} aria-live="polite">
      <Metric metric={{ label: 'Temp.', value: activeProfile.temperature, unit: '°' }} edit={editProfileSetting('temperature')} />
      <Metric metric={{ label: 'Grind size', value: activeProfile.grindSetting }} edit={editProfileSetting('grindSetting')} />
      <Metric metric={{ label: 'Dose', value: activeProfile.dose, unit: 'g' }} edit={editProfileSetting('dose')} />
      <Metric metric={{ label: 'Yield', value: activeProfile.targetYield, unit: 'g', subtext: ratio, subtextVariant: 'pill' }} edit={editProfileSetting('targetYield', yieldValueHint)} />
    </div>
  </section>
}
