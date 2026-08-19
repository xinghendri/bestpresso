import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import profileFlow from '../../assets/figma/profile-flow.svg'
import profilePressure from '../../assets/figma/profile-pressure.svg'
import { Metric } from '../../components/Metric/Metric'
import type { BrewProfile } from '../../domain/brewing'

function wrappedOffset(index: number, activeIndex: number, length: number) {
  const direct = index - activeIndex
  if (direct > length / 2) return direct - length
  if (direct < -length / 2) return direct + length
  return direct
}

export function BrewingPanel({ profiles, activeProfileId }: { profiles: BrewProfile[]; activeProfileId?: string }) {
  const initialIndex = Math.max(0, profiles.findIndex((profile) => profile.id === activeProfileId || profile.id === 'adaptive-v2'))
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const pointerStart = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const activeProfile = profiles[activeIndex] ?? profiles[0]

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
        const position = offset === 0 ? 'active' : Math.abs(offset) > 1 ? 'hidden' : offset < 0 ? 'left' : 'right'
        return <button key={profile.id} className={`profile-card profile-card--${position}`} type="button" onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } setActiveIndex(index) }} aria-current={offset === 0 ? 'true' : undefined} aria-label={`${profile.name}${offset === 0 ? ', selected' : ''}`}>
          <h1>{profile.name}</h1>
          {offset === 0 && <div className="profile-card__chart"><img src={profilePressure} alt="" /><img src={profileFlow} alt="" /></div>}
        </button>
      })}
    </div>
    <button className="manage-profiles" type="button">Manage profiles →</button>
    <div className="brew-metrics" key={activeProfile.id} aria-live="polite">
      <Metric metric={{ label: 'Temp.', value: activeProfile.temperature, unit: '°' }} />
      <Metric metric={{ label: 'Grind size', value: activeProfile.grindSetting }} />
      <Metric metric={{ label: 'Dose', value: activeProfile.dose, unit: 'g' }} />
      <Metric metric={{ label: 'Target yield', value: activeProfile.targetYield, unit: 'g' }} />
    </div>
  </section>
}
