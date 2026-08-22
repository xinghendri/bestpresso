import { useEffect, useRef, useState } from 'react'
import { applyWorkflow, favoriteProfiles, profileRecordsToDomain, shotToDomain, STEAM_HEATER_READY_C, tankMillilitres, tankSensorLevelForMillilitres } from '../../api/decaid/adapters'
import { getDevices, getDisplayState, getFavoriteAssignments, getLatestShot, getProfiles, getWorkflow, scanForDevices, setDisplayBrightness, setMachineState, setSharedSetting, updateProfileMetadata, updateWorkflow } from '../../api/decaid/client'
import { readinessFromSnapshot, readinessTemperatureSample } from '../../api/decaid/readiness'
import { subscribe } from '../../api/decaid/socket'
import type { DecaidProfileRecord, FavoriteAssignments, MachineSnapshot, ScaleSnapshot, TimeToReadyFrame, WaterLevels } from '../../api/decaid/types'
import { WATER_TANK_LOW_LEVEL_ML, WATER_TANK_SENSOR_FULL_MM, WATER_TANK_WARNING_OFFSET_CLICKS } from '../../domain/brewing'
import type { BrewingScreenModel, DataConnection, EditableMachineSetting, EditableProfileSetting, LiveBrewState, LiveShotPoint, MachineReadiness, PreviousShotStatus, ScaleConnection, SettingFeedback } from '../../domain/brewing'
import { brewingFixture } from '../../fixtures/brewingFixture'

const POWER_CHECK_DELAY_MS = 10_000
const POWER_CHECK_MIN_TARGET_GAP_C = 1
const POWER_CHECK_MIN_RISE_C = 0.3
const READY_CONFIRMATION_MS = 500
const HEATING_CONFIRMATION_MS = 2_000
const MAX_LIVE_SHOT_POINTS = 900
const MIN_SUCCESSFUL_SHOT_MS = 5_000

interface LiveShotSession {
  startedAt: number
  profileName: string
  targetYield: number
  points: LiveShotPoint[]
}

const snapshotTime = (timestamp?: string) => {
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Date.now()
}

