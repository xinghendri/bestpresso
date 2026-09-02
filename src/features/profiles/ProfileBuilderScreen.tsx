import { useMemo, useState } from 'react'
import profilesBackIcon from '../../assets/figma/profiles-back.svg'
import type { ProfileTargetPoint } from '../../domain/brewing'
import { builderTargetPoints, createDefaultProfileDraft, nextBuilderStage, stageConstraintLabel } from './profileBuilderModel'
import type { BuilderStage, ProfileDraft } from './profileBuilderModel'

const CHART_WIDTH = 760
const CHART_HEIGHT = 220
const CHART_TOP = 24
const CHART_BOTTOM = 28

const pathFor = (points: ProfileTargetPoint[], key: 'pressure' | 'flow', maximum: number, duration: number) => points.reduce((path, point, index) => {
  const x = (point.elapsedMs / duration) * CHART_WIDTH
  const value = point[key] ?? 0
  const y = CHART_HEIGHT - CHART_BOTTOM - Math.max(0, Math.min(1, value / maximum)) * (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM)
  return `${path}${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
}, '')

function BuilderChart({ draft, activeStage }: { draft: ProfileDraft; activeStage: number }) {
  const points = builderTargetPoints(draft.stages)
  const duration = Math.max(1, points.at(-1)?.elapsedMs ?? 1)
  const spans = draft.stages.map((stage, index) => {
    const start = draft.stages.slice(0, index).reduce((total, item) => total + item.seconds * 1000, 0)
    return { start, end: start + stage.seconds * 1000 }
  })

  return <section className="profile-builder-chart" aria-label="Profile target preview">
    <header><div><span>Target preview</span><strong>{Math.round(duration / 1000)} seconds</strong></div><div className="profile-builder-chart__legend"><span><i className="profile-builder-chart__pressure" />Pressure</span><span><i className="profile-builder-chart__flow" />Flow</span></div></header>
    <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Pressure and flow targets across the profile stages">
      {[0, 1, 2, 3].map((line) => <line key={line} className="profile-builder-chart__grid" x1="0" x2={CHART_WIDTH} y1={CHART_TOP + line * 48} y2={CHART_TOP + line * 48} />)}
      {spans.map((span, index) => <rect key={draft.stages[index].id} className={index === activeStage ? 'profile-builder-chart__stage profile-builder-chart__stage--active' : 'profile-builder-chart__stage'} x={span.start / duration * CHART_WIDTH} y="0" width={(span.end - span.start) / duration * CHART_WIDTH} height={CHART_HEIGHT - CHART_BOTTOM} />)}
      <path className="profile-builder-chart__line profile-builder-chart__line--pressure" d={pathFor(points, 'pressure', 12, duration)} />
      <path className="profile-builder-chart__line profile-builder-chart__line--flow" d={pathFor(points, 'flow', 6, duration)} />
      {spans.map((span, index) => <text key={`${draft.stages[index].id}-label`} x={(span.start + span.end) / 2 / duration * CHART_WIDTH} y={CHART_HEIGHT - 8} textAnchor="middle">{index + 1}</text>)}
    </svg>
  </section>
}

const numeric = (value: string, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function ProfileBuilderScreen({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState(createDefaultProfileDraft)
  const [activeStage, setActiveStage] = useState(0)
  const [saved, setSaved] = useState(false)
  const stage = draft.stages[activeStage]
  const totalDuration = useMemo(() => draft.stages.reduce((total, item) => total + item.seconds, 0), [draft.stages])

  const updateDraft = <Key extends keyof ProfileDraft>(key: Key, value: ProfileDraft[Key]) => {
    setSaved(false)
    setDraft((current) => ({ ...current, [key]: value }))
  }
  const updateStage = (patch: Partial<BuilderStage>) => {
    setSaved(false)
    setDraft((current) => ({ ...current, stages: current.stages.map((item, index) => index === activeStage ? { ...item, ...patch } : item) }))
  }
  const addStage = () => {
    setDraft((current) => ({ ...current, stages: [...current.stages, nextBuilderStage(current.stages.length)] }))
    setActiveStage(draft.stages.length)
    setSaved(false)
  }
  const duplicateStage = () => {
    const copy = { ...stage, id: `stage-${Date.now()}`, name: `${stage.name} copy`, exit: stage.exit ? { ...stage.exit } : undefined, limiter: stage.limiter ? { ...stage.limiter } : undefined }
    setDraft((current) => ({ ...current, stages: [...current.stages.slice(0, activeStage + 1), copy, ...current.stages.slice(activeStage + 1)] }))
    setActiveStage(activeStage + 1)
    setSaved(false)
  }

  return <main className="profile-builder-screen profile-builder-screen--monitor-layout">
    <header className="profile-builder-header profile-builder-header--monitor">
      <div className="profile-builder-header__title"><button type="button" onClick={onClose} aria-label="Back to profiles"><img src={profilesBackIcon} alt="" /></button><div><span>Profile builder <small>Prototype</small></span><input aria-label="Profile name" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} /></div></div>
      <div className="profile-builder-header__summary" aria-label="Profile summary"><div><span>Stages</span><strong>{draft.stages.length}</strong></div><i /><div><span>Duration</span><strong>{totalDuration}<small>s</small></strong></div><i /><div><span>Yield</span><strong>{draft.targetWeight ?? '—'}<small>g</small></strong></div></div>
      <div className="profile-builder-header__actions"><span>{saved ? 'Draft saved locally' : 'Prototype only — nothing is uploaded'}</span><button className="profile-builder-save" type="button" onClick={() => setSaved(true)}>Save draft</button></div>
    </header>

    <section className="profile-builder-chart-panel"><BuilderChart draft={draft} activeStage={activeStage} /></section>

    <section className="profile-builder-stage-workspace">
      <header><div><h2>Brew stages</h2><span>Select a stage to edit how it behaves</span></div><button className="profile-builder-add-stage" type="button" onClick={addStage}>＋ Add stage</button></header>
      <div className="profile-builder-stage-strip">
        {draft.stages.map((item, index) => <button className={activeStage === index ? 'profile-builder-stage-card profile-builder-stage-card--active' : 'profile-builder-stage-card'} type="button" key={item.id} onClick={() => setActiveStage(index)}>
          <header><span>Stage {index + 1}</span><strong>{item.seconds}<small>s</small></strong></header>
          <h3>{item.name}</h3>
          <dl><div><dt>Control</dt><dd>{item.target}<small>{item.pump === 'pressure' ? ' bar' : ' ml/s'}</small></dd></div><div><dt>Temperature</dt><dd>{item.temperature}<small>°C</small></dd></div><div><dt>Advance when</dt><dd>{stageConstraintLabel(item)}</dd></div><div><dt>Guardrail</dt><dd>{item.limiter ? `${item.limiter.type} ≤ ${item.limiter.value}` : 'None'}</dd></div></dl>
        </button>)}
      </div>

      <section className="profile-builder-canvas profile-builder-canvas--editor">
        <div className="profile-builder-stage-editor">
          <header><div><span>Stage {activeStage + 1} of {draft.stages.length}</span><input aria-label="Stage name" value={stage.name} onChange={(event) => updateStage({ name: event.target.value })} /></div><button type="button" onClick={duplicateStage}>Duplicate</button></header>
          <div className="profile-builder-editor-grid">
            <section className="profile-builder-editor-card">
              <div className="profile-builder-card-heading"><span>Control</span><small>What the machine holds</small></div>
              <div className="profile-builder-segmented" role="group" aria-label="Controlled axis"><button className={stage.pump === 'pressure' ? 'is-active' : ''} type="button" onClick={() => updateStage({ pump: 'pressure', target: stage.pump === 'pressure' ? stage.target : 9, limiter: stage.limiter ? { ...stage.limiter, type: 'flow' } : undefined })}>Pressure</button><button className={stage.pump === 'flow' ? 'is-active' : ''} type="button" onClick={() => updateStage({ pump: 'flow', target: stage.pump === 'flow' ? stage.target : 3, limiter: stage.limiter ? { ...stage.limiter, type: 'pressure' } : undefined })}>Flow</button></div>
              <div className="profile-builder-value-row"><label><span>Target</span><div><input type="number" step="0.1" value={stage.target} onChange={(event) => updateStage({ target: numeric(event.target.value, 0) })} /><small>{stage.pump === 'pressure' ? 'bar' : 'ml/s'}</small></div></label><label><span>Transition</span><select value={stage.transition} onChange={(event) => updateStage({ transition: event.target.value as BuilderStage['transition'] })}><option value="fast">Fast</option><option value="smooth">Smooth</option></select></label></div>
            </section>

            <section className="profile-builder-editor-card">
              <div className="profile-builder-card-heading"><span>Temperature</span><small>Target and sensor</small></div>
              <div className="profile-builder-value-row"><label><span>Target</span><div><input type="number" step="0.5" value={stage.temperature} onChange={(event) => updateStage({ temperature: numeric(event.target.value, 0) })} /><small>°C</small></div></label><label><span>Sensor</span><select value={stage.sensor} onChange={(event) => updateStage({ sensor: event.target.value as BuilderStage['sensor'] })}><option value="coffee">Coffee</option><option value="water">Water</option></select></label></div>
            </section>

            <section className="profile-builder-editor-card profile-builder-editor-card--wide">
              <div className="profile-builder-card-heading"><span>Advance this stage</span><small>The first satisfied condition moves to the next stage</small></div>
              <div className="profile-builder-advance-grid">
                <label className="profile-builder-condition profile-builder-condition--always"><span><b>Time limit</b><small>Always active</small></span><div><input type="number" value={stage.seconds} onChange={(event) => updateStage({ seconds: numeric(event.target.value, 1) })} /><small>sec</small></div></label>
                <button className={stage.exit ? 'profile-builder-condition is-active' : 'profile-builder-condition'} type="button" onClick={() => updateStage({ exit: stage.exit ? undefined : { type: stage.pump === 'flow' ? 'pressure' : 'flow', condition: 'over', value: stage.pump === 'flow' ? 4 : 2.5 } })}><span><b>Sensor threshold</b><small>{stage.exit ? `${stage.exit.type} ${stage.exit.condition === 'over' ? 'rises above' : 'falls below'} ${stage.exit.value}` : 'Not used'}</small></span><i>{stage.exit ? 'On' : 'Off'}</i></button>
                <button className={stage.weight ? 'profile-builder-condition is-active' : 'profile-builder-condition'} type="button" onClick={() => updateStage({ weight: stage.weight ? undefined : 8 })}><span><b>Scale weight</b><small>{stage.weight ? `${stage.weight}g · advances this stage only` : 'Requires a connected scale'}</small></span><i>{stage.weight ? 'On' : 'Off'}</i></button>
              </div>
              <p>Scale weight advances this stage only. The final yield is configured separately as the Whole-shot stop.</p>
            </section>

            <section className="profile-builder-editor-card">
              <div className="profile-builder-card-heading"><span>Guardrail</span><small>Cap the opposite axis</small></div>
              <button className={stage.limiter ? 'profile-builder-toggle-row is-active' : 'profile-builder-toggle-row'} type="button" onClick={() => updateStage({ limiter: stage.limiter ? undefined : { type: stage.pump === 'pressure' ? 'flow' : 'pressure', value: stage.pump === 'pressure' ? 2.5 : 6, range: 0.4 } })}><span>{stage.limiter ? `Limit ${stage.limiter.type} to ${stage.limiter.value}` : `Add ${stage.pump === 'pressure' ? 'flow' : 'pressure'} limit`}</span><i>{stage.limiter ? 'On' : 'Off'}</i></button>
            </section>

            <section className="profile-builder-editor-card">
              <div className="profile-builder-card-heading"><span>Whole-shot stop</span><small>Separate from stage exits</small></div>
              <div className="profile-builder-whole-shot"><div><span>Stop at weight</span><strong>{draft.targetWeight ?? 'Off'}{draft.targetWeight !== undefined && <small>g</small>}</strong></div><div><span>Volume fallback</span><strong>{draft.targetVolume ?? 'Off'}{draft.targetVolume !== undefined && <small>ml</small>}</strong></div></div>
            </section>
          </div>
          <footer><span>{stageConstraintLabel(stage)}</span><span>Firmware: target, transition, temperature, duration and sensor exit · Decaid: scale exits and final yield</span></footer>
        </div>
      </section>
    </section>
  </main>
}
