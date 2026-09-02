import { useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import { Metric } from '../../components/Metric/Metric'
import type { BrewProfile, EditableProfileSetting } from '../../domain/brewing'
import type { FixedValueSuggestion } from '../../domain/valueAdjustments'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { doseToYieldRatio } from './brewRatio'
import { ProfileTargetChart } from './ProfileTargetChart'
import { profileCardMotion, profileCardPosition, projectedProfileSteps, wrappedProfileOffset } from './profileCarouselMotion'

interface CarouselDrag {
  pointerId: number
  startX: number
  lastX: number
  lastAt: number
  velocity: number
  stride: number
  moved: boolean
}

export function BrewingPanel({ profiles, activeProfileId, settingsDisabled, onUpdateProfile, onSelectProfile, onManageProfiles }: { profiles: BrewProfile[]; activeProfileId?: string; settingsDisabled?: boolean; onUpdateProfile: (profileId: string, setting: EditableProfileSetting, value: number) => void; onSelectProfile: (profileId: string) => Promise<boolean>; onManageProfiles: () => void }) {
  const selectedIndex = profiles.findIndex((profile) => profile.id === activeProfileId)
  const fallbackIndex = profiles.findIndex((profile) => profile.id === 'adaptive-v2')
  const initialIndex = Math.max(0, selectedIndex >= 0 ? selectedIndex : fallbackIndex)
  const [optimisticProfileId, setOptimisticProfileId] = useState<string | null>(null)
  const optimisticIndex = profiles.findIndex((profile) => profile.id === optimisticProfileId)
  const activeIndex = optimisticIndex >= 0 ? optimisticIndex : initialIndex
  const [dragProgress, setDragProgress] = useState(0)
  const pointerStart = useRef<CarouselDrag | null>(null)
  const suppressClick = useRef(false)
  const selectionRequest = useRef(0)
  const activeProfile = profiles[activeIndex] ?? profiles[0]
  const ratio = doseToYieldRatio(activeProfile.dose, activeProfile.targetYield)
  const doseValue = Number(activeProfile.dose)
  const effectiveDose = Number.isFinite(doseValue) && doseValue >= 0 ? doseValue : VALUE_ADJUSTMENTS.dose.defaultValue
  const yieldValueHint = effectiveDose > 0
    ? (targetYield: number) => doseToYieldRatio(effectiveDose, targetYield)
    : undefined
  const fixedYieldSuggestions: readonly FixedValueSuggestion[] = [
    { label: 'Ristretto', detail: '1:1', value: effectiveDose },
    { label: 'Espresso', detail: '1:2', value: effectiveDose * 2 },
    { label: 'Lungo', detail: '1:3', value: effectiveDose * 3 },
    { label: 'Lungo+', detail: '1:4', value: effectiveDose * 4 },
  ]

  const editProfileSetting = (setting: EditableProfileSetting, valueHint?: (value: number) => string | undefined, fixedSuggestions?: readonly FixedValueSuggestion[]) => {
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
      fixedSuggestions,
      valueHint,
      disabled: settingsDisabled,
      onSave: (value: number) => onUpdateProfile(activeProfile.id, setting, value),
    }
  }

  const selectIndex = async (index: number) => {
    const profile = profiles[index]
    if (!profile) return
    if (profile.id === activeProfileId) {
      setOptimisticProfileId(null)
      return
    }
    setOptimisticProfileId(profile.id)
    const request = ++selectionRequest.current
    await onSelectProfile(profile.id)
    if (request === selectionRequest.current) setOptimisticProfileId(null)
  }

  const selectRelative = (direction: number) => {
    void selectIndex((activeIndex + direction + profiles.length) % profiles.length)
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const width = event.currentTarget.getBoundingClientRect().width
    pointerStart.current = { pointerId: event.pointerId, startX: event.clientX, lastX: event.clientX, lastAt: event.timeStamp, velocity: 0, stride: Math.max(84, width * 0.215), moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = pointerStart.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const elapsed = Math.max(1, event.timeStamp - gesture.lastAt)
    const instantaneousVelocity = (event.clientX - gesture.lastX) / elapsed
    gesture.velocity = gesture.velocity * 0.65 + instantaneousVelocity * 0.35
    gesture.lastX = event.clientX
    gesture.lastAt = event.timeStamp
    const distance = event.clientX - gesture.startX
    if (Math.abs(distance) >= 8) gesture.moved = true
    const maximumProgress = Math.max(1, profiles.length - 1)
    setDragProgress(Math.max(-maximumProgress, Math.min(maximumProgress, distance / gesture.stride)))
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = pointerStart.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const distance = event.clientX - gesture.startX
    pointerStart.current = null
    setDragProgress(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (gesture.moved) {
      suppressClick.current = true
      const steps = projectedProfileSteps(distance, gesture.velocity, gesture.stride, profiles.length)
      if (steps !== 0) void selectIndex((activeIndex + steps + profiles.length) % profiles.length)
    }
  }

  const cancelPointerGesture = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerStart.current?.pointerId !== event.pointerId) return
    pointerStart.current = null
    setDragProgress(0)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') selectRelative(1)
    if (event.key === 'ArrowLeft') selectRelative(-1)
  }

  return <section className="brew-panel">
    <div className={`profile-carousel${dragProgress !== 0 ? ' profile-carousel--dragging' : ''}`} aria-label="Profiles" aria-roledescription="carousel" tabIndex={0} onKeyDown={handleKeyDown} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={cancelPointerGesture}>
      {profiles.map((profile, index) => {
        const offset = wrappedProfileOffset(index, activeIndex - dragProgress, profiles.length)
        const position = profileCardPosition(offset)
        const motion = profileCardMotion(offset)
        const style = {
          '--profile-free-x': `${motion.xPercent}%`,
          '--profile-free-scale': motion.scale,
          '--profile-free-opacity': motion.opacity,
          zIndex: motion.zIndex,
        } as CSSProperties
        const graphVisible = Math.abs(offset) < 1.5
        return <button key={profile.id} className={`profile-card profile-card--free profile-card--${position}`} style={style} type="button" onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } void selectIndex(index) }} aria-current={index === activeIndex ? 'true' : undefined} aria-label={`${profile.name}${index === activeIndex ? ', selected' : ''}`}>
          <h1>{profile.name}</h1>
          {graphVisible && <ProfileTargetChart profileName={profile.name} points={profile.targetPoints} />}
        </button>
      })}
    </div>
    <button className="manage-profiles" type="button" onClick={onManageProfiles}>See all profiles →</button>
    <div className="brew-metrics" aria-live="polite">
      <Metric metric={{ label: 'Temp.', value: activeProfile.temperature, unit: '°' }} edit={editProfileSetting('temperature')} />
      <Metric metric={{ label: 'Grind size', value: activeProfile.grindSetting }} edit={editProfileSetting('grindSetting')} />
      <Metric metric={{ label: 'Dose', value: activeProfile.dose, unit: 'g' }} edit={editProfileSetting('dose')} />
      <Metric metric={{ label: 'Yield', value: activeProfile.targetYield, unit: Number.isFinite(Number(activeProfile.targetYield)) ? 'g' : undefined, subtext: ratio, subtextVariant: 'pill' }} reserveSubtext edit={editProfileSetting('targetYield', yieldValueHint, fixedYieldSuggestions)} />
    </div>
  </section>
}
