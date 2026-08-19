import profileFlow from '../../assets/figma/profile-flow.svg'
import profilePressure from '../../assets/figma/profile-pressure.svg'
import { Metric } from '../../components/Metric/Metric'
import type { BrewProfile } from '../../domain/brewing'

export function BrewingPanel({ profile }: { profile: BrewProfile }) {
  return <section className="brew-panel">
    <div className="profile-carousel" aria-label="Profile carousel">
      <article className="profile-card profile-card--side profile-card--left">Trendy 6 bar<br />low pressure shot</article>
      <article className="profile-card profile-card--active"><h1>{profile.name}</h1><div className="profile-card__chart"><img src={profilePressure} alt="" /><img src={profileFlow} alt="" /></div></article>
      <article className="profile-card profile-card--side profile-card--right">Best practice<br />(light roast)</article>
    </div>
    <button className="manage-profiles" type="button">Manage profiles →</button>
    <div className="brew-metrics">
      <Metric metric={{ label: 'Temp.', value: profile.temperature, unit: '°' }} />
      <Metric metric={{ label: 'Grind size', value: profile.grindSetting }} />
      <Metric metric={{ label: 'Dose', value: profile.dose, unit: 'g' }} />
      <Metric metric={{ label: 'Target yield', value: profile.targetYield, unit: 'g' }} />
    </div>
  </section>
}
