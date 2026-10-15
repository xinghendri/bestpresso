import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useValueAdjustment } from '../../components/ValueAdjustment/ValueAdjustmentContext'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { formatDecimal, t } from '../../i18n/index.ts'
import { MIN_CALIBRATION_SECONDS, STEAM_DURATION_MAX_S, clampSteamDuration, liveSuggestion, ratePer150Ml, readMilkAssist, stableWeight, useMilkAssist, wizardAdjustCapturedSeconds, wizardCaptureJug, wizardCaptureMilk, wizardInit, wizardSteamEvent, writeMilkAssist, type LiveSuggestion, type WizardStep } from './milkAssist'

export interface MilkAssistMetricProps {
  suggestion: LiveSuggestion | null
  scaleConnected: boolean
  currentDurationSeconds: number | null
  onSet: (seconds: number) => void
  onCalibrate: () => void
  disabled?: boolean
}

/** Replaces the max duration metric while Milk Assist is enabled: tap the live suggestion to set it, tap the idle value to calibrate. */
export function MilkAssistMetric({ suggestion, scaleConnected, currentDurationSeconds, onSet, onCalibrate, disabled }: MilkAssistMetricProps) {
  const label = suggestion ? t('shell.milkAssist.steamTimeGrams', { grams: formatDecimal(suggestion.milkGrams, 1) }) : t('shell.milkAssist.steamTime')
  const ariaLabel = suggestion
    ? t('shell.milkAssist.setAria', { seconds: suggestion.seconds, grams: formatDecimal(suggestion.milkGrams, 1) })
    : t('shell.milkAssist.calibrateAria')
  return <button className={`metric metric--small metric__edit-button milk-metric${suggestion ? ' milk-metric--live' : ''}`} type="button" disabled={disabled} aria-label={ariaLabel} onClick={() => suggestion ? onSet(suggestion.seconds) : onCalibrate()}>
    <span className="metric__label">{label}<span className="metric__edit-indicator" aria-hidden="true">›</span></span>
    <span className="metric__reading">{suggestion ? suggestion.seconds : currentDurationSeconds ?? '—'}{(suggestion || currentDurationSeconds !== null) && <small>s</small>}{suggestion && scaleConnected && <svg className="milk-metric__sync" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6v5h-5M4 18v-5h5M6.1 9a7 7 0 0 1 11.6-2.6L20 8.8M4 15.2l2.3 2.4A7 7 0 0 0 17.9 15" /></svg>}</span>
  </button>
}

function MilkAssistDialog({ onClose, onAdjust, onRecalibrate }: { onClose: () => void; onAdjust: () => void; onRecalibrate: () => void }) {
  const { milkAssist } = useMilkAssist()
  const calibrated = milkAssist.calGrams !== null && milkAssist.calSeconds !== null
  return <div className="milk-dialog-backdrop" onClick={onClose}>
    <section className="milk-dialog" role="dialog" aria-modal="true" aria-labelledby="milk-dialog-title" onClick={(event) => event.stopPropagation()}>
      <h2 id="milk-dialog-title">{t('settings.prepare.milkAssist')}</h2>
      <div className="milk-dialog__row"><span>{t('shell.milkAssist.jugWeight')}</span><strong>{milkAssist.jugGrams ?? '—'}<small>g</small></strong></div>
      <div className="milk-dialog__row"><span>{t('shell.milkAssist.calibration')}</span><strong>{calibrated ? t('shell.milkAssist.pair', { grams: milkAssist.calGrams!, seconds: milkAssist.calSeconds! }) : '—'}</strong></div>
      <div className="milk-dialog__row"><span>{t('shell.milkAssist.rate')}</span><strong>{calibrated ? t('shell.milkAssist.ratePer150', { seconds: ratePer150Ml(milkAssist.calGrams!, milkAssist.calSeconds!) }) : '—'}</strong></div>
      <div className="milk-dialog__actions">
        <button type="button" onClick={onClose}>{t('shell.cleaning.close')}</button>
        <button type="button" onClick={onAdjust}>{t('shell.milkAssist.adjustTime')}</button>
        <button className="milk-dialog__primary" type="button" onClick={onRecalibrate}>{t('shell.milkAssist.recalibrate')}</button>
      </div>
    </section>
  </div>
}

interface WizardProps {
  scaleConnected: boolean
  scaleGrams: number | undefined
  steamOperationActive: boolean
  steamElapsedSeconds: number
  currentDurationSeconds: number | null
  onWriteDuration: (seconds: number) => Promise<boolean>
  onClose: () => void
}

function MilkAssistWizard({ scaleConnected, scaleGrams, steamOperationActive, steamElapsedSeconds, currentDurationSeconds, onWriteDuration, onClose }: WizardProps) {
  const openAdjustment = useValueAdjustment()
  const [state, setState] = useState<WizardStep>(() => wizardInit(readMilkAssist().jugGrams))
  const samples = useRef<{ grams: number; atMs: number }[]>([])
  const scaleGramsRef = useRef(scaleGrams)
  scaleGramsRef.current = scaleGrams
  const [, tick] = useState(0)
  // Fixed-interval sampling: an unchanging reading must still become stable.
  useEffect(() => {
    const id = window.setInterval(() => {
      const grams = scaleGramsRef.current
      if (grams === undefined) return
      samples.current = [...samples.current.filter((sample) => sample.atMs > Date.now() - 5_000), { grams, atMs: Date.now() }]
      tick((value) => value + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  // Restore record survives remounts; the safety net writes exactly once per mount, and not over an existing pending value.
  const restoreSeconds = useRef<number | null>(null)
  const wroteSafetyNet = useRef(false)
  useEffect(() => {
    restoreSeconds.current = readMilkAssist().pendingRestoreSeconds
  }, [])
  useEffect(() => {
    if (state.step !== 'steam' || state.phase !== 'waiting' || wroteSafetyNet.current) return
    // Arm only once there is a known duration to restore; otherwise 120 s could never be undone.
    if (restoreSeconds.current === null) {
      if (currentDurationSeconds === null) return
      restoreSeconds.current = currentDurationSeconds
      writeMilkAssist({ pendingRestoreSeconds: currentDurationSeconds })
    }
    wroteSafetyNet.current = true
    void onWriteDuration(STEAM_DURATION_MAX_S)
  }, [state, currentDurationSeconds, onWriteDuration])
  useEffect(() => {
    if (state.step !== 'steam') return
    if (steamOperationActive) setState((current) => wizardSteamEvent(wizardSteamEvent(current, { kind: 'started' }), { kind: 'tick', elapsedSeconds: steamElapsedSeconds }))
    else setState((current) => wizardSteamEvent(current, { kind: 'ended' }))
  }, [state.step, steamOperationActive, steamElapsedSeconds])

  // A failed write keeps pendingRestoreSeconds so the next launch can still restore the original duration.
  const cancel = async () => {
    const restore = restoreSeconds.current
    if (restore === null || await onWriteDuration(restore)) writeMilkAssist({ pendingRestoreSeconds: null })
    onClose()
  }
  const save = async () => {
    if (state.step !== 'steam' || state.phase !== 'captured') return
    writeMilkAssist({ jugGrams: state.jugGrams, calGrams: state.milkGrams, calSeconds: state.elapsedSeconds })
    if (await onWriteDuration(clampSteamDuration(state.elapsedSeconds))) writeMilkAssist({ pendingRestoreSeconds: null })
    onClose()
  }

  const stable = stableWeight(samples.current, Date.now())
  const stepNumber = state.step === 'jug' ? 1 : state.step === 'milk' ? 2 : 3
  const stabilityChip = <span className={`milk-wizard__stability${stable !== null ? ' is-stable' : ''}`}>{stable !== null ? t('shell.milkAssist.stable') : t('shell.milkAssist.settling')}</span>

  return <div className="milk-wizard" role="dialog" aria-modal="true" aria-labelledby="milk-wizard-title">
    <header className="milk-wizard__head">
      <span className="milk-wizard__step">{t('shell.milkAssist.wizardStep', { step: stepNumber })}</span>
      <button className="milk-wizard__cancel" type="button" onClick={cancel}>{t('shell.adjust.cancel')}</button>
    </header>
    {state.step === 'jug' && <div className="milk-wizard__body">
      <h2 id="milk-wizard-title">{t('shell.milkAssist.jugTitle')}</h2>
      <p>{t('shell.milkAssist.jugInstruction')}</p>
      <div className="milk-wizard__value">{scaleGrams !== undefined ? Math.round(scaleGrams) : '—'}<small>g</small></div>
      {scaleConnected ? stabilityChip : <p className="milk-wizard__error">{t('shell.milkAssist.scaleLost')}</p>}
      <div className="milk-wizard__actions">
        {state.savedJugGrams !== null && <button className="milk-wizard__secondary" type="button" onClick={() => setState(wizardCaptureJug(state.savedJugGrams!))}>{t('shell.milkAssist.useSaved', { grams: state.savedJugGrams })}</button>}
        <button className="milk-wizard__primary" type="button" disabled={!scaleConnected || stable === null || stable <= 0} onClick={() => setState(wizardCaptureJug(stable!))}>{t('shell.milkAssist.capture', { grams: stable ?? '—' })}</button>
      </div>
    </div>}
    {state.step === 'milk' && <div className="milk-wizard__body">
      <h2 id="milk-wizard-title">{t('shell.milkAssist.milkTitle')}</h2>
      <p>{t('shell.milkAssist.milkInstruction')}</p>
      <div className="milk-wizard__value">{scaleGrams !== undefined ? Math.max(0, Math.round(scaleGrams) - state.jugGrams) : '—'}<small>g</small></div>
      {scaleConnected ? stabilityChip : <p className="milk-wizard__error">{t('shell.milkAssist.scaleLost')}</p>}
      <button className="milk-wizard__primary" type="button" disabled={!scaleConnected || stable === null || stable <= state.jugGrams} onClick={() => setState((current) => wizardCaptureMilk(current, stable!))}>{t('shell.milkAssist.capture', { grams: stable !== null ? Math.max(0, stable - state.jugGrams) : '—' })}</button>
    </div>}
    {state.step === 'steam' && <div className="milk-wizard__body">
      <h2 id="milk-wizard-title">{state.phase === 'captured' ? t('shell.milkAssist.captured') : t('shell.milkAssist.steamTitle')}</h2>
      {state.phase === 'waiting' && <><p>{t('shell.milkAssist.steamInstruction')}</p><span className="milk-wizard__stability">{t('shell.milkAssist.steamWaiting')}</span></>}
      {state.phase === 'running' && <div className="milk-wizard__value milk-wizard__value--active">{state.elapsedSeconds.toFixed(1)} <em>/</em> {STEAM_DURATION_MAX_S}<small>s</small></div>}
      {state.phase === 'captured' && <button className="milk-wizard__value milk-wizard__value--editable" type="button" aria-label={t('shell.milkAssist.adjustTime')} onClick={() => openAdjustment({ label: t('shell.milkAssist.adjustTime'), value: state.elapsedSeconds, unit: 's', min: MIN_CALIBRATION_SECONDS, max: STEAM_DURATION_MAX_S, step: 1, mode: 'integer', suggestionKey: 'steamDuration', onSave: (seconds) => setState((current) => wizardAdjustCapturedSeconds(current, seconds)) })}>{t('shell.milkAssist.pair', { grams: state.milkGrams, seconds: state.elapsedSeconds })}<span className="metric__edit-indicator" aria-hidden="true">›</span></button>}
      {state.phase === 'tooShort' && <p className="milk-wizard__error">{t('shell.milkAssist.tooShort')}</p>}
      {state.phase === 'reachedMax' && <p className="milk-wizard__error">{t('shell.milkAssist.reachedMax')}</p>}
      <div className="milk-wizard__actions">
        {(state.phase === 'captured' || state.phase === 'tooShort' || state.phase === 'reachedMax') && <button className="milk-wizard__secondary" type="button" onClick={() => setState({ ...state, phase: 'waiting', elapsedSeconds: 0 })}>{t('shell.milkAssist.tryAgain')}</button>}
        <button className="milk-wizard__primary" type="button" disabled={state.phase !== 'captured'} onClick={save}>{t('shell.milkAssist.saveCalibration')}</button>
      </div>
    </div>}
    <footer className="milk-wizard__dots" aria-hidden="true">{[1, 2, 3].map((dot) => <i key={dot} className={dot === stepNumber ? 'is-on' : ''} />)}</footer>
  </div>
}

export interface MilkAssistFeatureInput {
  scaleConnected: boolean
  scaleGrams: number | undefined
  currentDurationSeconds: number | null
  steamOperationActive: boolean
  steamElapsedSeconds: number
  settingsDisabled: boolean
  updateSetting: (setting: 'steamDuration', value: number) => Promise<boolean>
}

// Dev-only, like the demoShot flag: ?milkScale=<grams> simulates a connected scale with that reading (0 is an empty scale).
const simulatedScaleGrams = (() => {
  if (!import.meta.env.DEV) return null
  const value = new URLSearchParams(window.location.search).get('milkScale')
  const grams = value === null ? Number.NaN : Number(value)
  return Number.isFinite(grams) && grams >= 0 ? grams : null
})()

/** Everything the shell needs: the steam card metric props (or undefined while disabled) and the mounted overlays. */
export function useMilkAssistFeature({ scaleConnected, scaleGrams, currentDurationSeconds, steamOperationActive, steamElapsedSeconds, settingsDisabled, updateSetting }: MilkAssistFeatureInput): { metric: MilkAssistMetricProps | undefined; overlays: ReactNode } {
  const { milkAssist } = useMilkAssist()
  const openAdjustment = useValueAdjustment()
  const [surface, setSurface] = useState<'none' | 'dialog' | 'wizard'>('none')
  // A real connected scale always wins over the simulated one.
  const simulated = scaleConnected ? null : simulatedScaleGrams
  const effectiveScaleConnected = scaleConnected || simulated !== null
  const effectiveScaleGrams = scaleConnected ? scaleGrams : simulated ?? undefined
  // The simulation seeds a starter calibration once, into the real store, so the suggestion and the dialog choice agree.
  useEffect(() => {
    if (simulatedScaleGrams === null) return
    const stored = readMilkAssist()
    if (stored.jugGrams === null || stored.calGrams === null || stored.calSeconds === null) {
      writeMilkAssist({ jugGrams: stored.jugGrams ?? 412, calGrams: stored.calGrams ?? 214, calSeconds: stored.calSeconds ?? 24 })
    }
  }, [])

  // Crash recovery: once per launch, when the machine is writable, restore an interrupted wizard's duration.
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current || settingsDisabled) return
    restoredRef.current = true
    const pending = readMilkAssist().pendingRestoreSeconds
    if (pending === null) return
    void updateSetting('steamDuration', pending).then((saved) => { if (saved) writeMilkAssist({ pendingRestoreSeconds: null }) })
  }, [settingsDisabled, updateSetting])

  if (!milkAssist.enabled) return { metric: undefined, overlays: null }
  const suggestion = liveSuggestion({ scaleConnected: effectiveScaleConnected, scaleGrams: effectiveScaleGrams, jugGrams: milkAssist.jugGrams, calGrams: milkAssist.calGrams, calSeconds: milkAssist.calSeconds })
  const metric: MilkAssistMetricProps = {
    suggestion,
    scaleConnected: effectiveScaleConnected,
    currentDurationSeconds,
    disabled: settingsDisabled,
    onSet: (seconds) => updateSetting('steamDuration', seconds),
    onCalibrate: () => setSurface(milkAssist.calGrams === null || milkAssist.jugGrams === null ? 'wizard' : 'dialog'),
  }
  const overlays = <>
    {surface === 'dialog' && <MilkAssistDialog
      onClose={() => setSurface('none')}
      onAdjust={() => { setSurface('none'); const d = VALUE_ADJUSTMENTS.steamDuration; openAdjustment({ label: d.title, value: currentDurationSeconds ?? 60, unit: 's', min: d.min, max: d.max, step: d.step, mode: d.mode, suggestionKey: 'steamDuration', presets: d.suggestions, onSave: (seconds) => updateSetting('steamDuration', seconds) }) }}
      onRecalibrate={() => setSurface('wizard')} />}
    {surface === 'wizard' && <MilkAssistWizard
      scaleConnected={effectiveScaleConnected} scaleGrams={effectiveScaleGrams}
      steamOperationActive={steamOperationActive} steamElapsedSeconds={steamElapsedSeconds}
      currentDurationSeconds={currentDurationSeconds}
      onWriteDuration={(seconds) => updateSetting('steamDuration', seconds)}
      onClose={() => setSurface('none')} />}
  </>
  return { metric, overlays }
}
