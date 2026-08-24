import type { LiveShotPoint } from '../../domain/brewing'

interface StageSummary {
  key: string
  name: string
  startedAt: number
  endedAt: number
  yield: number | undefined
  minimumTemperature: number | undefined
  maximumTemperature: number | undefined
  firstPressure: number | undefined
  peakPressure: number | undefined
  finalPressure: number | undefined
}

const timedLabel = (milliseconds: number) => {
  const seconds = Math.max(0, Math.round(milliseconds / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

const finiteValues = (points: LiveShotPoint[], key: 'temperature' | 'pressure' | 'weight') => points
  .map((point) => point[key])
  .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

function summarizeLiveBrewStages(points: LiveShotPoint[], elapsedMs: number): StageSummary[] {
  const groups: Array<{ key: string; name: string; points: LiveShotPoint[] }> = []
  for (const point of points) {
    const name = point.stageName?.trim() || 'Extraction'
    const key = point.stageIndex === undefined ? `name:${name}` : `frame:${point.stageIndex}`
    const current = groups.at(-1)
    if (!current || current.key !== key) groups.push({ key, name, points: [point] })
    else current.points.push(point)
  }

  return groups.map((group, index) => {
    const temperatures = finiteValues(group.points, 'temperature')
    const pressures = finiteValues(group.points, 'pressure')
    const weights = finiteValues(group.points, 'weight')
    const startedAt = group.points[0]?.elapsedMs ?? 0
    const endedAt = groups[index + 1]?.points[0]?.elapsedMs ?? Math.max(elapsedMs, group.points.at(-1)?.elapsedMs ?? startedAt)
    return {
      key: `${group.key}:${index}`,
      name: group.name,
      startedAt,
      endedAt,
      yield: weights.at(-1),
      minimumTemperature: temperatures.length ? Math.min(...temperatures) : undefined,
      maximumTemperature: temperatures.length ? Math.max(...temperatures) : undefined,
      firstPressure: pressures[0],
      peakPressure: pressures.length ? Math.max(...pressures) : undefined,
      finalPressure: pressures.at(-1),
    }
  })
}

const reading = (value: number | undefined, digits = 1) => value === undefined ? '—' : value.toFixed(digits)

export function LiveBrewStages({ points, elapsedMs }: { points: LiveShotPoint[]; elapsedMs: number }) {
  const stages = summarizeLiveBrewStages(points, elapsedMs)
  if (!stages.length) return <section className="live-brew-stages live-brew-stages--empty" aria-label="Pull stages"><p>Waiting for the first stage…</p></section>

  return <section className="live-brew-stages" aria-label="Pull stages">
    {stages.map((stage) => <article className="live-brew-stage" key={stage.key}>
      <header><h2>{stage.name}</h2><time>{timedLabel(stage.endedAt - stage.startedAt)}</time></header>
      <dl>
        <div><dt>Yield</dt><dd>{reading(stage.yield)}<small>g</small></dd></div>
        <div><dt>Temperature range</dt><dd>{reading(stage.minimumTemperature, 0)}° – {reading(stage.maximumTemperature, 0)}°</dd></div>
        <div><dt>Pressure</dt><dd>{reading(stage.firstPressure)} → {reading(stage.peakPressure)} → {reading(stage.finalPressure)}</dd></div>
      </dl>
    </article>)}
  </section>
}
