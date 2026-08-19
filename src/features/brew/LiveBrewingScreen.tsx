import logo from '../../assets/figma/decent-logo.png'
import brewingIcon from '../../assets/figma/ready.svg'
import { Metric } from '../../components/Metric/Metric'
import type { BrewingScreenModel, LiveBrewState } from '../../domain/brewing'
import { LiveShotChart } from './LiveShotChart'

interface LiveBrewingScreenProps {
  model: BrewingScreenModel
  liveBrew: LiveBrewState
}

export function LiveBrewingScreen({ model, liveBrew }: LiveBrewingScreenProps) {
  const profile = model.profiles.find((candidate) => candidate.id === model.activeProfileId) ?? model.profiles[0]
  if (!profile) return null

  const metrics = [
    { label: 'Temperature', value: profile.temperature, unit: '°' },
    { label: 'Grind setting', value: profile.grindSetting },
    { label: 'Dose', value: profile.dose, unit: 'g' },
    { label: 'Target yield', value: profile.targetYield, unit: 'g' },
  ]

  return <main className="live-brew-screen">
    <header className="live-brew-header">
      <img className="logo" src={logo} alt="decent" />
      <div className="live-brew-status" role="status"><img src={brewingIcon} alt="" /><strong>Brewing</strong></div>
    </header>
    <section className="live-brew-panel" aria-label={`Brewing ${profile.name}`}>
      <article className="live-brew-card">
        <h1>{profile.name}</h1>
        <LiveShotChart points={liveBrew.points} elapsedMs={liveBrew.elapsedMs} targetYield={Number(profile.targetYield) || 36} />
      </article>
      <div className="live-brew-metrics">{metrics.map((metric) => <Metric key={metric.label} metric={metric} />)}</div>
    </section>
  </main>
}