export function useBrewingData() {
  const [model, setModel] = useState<BrewingScreenModel>({ ...brewingFixture, previousShot: null })
  const [allProfiles, setAllProfiles] = useState(brewingFixture.profiles)
  const [favoriteProfileIds, setFavoriteProfileIds] = useState(brewingFixture.profiles.slice(0, 5).map((profile) => profile.id))
  const [heatingSeconds, setHeatingSeconds] = useState<number | null>(null)
  const [connection, setConnection] = useState<DataConnection>('connecting')
  const [machineConnection, setMachineConnection] = useState<DataConnection>('connecting')
  const [scale, setScale] = useState<ScaleConnection>({ status: 'disconnected' })
  const [sleepPending, setSleepPending] = useState(false)
  const [sleepScreenActive, setSleepScreenActive] = useState(false)
  const [machineActionError, setMachineActionError] = useState<string | null>(null)
  const [settingFeedback, setSettingFeedback] = useState<SettingFeedback | null>(null)
  const [settingFeedbackVisible, setSettingFeedbackVisible] = useState(false)
  const [previousShotStatus, setPreviousShotStatus] = useState<PreviousShotStatus>('loading')
  const [liveBrew, setLiveBrew] = useState<LiveBrewState>({ active: false, visible: false, elapsedMs: 0, points: [] })
  const sleepRequestInFlight = useRef(false)
  const wakeScreenDismissed = useRef(false)
  const previousReadiness = useRef<MachineReadiness | null>(null)
  const readinessTransition = useRef<{ candidate: 'ready' | 'heating'; startedAt: number } | null>(null)
  const heatingProgress = useRef<{ startedAt: number; baseline: number; lowest: number; sensor: 'mix' | 'group'; target: number; flagged: boolean } | null>(null)
  const displayDimmed = useRef(false)
  const brightnessBeforeSleep = useRef<number | null>(null)
  const profileRecords = useRef<DecaidProfileRecord[]>([])
  const favoriteAssignments = useRef<FavoriteAssignments | null>(null)
  const feedbackTimeout = useRef<number | null>(null)
  const actionErrorTimeout = useRef<number | null>(null)
  const scaleSearchTimeout = useRef<number | null>(null)
  const latestScaleSnapshot = useRef<Pick<LiveShotPoint, 'weight' | 'weightFlow'>>({})
  const latestTankVolume = useRef<number | null>(null)
  const machineNeedsWater = useRef(false)
  const machineConnectionRef = useRef<DataConnection>('connecting')
  const liveShotSession = useRef<LiveShotSession | null>(null)
  const latestModel = useRef(model)

  useEffect(() => { latestModel.current = model }, [model])

  const dimDisplay = async () => {
    if (displayDimmed.current) return
    displayDimmed.current = true
    try {
      const display = await getDisplayState()
      if (typeof display.requestedBrightness === 'number' && display.requestedBrightness > 0) brightnessBeforeSleep.current = display.requestedBrightness
    } catch { /* brightness capture is optional */ }
    try { await setDisplayBrightness(0) }
    catch { displayDimmed.current = false }
  }

  const restoreDisplay = async () => {
    const brightness = brightnessBeforeSleep.current ?? 100
    try {
      await setDisplayBrightness(brightness)
      brightnessBeforeSleep.current = null
    } catch { /* waking the machine remains the priority */ }
    displayDimmed.current = false
  }

  const showMachineActionError = (message: string | null) => {
    if (actionErrorTimeout.current !== null) window.clearTimeout(actionErrorTimeout.current)
    actionErrorTimeout.current = null
    setMachineActionError(message)
    if (message) actionErrorTimeout.current = window.setTimeout(() => {
      setMachineActionError(null)
      actionErrorTimeout.current = null
    }, 5000)
  }

  const stabilizedReadiness = (candidate: MachineReadiness) => {
    const previous = previousReadiness.current
    const previousThermalState = previous === 'notHeating' ? 'heating' : previous
    const isThermalTransition = (candidate === 'ready' || candidate === 'heating') && (previousThermalState === 'ready' || previousThermalState === 'heating')
    if (!previous || !isThermalTransition || candidate === previousThermalState) {
      readinessTransition.current = null
      return candidate
    }

    const now = Date.now()
    const transition = readinessTransition.current
    if (!transition || transition.candidate !== candidate) {
      readinessTransition.current = { candidate, startedAt: now }
      return previous
    }
    const confirmationDelay = candidate === 'ready' ? READY_CONFIRMATION_MS : HEATING_CONFIRMATION_MS
    if (now - transition.startedAt < confirmationDelay) return previous
    readinessTransition.current = null
    return candidate
  }

  const readinessWithPowerCheck = (snapshot: MachineSnapshot, readiness: MachineReadiness) => {
    const sample = readinessTemperatureSample(snapshot)
    if (readiness !== 'heating' || !sample || sample.gap < POWER_CHECK_MIN_TARGET_GAP_C) {
      heatingProgress.current = null
      return readiness
    }
    const { current, sensor, target } = sample
    const now = Date.now()
    const progress = heatingProgress.current
    if (!progress || progress.sensor !== sensor || Math.abs(progress.target - target) >= 0.1) {
      heatingProgress.current = { startedAt: now, baseline: current, lowest: current, sensor, target, flagged: false }
      return readiness
    }
    progress.lowest = Math.min(progress.lowest, current)
    if ((!progress.flagged && current >= progress.baseline + POWER_CHECK_MIN_RISE_C) || (progress.flagged && current >= progress.lowest + POWER_CHECK_MIN_RISE_C)) {
      heatingProgress.current = { startedAt: now, baseline: current, lowest: current, sensor, target, flagged: false }
      return readiness
    }
    if (now - progress.startedAt >= POWER_CHECK_DELAY_MS) progress.flagged = true
    return progress.flagged ? 'notHeating' : readiness
  }

  useEffect(() => {
    let disposed = false
    let timeToReadyEstimate: { deadline: number; receivedAt: number } | null = null
    let latestShotRefreshTimeout: number | null = null

    const updateMachineConnection = (next: DataConnection) => {
      const previous = machineConnectionRef.current
      if (previous === next) return
      machineConnectionRef.current = next
      setMachineConnection(next)
      if (next !== 'connected') {
        previousReadiness.current = null
        readinessTransition.current = null
        heatingProgress.current = null
        setHeatingSeconds(null)
        if (previous === 'connected') {
          setSleepScreenActive(false)
          void restoreDisplay()
        }
      }
    }

    const applyConnectedDevices = (devices: Awaited<ReturnType<typeof getDevices>>) => {
      const connectedMachine = devices.find((device) => device.type === 'machine' && device.state === 'connected')
      const connectedScale = devices.find((device) => device.type === 'scale' && device.state === 'connected')
      updateMachineConnection(connectedMachine ? 'connected' : 'disconnected')
      setScale((current) => current.status === 'searching'
        ? current
        : connectedScale
          ? { status: 'connected', name: connectedScale.name || 'Scale' }
          : { status: 'disconnected' })
    }

    const refreshConnectedDevices = () => getDevices().then((devices) => {
      if (!disposed) applyConnectedDevices(devices)
      return devices
    })

    const schedulePersistedShotRefresh = (session: LiveShotSession, attempt = 0) => {
      if (latestShotRefreshTimeout !== null) window.clearTimeout(latestShotRefreshTimeout)
      latestShotRefreshTimeout = window.setTimeout(() => {
        getLatestShot().then((shot) => {
          if (disposed) return
          const timestamp = shot?.timestamp ? Date.parse(shot.timestamp) : Number.NaN
          const isCompletedSession = shot && (!Number.isFinite(timestamp) || timestamp >= session.startedAt - 2_000)
          if (isCompletedSession) {
            setModel((current) => ({ ...current, previousShot: shotToDomain(shot) }))
            setPreviousShotStatus('loaded')
          } else if (attempt < 2) schedulePersistedShotRefresh(session, attempt + 1)
        }).catch(() => { if (!disposed && attempt < 2) schedulePersistedShotRefresh(session, attempt + 1) })
      }, 800 * (attempt + 1))
    }

    const completeLiveShot = () => {
      const session = liveShotSession.current
      if (!session) return
      liveShotSession.current = null
      const points = [...session.points]
      const elapsedMs = points.at(-1)?.elapsedMs ?? 0
      setLiveBrew({ active: false, visible: true, elapsedMs, points })

      const hasExtraction = points.some((point) => (point.pressure ?? 0) > 0.5 || (point.flow ?? 0) > 0.1)
      if (elapsedMs < MIN_SUCCESSFUL_SHOT_MS || !hasExtraction) return
      const finalWeight = [...points].reverse().find((point) => point.weight !== undefined)?.weight
      setModel((current) => ({
        ...current,
        previousShot: {
          profileName: session.profileName,
          timestamp: new Date(session.startedAt).toISOString(),
          totalYield: finalWeight === undefined ? '—' : finalWeight.toFixed(1),
          totalTime: String(Math.max(1, Math.round(elapsedMs / 1000))),
          targetYield: session.targetYield,
          points,
        },
      }))
      setPreviousShotStatus('loaded')
      schedulePersistedShotRefresh(session)
    }

    const refreshConnectedScale = () => {
      setScale((current) => ({ ...current, status: 'connected' }))
      if (scaleSearchTimeout.current !== null) window.clearTimeout(scaleSearchTimeout.current)
      scaleSearchTimeout.current = null
      refreshConnectedDevices().then((devices) => {
        if (disposed) return
        const connectedScale = devices.find((device) => device.type === 'scale' && device.state === 'connected')
        setScale({ status: 'connected', name: connectedScale?.name || 'Scale' })
      }).catch(() => undefined)
    }

    refreshConnectedDevices().catch(() => undefined)

    const latestShotRequest = getLatestShot()
      .then((shot) => ({ shot, failed: false }))
      .catch(() => ({ shot: null, failed: true }))

    Promise.all([getWorkflow(), getProfiles(), getFavoriteAssignments().catch(() => null), latestShotRequest])
      .then(([workflow, records, assignments, latestShot]) => {
        if (disposed) return
        profileRecords.current = records
        favoriteAssignments.current = assignments
        const domainProfiles = profileRecordsToDomain(records, workflow, brewingFixture.profiles)
        const favorites = favoriteProfiles(domainProfiles, assignments)
        setAllProfiles(domainProfiles)
        setFavoriteProfileIds(favorites.map((profile) => profile.id))
        setModel((current) => ({ ...applyWorkflow(current, workflow, records, assignments), previousShot: latestShot.shot ? shotToDomain(latestShot.shot) : null }))
        setPreviousShotStatus(latestShot.failed ? 'error' : latestShot.shot ? 'loaded' : 'empty')
        setConnection('connected')
      })
      .catch(() => {
        if (disposed) return
        setConnection('fixture')
        updateMachineConnection('fixture')
        setPreviousShotStatus('fixture')
        setModel((current) => ({ ...current, previousShot: brewingFixture.previousShot }))
      })

    const machine = subscribe<MachineSnapshot>('/machine/snapshot', (snapshot) => {
      if (machineConnectionRef.current !== 'connected') return
      const machineState = (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()
      machineNeedsWater.current = machineState === 'needswater'
      if (machineState === 'espresso') {
        const now = snapshotTime(snapshot.timestamp)
        if (!liveShotSession.current) {
          const currentModel = latestModel.current
          const profile = currentModel.profiles.find((candidate) => candidate.id === currentModel.activeProfileId) ?? currentModel.profiles[0]
          liveShotSession.current = { startedAt: now, profileName: profile?.name ?? 'Espresso', targetYield: Number(profile?.targetYield) || 36, points: [] }
        }
        const session = liveShotSession.current
        const elapsedMs = Math.max(0, now - session.startedAt)
        const lastPoint = session.points.at(-1)
        if (!lastPoint || elapsedMs > lastPoint.elapsedMs) {
          session.points.push({
            elapsedMs,
            pressure: snapshot.pressure,
            flow: snapshot.flow,
            targetPressure: snapshot.targetPressure,
            targetFlow: snapshot.targetFlow,
            temperature: snapshot.mixTemperature ?? snapshot.groupTemperature,
            weight: latestScaleSnapshot.current.weight,
            weightFlow: latestScaleSnapshot.current.weightFlow,
          })
          if (session.points.length > MAX_LIVE_SHOT_POINTS) session.points.shift()
        }
        setLiveBrew({ active: true, visible: true, elapsedMs, points: [...session.points] })
      } else if (liveShotSession.current) {
        completeLiveShot()
      }

      const candidateReadiness = readinessFromSnapshot(snapshot, previousReadiness.current)
      const readiness = readinessWithPowerCheck(snapshot, stabilizedReadiness(candidateReadiness))
      if (readiness === 'sleeping') {
        if (previousReadiness.current !== 'sleeping') void dimDisplay()
        if (!wakeScreenDismissed.current && !sleepRequestInFlight.current) setSleepScreenActive(true)
      } else {
        if (previousReadiness.current === 'sleeping') void restoreDisplay()
        if (readiness !== 'disconnected') wakeScreenDismissed.current = false
        setSleepScreenActive(false)
      }
      previousReadiness.current = readiness
      if (readiness !== 'heating') setHeatingSeconds(null)
      setModel((current) => ({
        ...current,
        readiness,
        utilities: current.utilities.map((utility) => {
          if (utility.id === 'steam') return { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Current' && snapshot.steamTemperature !== undefined ? { ...metric, value: String(Math.round(snapshot.steamTemperature)), highlight: snapshot.steamTemperature < STEAM_HEATER_READY_C } : metric) }
          if (utility.id === 'tank') return { ...utility, alert: machineNeedsWater.current || (latestTankVolume.current !== null && latestTankVolume.current <= WATER_TANK_LOW_LEVEL_ML) }
          return utility
        }),
      }))
    }, (connected) => {
      if (!connected) {
        heatingProgress.current = null
        readinessTransition.current = null
        completeLiveShot()
      } else if (machineConnectionRef.current === 'fixture') {
        updateMachineConnection('connecting')
      }
      setConnection((current) => connected ? 'connected' : current === 'fixture' ? current : 'disconnected')
    })

    const scale = subscribe<ScaleSnapshot>('/scale/snapshot', (snapshot) => {
      if (snapshot.weight !== undefined || snapshot.weightFlow !== undefined) {
        latestScaleSnapshot.current = {
          weight: snapshot.weight ?? latestScaleSnapshot.current.weight,
          weightFlow: snapshot.weightFlow ?? latestScaleSnapshot.current.weightFlow,
        }
      }
      if (snapshot.status === 'connected') {
        refreshConnectedScale()
        return
      }
      if (snapshot.status === 'disconnected') {
        latestScaleSnapshot.current = {}
        setScale((current) => current.status === 'searching' ? current : { status: 'disconnected' })
        return
      }
      if (snapshot.weight === undefined) return
      setModel((current) => ({ ...current, utilities: current.utilities.map((utility) => utility.id === 'scale' ? { ...utility, metrics: utility.metrics.map((metric) => ({ ...metric, value: snapshot.weight!.toFixed(1) })) } : utility) }))
    }, () => undefined)

    const water = subscribe<WaterLevels>('/machine/waterLevels', (levels) => {
      if (levels.currentLevel === undefined) return
      const sensorLevel = levels.currentLevel
      const volume = tankMillilitres(sensorLevel)
      const levelPercent = Math.max(0, Math.min(100, sensorLevel / WATER_TANK_SENSOR_FULL_MM * 100))
      const calculatedRefillLevel = tankSensorLevelForMillilitres(WATER_TANK_LOW_LEVEL_ML)
      const configuredRefillLevel = typeof levels.refillLevel === 'number' && Number.isFinite(levels.refillLevel)
        ? levels.refillLevel
        : calculatedRefillLevel
      const refillLevel = Math.max(calculatedRefillLevel, configuredRefillLevel)
      const needsWater = machineNeedsWater.current || volume <= WATER_TANK_LOW_LEVEL_ML
      const warnsWater = !needsWater && sensorLevel <= refillLevel + WATER_TANK_WARNING_OFFSET_CLICKS
      latestTankVolume.current = volume
      setModel((current) => ({
        ...current,
        utilities: current.utilities.map((utility) => utility.id === 'tank' ? {
          ...utility,
          alert: needsWater,
          warning: warnsWater,
          levelPercent,
          metrics: utility.metrics.map((metric) => ({ ...metric, value: volume.toLocaleString('en-US') })),
        } : utility),
      }))
    }, () => undefined)

    const timeToReady = subscribe<TimeToReadyFrame>('/plugins/time-to-ready.reaplugin/timeToReady', (frame) => {
      if (machineConnectionRef.current !== 'connected' || frame.status !== 'heating' || !frame.remainingTimeMs || frame.remainingTimeMs <= 0) {
        timeToReadyEstimate = null
        setHeatingSeconds(null)
        return
      }
      const now = Date.now()
      timeToReadyEstimate = { deadline: now + frame.remainingTimeMs, receivedAt: now }
      setHeatingSeconds(Math.min(300, Math.round(frame.remainingTimeMs / 1000)))
    }, () => undefined)

    const heatingCountdown = window.setInterval(() => {
      if (!timeToReadyEstimate || Date.now() - timeToReadyEstimate.receivedAt > 6000) {
        timeToReadyEstimate = null
        setHeatingSeconds(null)
        return
      }
      setHeatingSeconds(Math.min(300, Math.max(0, Math.round((timeToReadyEstimate.deadline - Date.now()) / 1000))))
    }, 1000)

    const refreshWorkflow = window.setInterval(() => {
      getWorkflow().then((workflow) => { if (!disposed) setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current)) }).catch(() => undefined)
    }, 15000)

    const refreshDeviceConnections = window.setInterval(() => {
      refreshConnectedDevices().catch(() => undefined)
    }, 3000)

    return () => {
      disposed = true
      window.clearInterval(refreshWorkflow)
      window.clearInterval(refreshDeviceConnections)
      window.clearInterval(heatingCountdown)
      if (latestShotRefreshTimeout !== null) window.clearTimeout(latestShotRefreshTimeout)
      if (feedbackTimeout.current !== null) window.clearTimeout(feedbackTimeout.current)
      if (actionErrorTimeout.current !== null) window.clearTimeout(actionErrorTimeout.current)
      if (scaleSearchTimeout.current !== null) window.clearTimeout(scaleSearchTimeout.current)
      machine.close(); scale.close(); water.close(); timeToReady.close()
    }
  }, [])

  const toggleSleep = async () => {
    if (sleepRequestInFlight.current) return
    if (connection !== 'connected' || machineConnection !== 'connected') {
      if (model.readiness === 'sleeping') {
        wakeScreenDismissed.current = true
        setSleepScreenActive(false)
        void restoreDisplay()
        showMachineActionError('The sleep screen was dismissed, but the disconnected machine could not be woken.')
      } else {
        showMachineActionError('Connect to a Decaid gateway before controlling the machine.')
      }
      return
    }

    sleepRequestInFlight.current = true
    setSleepPending(true)
    showMachineActionError(null)
    try {
      if (model.readiness === 'sleeping') {
        wakeScreenDismissed.current = true
        setSleepScreenActive(false)
        void restoreDisplay()
        await setMachineState('idle')
      } else {
        await setMachineState('sleeping')
        setSleepScreenActive(true)
        void dimDisplay()
      }
    } catch {
      if (model.readiness === 'sleeping') {
        wakeScreenDismissed.current = true
        setSleepScreenActive(false)
        void restoreDisplay()
      } else {
        setSleepScreenActive(false)
        void restoreDisplay()
      }
      showMachineActionError('The machine did not accept the sleep command.')
    } finally {
      sleepRequestInFlight.current = false
      setSleepPending(false)
    }
  }

  const wakeMachine = async () => {
    if (sleepRequestInFlight.current) return
    sleepRequestInFlight.current = true
    wakeScreenDismissed.current = true
    setSleepScreenActive(false)
    setSleepPending(true)
    showMachineActionError(null)
    const restorePromise = restoreDisplay()
    if (connection !== 'connected' || machineConnection !== 'connected') {
      await restorePromise
      sleepRequestInFlight.current = false
      setSleepPending(false)
      showMachineActionError('The sleep screen was dismissed, but the disconnected machine could not be woken.')
      return
    }
    try {
      await setMachineState('idle')
      await restorePromise
    } catch {
      await restorePromise
      showMachineActionError('The machine did not accept the wake command.')
    } finally {
      sleepRequestInFlight.current = false
      setSleepPending(false)
    }
  }

  const searchForScale = async () => {
    showMachineActionError(null)
    setScale((current) => ({ ...current, status: 'searching' }))
    if (scaleSearchTimeout.current !== null) window.clearTimeout(scaleSearchTimeout.current)
    scaleSearchTimeout.current = window.setTimeout(() => {
      setScale((current) => current.status === 'searching' ? { status: 'disconnected' } : current)
      scaleSearchTimeout.current = null
    }, 20000)
    try {
      await scanForDevices()
    } catch {
      if (scaleSearchTimeout.current !== null) window.clearTimeout(scaleSearchTimeout.current)
      scaleSearchTimeout.current = null
      setScale({ status: 'disconnected' })
      showMachineActionError('Decaid could not start a scale search.')
    }
  }

  const showSettingFeedback = (feedback: SettingFeedback) => {
    if (feedbackTimeout.current !== null) window.clearTimeout(feedbackTimeout.current)
    setSettingFeedback(feedback)
    setSettingFeedbackVisible(true)
    feedbackTimeout.current = window.setTimeout(() => {
      setSettingFeedbackVisible(false)
      feedbackTimeout.current = null
    }, 5000)
  }

  const updateMachineSetting = async (setting: EditableMachineSetting, value: number) => {
    if (connection !== 'connected') {
      showSettingFeedback({ status: 'error', message: 'Connect to Decaid before changing machine settings.' })
      return
    }
    const settings = {
      hotWaterVolume: { label: 'Hot water yield', patch: { hotWaterData: { volume: value } }, sharedKey: 'last-hot-water-volume' },
      hotWaterTemperature: { label: 'Hot water temperature', patch: { hotWaterData: { targetTemperature: value } }, sharedKey: 'last-hot-water-temp' },
      steamTemperature: { label: 'Steam temperature', patch: { steamSettings: { targetTemperature: value } } },
      steamDuration: { label: 'Steam maximum time', patch: { steamSettings: { duration: value } }, sharedKey: 'last-steam-duration' },
      steamFlow: { label: 'Steam flow', patch: { steamSettings: { flow: value } }, sharedKey: 'last-steam-flow' },
    } as const
    const update = settings[setting]
    showSettingFeedback({ status: 'saving', message: `Saving ${update.label}…` })
    try {
      const workflow = await updateWorkflow(update.patch)
      setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current))
      if ('sharedKey' in update) await setSharedSetting(update.sharedKey, value)
      showSettingFeedback({ status: 'saved', message: `${update.label} saved to Decaid.` })
    } catch {
      showSettingFeedback({ status: 'error', message: `${update.label} could not be saved.` })
    }
  }

  const updateProfileSetting = async (profileId: string, setting: EditableProfileSetting, value: number) => {
    if (connection !== 'connected') {
      showSettingFeedback({ status: 'error', message: 'Connect to Decaid before changing profile settings.' })
      return
    }
    const record = profileRecords.current.find((candidate) => candidate.id === profileId)
    const currentProfile = allProfiles.find((profile) => profile.id === profileId)
    if (!record?.profile?.steps?.length || !currentProfile) {
      showSettingFeedback({ status: 'error', message: 'This profile is not available for editing.' })
      return
    }
    const nextProfile = { ...currentProfile, [setting]: String(value) }
    const temperature = Number(nextProfile.temperature)
    const dose = Number(nextProfile.dose)
    const targetYield = Number(nextProfile.targetYield)
    const grinderSetting = String(nextProfile.grindSetting)
    const workflowProfile = {
      ...record.profile,
      target_weight: targetYield,
      steps: record.profile.steps.map((step) => ({ ...step, temperature })),
    }
    const metadata = {
      ...(record.metadata ?? {}),
      temperature,
      grinderSetting,
      targetDoseWeight: dose,
      targetYield,
    }
    showSettingFeedback({ status: 'saving', message: `Saving ${currentProfile.name}…` })
    let workflow
    try {
      workflow = await updateWorkflow({
        profile: workflowProfile,
        context: { grinderSetting, targetDoseWeight: dose, targetYield },
      })
      setModel((current) => applyWorkflow(current, workflow!, profileRecords.current, favoriteAssignments.current))
    } catch {
      showSettingFeedback({ status: 'error', message: `${currentProfile.name} could not be applied to Decaid.` })
      return
    }
    try {
      const savedRecord = await updateProfileMetadata(profileId, metadata)
      profileRecords.current = profileRecords.current.map((candidate) => candidate.id === profileId ? savedRecord : candidate)
      const domainProfiles = profileRecordsToDomain(profileRecords.current, workflow, brewingFixture.profiles)
      const favorites = favoriteProfiles(domainProfiles, favoriteAssignments.current)
      setAllProfiles(domainProfiles)
      setFavoriteProfileIds(favorites.map((profile) => profile.id))
      setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current))
      showSettingFeedback({ status: 'saved', message: `${currentProfile.name} saved and applied.` })
    } catch {
      showSettingFeedback({ status: 'error', message: `${currentProfile.name} was applied, but its saved defaults could not be recorded.` })
    }
  }

  const settingsDisabled = connection !== 'connected' || settingFeedback?.status === 'saving'
  const dismissLiveBrew = () => setLiveBrew((current) => current.active ? current : { ...current, visible: false })

  return { model, allProfiles, favoriteProfileIds, liveBrew, previousShotStatus, heatingSeconds, connection, machineConnection, scale, sleepPending, sleepScreenActive, machineActionError, settingFeedback: settingFeedbackVisible ? settingFeedback : null, settingsDisabled, toggleSleep, wakeMachine, dismissLiveBrew, searchForScale, updateMachineSetting, updateProfileSetting }
}
