import { useEffect, useRef, useState } from 'react'
import { activeProfileForWorkflow, applyWorkflow, carouselProfiles, favoriteProfileSlots as resolveFavoriteProfileSlots, isEspressoExtractionSnapshot, profileRecordsToDomain, profilesWithParsedTitles, retainedAdHocProfileAtBrewStart, shotStage, shotToDomain, STEAM_HEATER_READY_C, tankMillilitres, tankSensorLevelForMillilitres } from '../../api/decaid/adapters'
import { connectDevice, DecaidApiError, getDevices, getDisplayState, getFavoriteAssignments, getLatestShot, getProfiles, getSettings, getShot, getShotHistory, getWorkflow, scanForDevices, setDisplayBrightness, setMachineProfile, setMachineState, setSharedSetting, tareScale, updateProfileMetadata, updateWorkflow } from '../../api/decaid/client'
import { createMachineReadinessTracker } from '../../api/decaid/readiness'
import { subscribe } from '../../api/decaid/socket'
import type { DecaidProfileRecord, DecaidWorkflow, DecaidWorkflowPatch, FavoriteAssignments, MachineSnapshot, ScaleSnapshot, TimeToReadyFrame, WaterLevels } from '../../api/decaid/types'
import { WATER_TANK_LOW_LEVEL_ML, WATER_TANK_SENSOR_FULL_MM, WATER_TANK_WARNING_OFFSET_CLICKS } from '../../domain/brewing'
import type { AvailableScale, BrewProfile, BrewingScreenModel, DataConnection, EditableMachineSetting, EditableProfileSetting, LiveBrewState, LiveShotPoint, LiveUtilityOperation, MachineReadiness, PreviousShot, PreviousShotStatus, ScaleConnection, SettingFeedback, UtilityOperationKind } from '../../domain/brewing'
import { VALUE_ADJUSTMENTS } from '../../domain/valueAdjustments'
import { brewingFixture } from '../../fixtures/brewingFixture'

const MAX_LIVE_SHOT_POINTS = 900
const MIN_SUCCESSFUL_SHOT_MS = 5_000
const MINIMUM_SCALE_SCAN_MS = 10_000
const SCALE_SCAN_RETRY_DELAY_MS = 5_000
const MINIMUM_CLEANING_LOADER_MS = 900
const FLUSH_DURATION_SECONDS = 5
const flushDurationDefaultStorageKey = 'bestpresso.flush-duration-default.v1'
const fixtureProfiles = profilesWithParsedTitles(brewingFixture.profiles)

interface LiveShotSession {
  kind: 'espresso' | 'cleaning'
  startedAt: number
  profileName: string
  targetYield: number
  stepNames?: string[]
  points: LiveShotPoint[]
}

interface PendingCleaningSequence {
  profileId: string
  profileName: string
  stepNames?: string[]
}

interface UtilityOperationSession {
  kind: UtilityOperationKind
  startedAt: number
  lastAt: number
  previousFlow: number
  volumeMl: number
}

const snapshotTime = (timestamp?: string) => {
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN
  return Number.isFinite(parsed) ? parsed : Date.now()
}

const operationKindForSnapshot = (snapshot: MachineSnapshot): UtilityOperationKind | null => {
  const state = (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()
  if (state === 'hotwater') return 'hotWater'
  if (state === 'steam') return 'steam'
  if (state === 'flush') return 'flush'
  return null
}

const machineStateForSnapshot = (snapshot: MachineSnapshot) => (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()

const workflowPatch = (workflow: DecaidWorkflow): DecaidWorkflowPatch => ({
  profile: workflow.profile,
  context: workflow.context,
  steamSettings: workflow.steamSettings,
  hotWaterData: workflow.hotWaterData,
  rinseData: workflow.rinseData,
})

const metricNumber = (model: BrewingScreenModel, utilityId: 'water' | 'steam', label: string) => {
  const value = Number(model.utilities.find((utility) => utility.id === utilityId)?.metrics.find((metric) => metric.label === label)?.value)
  return Number.isFinite(value) ? value : undefined
}

const localFavoriteStorageKey = 'bestpresso.favorite-profile-ids.v1'

const favoriteAssignmentsForSlots = (slots: Array<string | null>): FavoriteAssignments => Object.fromEntries(Array.from({ length: 5 }, (_, slot) => [String(slot), slots[slot] ?? null]))

const availableScaleCandidates = (devices: Awaited<ReturnType<typeof getDevices>>): AvailableScale[] => {
  const candidates = new Map<string, AvailableScale>()
  devices.forEach((device) => {
    if (device.type !== 'scale' || device.state === 'connected' || device.available === false || !device.id) return
    candidates.set(device.id, { id: device.id, name: device.name?.trim() || 'Unknown scale' })
  })
  return [...candidates.values()]
}

const storedFixtureFavoriteAssignments = () => {
  try {
    const raw = window.localStorage.getItem(localFavoriteStorageKey)
    if (raw === null) return null
    const stored = JSON.parse(raw)
    return Array.isArray(stored) ? favoriteAssignmentsForSlots(Array.from({ length: 5 }, (_, slot) => typeof stored[slot] === 'string' ? stored[slot] : null)) : null
  } catch {
    return null
  }
}

const workflowValuesForProfile = (record: DecaidProfileRecord, profile: BrewProfile) => {
  const profileTemperature = Number(profile.temperature)
  const profileDose = Number(profile.dose)
  const profileYield = Number(profile.targetYield)
  const profileGrindSetting = Number(profile.grindSetting)
  const temperature = Number.isFinite(profileTemperature) ? profileTemperature : Number(record.profile?.steps?.[0]?.temperature) || 92
  const dose = Number.isFinite(profileDose) ? profileDose : VALUE_ADJUSTMENTS.dose.defaultValue
  const targetYield = Number.isFinite(profileYield) ? profileYield : VALUE_ADJUSTMENTS.targetYield.defaultValue
  const grinderSetting = String(Number.isFinite(profileGrindSetting) ? profileGrindSetting : VALUE_ADJUSTMENTS.grindSetting.defaultValue)
  const workflowProfile = {
    ...record.profile,
    target_weight: targetYield,
    steps: record.profile?.steps?.map((step) => ({ ...step, temperature })) ?? [],
  }
  const patch: DecaidWorkflowPatch = {
    profile: workflowProfile,
    context: { grinderSetting, targetDoseWeight: dose, targetYield },
  }
  return {
    patch,
    metadata: {
      ...(record.metadata ?? {}),
      temperature,
      grinderSetting,
      targetDoseWeight: dose,
      targetYield,
    },
  }
}

export function useBrewingData() {
  const [model, setModel] = useState<BrewingScreenModel>({ ...brewingFixture, profiles: fixtureProfiles.slice(0, 5), previousShot: null })
  const [allProfiles, setAllProfiles] = useState(fixtureProfiles)
  const [favoriteProfileSlots, setFavoriteProfileSlots] = useState<Array<string | null>>(fixtureProfiles.slice(0, 5).map((profile) => profile.id))
  const [heatingSeconds, setHeatingSeconds] = useState<number | null>(null)
  const [connection, setConnection] = useState<DataConnection>('connecting')
  const [machineConnection, setMachineConnection] = useState<DataConnection>('connecting')
  const [scale, setScale] = useState<ScaleConnection>({ status: 'disconnected' })
  const [availableScales, setAvailableScales] = useState<AvailableScale[]>([])
  const [scaleConnectPendingId, setScaleConnectPendingId] = useState<string | null>(null)
  const [scaleTarePending, setScaleTarePending] = useState(false)
  const [brewStopPending, setBrewStopPending] = useState(false)
  const [cleaningStartPending, setCleaningStartPending] = useState(false)
  const [sleepPending, setSleepPending] = useState(false)
  const [sleepScreenActive, setSleepScreenActive] = useState(false)
  const [machineActionError, setMachineActionError] = useState<string | null>(null)
  const [settingFeedback, setSettingFeedback] = useState<SettingFeedback | null>(null)
  const [settingFeedbackVisible, setSettingFeedbackVisible] = useState(false)
  const [previousShotStatus, setPreviousShotStatus] = useState<PreviousShotStatus>('loading')
  const [shotHistory, setShotHistory] = useState<PreviousShot[]>(() => brewingFixture.previousShot ? [{ ...brewingFixture.previousShot, id: 'fixture-latest' }] : [])
  const [liveBrew, setLiveBrew] = useState<LiveBrewState>({ active: false, visible: false, elapsedMs: 0, points: [] })
  const [utilityOperation, setUtilityOperation] = useState<LiveUtilityOperation | null>(null)
  const sleepRequestInFlight = useRef(false)
  const wakeScreenDismissed = useRef(false)
  const previousReadiness = useRef<MachineReadiness | null>(null)
  const readinessTracker = useRef(createMachineReadinessTracker())
  const displayDimmed = useRef(false)
  const brightnessBeforeSleep = useRef<number | null>(null)
  const profileRecords = useRef<DecaidProfileRecord[]>([])
  const favoriteAssignments = useRef<FavoriteAssignments | null>(null)
  const feedbackTimeout = useRef<number | null>(null)
  const actionErrorTimeout = useRef<number | null>(null)
  const manualScaleSearchInFlight = useRef(false)
  const activeScaleScan = useRef<Promise<Awaited<ReturnType<typeof getDevices>>> | null>(null)
  const connectedScale = useRef(false)
  const scaleTareInFlight = useRef(false)
  const brewStopRequestInFlight = useRef(false)
  const cleaningStartInFlight = useRef(false)
  const pendingCleaningSequence = useRef<PendingCleaningSequence | null>(null)
  const cleaningRestoreWorkflow = useRef<DecaidWorkflowPatch | null>(null)
  const latestScaleSnapshot = useRef<Pick<LiveShotPoint, 'weight' | 'weightFlow'>>({})
  const latestTankVolume = useRef<number | null>(null)
  const machineNeedsWater = useRef(false)
  const machineConnectionRef = useRef<DataConnection>('connecting')
  const liveShotSession = useRef<LiveShotSession | null>(null)
  const utilityOperationSession = useRef<UtilityOperationSession | null>(null)
  const allProfilesRef = useRef(allProfiles)
  const retainedAdHocProfileId = useRef<string | null>(null)
  const latestModel = useRef(model)
  const latestFlushDuration = useRef(FLUSH_DURATION_SECONDS)
  const shotHistoryCache = useRef(new Map<string, NonNullable<BrewingScreenModel['previousShot']>>())

  useEffect(() => { allProfilesRef.current = allProfiles }, [allProfiles])
  useEffect(() => { latestModel.current = model }, [model])

  const runScaleScan = () => {
    if (activeScaleScan.current) return activeScaleScan.current
    const minimumDuration = new Promise<void>((resolve) => window.setTimeout(resolve, MINIMUM_SCALE_SCAN_MS))
    const request = Promise.all([scanForDevices(), minimumDuration]).then(() => getDevices())
    activeScaleScan.current = request
    const clearRequest = () => {
      if (activeScaleScan.current === request) activeScaleScan.current = null
    }
    request.then(clearRequest, clearRequest)
    return request
  }

  const rememberFlushDuration = (workflow: Awaited<ReturnType<typeof getWorkflow>>) => {
    const duration = workflow.rinseData?.duration
    if (typeof duration === 'number' && Number.isFinite(duration)) latestFlushDuration.current = duration
    return workflow
  }

  const getWorkflowWithFlushDurationDefault = () => getWorkflow().then(async (workflow) => {
    try {
      if (window.localStorage.getItem(flushDurationDefaultStorageKey) === 'applied') return rememberFlushDuration(workflow)
      const rinse = workflow.rinseData
      if (rinse?.targetTemperature === undefined || rinse.flow === undefined) return rememberFlushDuration(workflow)
      const updated = rinse.duration === FLUSH_DURATION_SECONDS
        ? workflow
        : await updateWorkflow({ rinseData: { ...rinse, duration: FLUSH_DURATION_SECONDS } })
      window.localStorage.setItem(flushDurationDefaultStorageKey, 'applied')
      return rememberFlushDuration(updated)
    } catch {
      return rememberFlushDuration(workflow)
    }
  })

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

  const setDisplayedScaleWeight = (weight: number) => {
    latestScaleSnapshot.current = { ...latestScaleSnapshot.current, weight }
    setModel((current) => ({
      ...current,
      utilities: current.utilities.map((utility) => utility.id === 'scale'
        ? { ...utility, metrics: utility.metrics.map((metric) => ({ ...metric, value: weight.toFixed(1) })) }
        : utility),
    }))
  }

  const requestScaleTare = async (silent = false) => {
    if (!connectedScale.current || scaleTareInFlight.current) return false
    scaleTareInFlight.current = true
    if (!silent) {
      showMachineActionError(null)
      setScaleTarePending(true)
    }
    try {
      await tareScale()
      setDisplayedScaleWeight(0)
      return true
    } catch (error) {
      if (!silent) {
        if (error instanceof DecaidApiError && error.type === 'block_tare_during_shot') {
          showMachineActionError('Scale tare is unavailable during the shot.')
        } else if (error instanceof DecaidApiError && error.status === 404) {
          showMachineActionError('The scale disconnected before it could be tared.')
        } else {
          showMachineActionError('The scale did not accept the tare command.')
        }
      }
      return false
    } finally {
      scaleTareInFlight.current = false
      if (!silent) setScaleTarePending(false)
    }
  }

  useEffect(() => {
    let disposed = false
    let timeToReadyEstimate: { deadline: number; receivedAt: number } | null = null
    let latestShotRefreshTimeout: number | null = null
    let preferredScaleId: string | null = null

    const updateMachineConnection = (next: DataConnection) => {
      const previous = machineConnectionRef.current
      if (previous === next) return
      machineConnectionRef.current = next
      setMachineConnection(next)
      if (next !== 'connected') {
        previousReadiness.current = null
        readinessTracker.current.reset()
        setHeatingSeconds(null)
        if (previous === 'connected') {
          setSleepScreenActive(false)
          void restoreDisplay()
        }
      }
    }

    const applyConnectedDevices = (devices: Awaited<ReturnType<typeof getDevices>>) => {
      const connectedMachine = devices.find((device) => device.type === 'machine' && device.state === 'connected')
      const activeScale = devices.find((device) => device.type === 'scale' && device.state === 'connected')
      connectedScale.current = Boolean(activeScale)
      if (activeScale) setAvailableScales([])
      updateMachineConnection(connectedMachine ? 'connected' : 'disconnected')
      setScale((current) => current.status === 'searching'
        ? current
        : activeScale
          ? { status: 'connected', id: activeScale.id, name: activeScale.name || 'Scale' }
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
            const domainShot = shotToDomain(shot)
            if (domainShot.id) shotHistoryCache.current.set(domainShot.id, domainShot)
            setModel((current) => ({ ...current, previousShot: domainShot }))
            setShotHistory((current) => [domainShot, ...current.filter((candidate) => candidate.id !== domainShot.id && candidate.id !== `live:${session.startedAt}`)])
            setPreviousShotStatus('loaded')
          } else if (attempt < 2) schedulePersistedShotRefresh(session, attempt + 1)
        }).catch(() => { if (!disposed && attempt < 2) schedulePersistedShotRefresh(session, attempt + 1) })
      }, 800 * (attempt + 1))
    }

    const completeLiveShot = () => {
      const session = liveShotSession.current
      if (!session) return
      liveShotSession.current = null
      brewStopRequestInFlight.current = false
      setBrewStopPending(false)
      const points = [...session.points]
      const elapsedMs = points.at(-1)?.elapsedMs ?? 0
      if (session.kind === 'cleaning') {
        setLiveBrew({ active: false, visible: false, kind: 'cleaning', profileName: session.profileName, elapsedMs, points })
        pendingCleaningSequence.current = null
        const restorePatch = cleaningRestoreWorkflow.current
        if (restorePatch) {
          updateWorkflow(restorePatch).then(async (workflow) => {
            if (workflow.profile) await setMachineProfile(workflow.profile)
            if (disposed) return
            cleaningRestoreWorkflow.current = null
            setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
          }).catch(() => {
            if (!disposed) showMachineActionError('Cleaning finished, but the previous brew profile could not be restored.')
          })
        }
        return
      }
      setLiveBrew({ active: false, visible: true, kind: 'espresso', profileName: session.profileName, targetYield: session.targetYield, elapsedMs, points })

      const hasExtraction = points.some((point) => (point.pressure ?? 0) > 0.5 || (point.flow ?? 0) > 0.1)
      if (elapsedMs < MIN_SUCCESSFUL_SHOT_MS || !hasExtraction) return
      const finalWeight = [...points].reverse().find((point) => point.weight !== undefined)?.weight
      const localShot = {
        id: `live:${session.startedAt}`,
        profileName: session.profileName,
        timestamp: new Date(session.startedAt).toISOString(),
        totalYield: finalWeight === undefined ? '—' : finalWeight.toFixed(1),
        totalTime: String(Math.max(1, Math.round(elapsedMs / 1000))),
        targetYield: session.targetYield,
        points,
      }
      setModel((current) => ({
        ...current,
        previousShot: localShot,
      }))
      shotHistoryCache.current.set(localShot.id, localShot)
      setShotHistory((current) => [localShot, ...current])
      setPreviousShotStatus('loaded')
      schedulePersistedShotRefresh(session)
    }

    const refreshConnectedScale = () => {
      connectedScale.current = true
      setScale((current) => ({ ...current, status: 'connected' }))
      refreshConnectedDevices().then((devices) => {
        if (disposed) return
        const connectedScale = devices.find((device) => device.type === 'scale' && device.state === 'connected')
        setScale({ status: 'connected', id: connectedScale?.id, name: connectedScale?.name || 'Scale' })
      }).catch(() => undefined)
    }

    refreshConnectedDevices().catch(() => undefined)

    const refreshPreferredScale = () => getSettings().then((settings) => {
      if (!disposed) preferredScaleId = settings.preferredScaleId?.trim() || null
    }).catch(() => undefined)
    void refreshPreferredScale()

    const latestShotRequest = getLatestShot()
      .then((shot) => ({ shot, failed: false }))
      .catch(() => ({ shot: null, failed: true }))
    const shotHistoryRequest = getShotHistory()
      .then((history) => ({ history, failed: false }))
      .catch(() => ({ history: null, failed: true }))

    Promise.all([getWorkflowWithFlushDurationDefault(), getProfiles(), getFavoriteAssignments().catch(() => null), latestShotRequest, shotHistoryRequest])
      .then(([workflow, records, assignments, latestShot, historyResult]) => {
        if (disposed) return
        profileRecords.current = records
        favoriteAssignments.current = assignments
        const domainProfiles = profileRecordsToDomain(records, workflow, fixtureProfiles)
        const slots = resolveFavoriteProfileSlots(domainProfiles, assignments)
        const activeProfile = activeProfileForWorkflow(domainProfiles, records, workflow)
        retainedAdHocProfileId.current = activeProfile && !slots.includes(activeProfile.id) ? activeProfile.id : null
        allProfilesRef.current = domainProfiles
        setAllProfiles(domainProfiles)
        setFavoriteProfileSlots(slots)
        const latestDomainShot = latestShot.shot ? shotToDomain(latestShot.shot) : null
        const history = historyResult.history?.items.map(shotToDomain) ?? []
        const reconciledHistory = latestDomainShot
          ? [latestDomainShot, ...history.filter((shot) => shot.id !== latestDomainShot.id)]
          : history
        shotHistoryCache.current.clear()
        if (latestDomainShot?.id) shotHistoryCache.current.set(latestDomainShot.id, latestDomainShot)
        setShotHistory(reconciledHistory)
        setModel((current) => ({ ...applyWorkflow(current, workflow, records, assignments, retainedAdHocProfileId.current), previousShot: latestDomainShot }))
        setPreviousShotStatus(latestShot.failed && historyResult.failed ? 'error' : reconciledHistory.length ? 'loaded' : 'empty')
        setConnection('connected')
      })
      .catch(() => {
        if (disposed) return
        const assignments = storedFixtureFavoriteAssignments()
        const slots = resolveFavoriteProfileSlots(fixtureProfiles, assignments)
        favoriteAssignments.current = assignments
        const activeProfileId = latestModel.current.activeProfileId
        retainedAdHocProfileId.current = activeProfileId && !slots.includes(activeProfileId) ? activeProfileId : null
        allProfilesRef.current = fixtureProfiles
        setAllProfiles(fixtureProfiles)
        setFavoriteProfileSlots(slots)
        setConnection('fixture')
        updateMachineConnection('fixture')
        setPreviousShotStatus('fixture')
        const fixtureShot = brewingFixture.previousShot ? { ...brewingFixture.previousShot, id: 'fixture-latest' } : null
        shotHistoryCache.current.clear()
        if (fixtureShot) shotHistoryCache.current.set(fixtureShot.id, fixtureShot)
        setShotHistory(fixtureShot ? [fixtureShot] : [])
        setModel((current) => ({
          ...current,
          profiles: carouselProfiles(fixtureProfiles, assignments, current.activeProfileId, retainedAdHocProfileId.current),
          previousShot: fixtureShot,
        }))
      })

    const machine = subscribe<MachineSnapshot>('/machine/snapshot', (snapshot) => {
      if (machineConnectionRef.current !== 'connected') return
      const machineState = (typeof snapshot.state === 'string' ? snapshot.state : snapshot.state?.state)?.toLowerCase()
      machineNeedsWater.current = machineState === 'needswater'
      const operationKind = operationKindForSnapshot(snapshot)
      if (operationKind) {
        const now = snapshotTime(snapshot.timestamp)
        let session = utilityOperationSession.current
        if (!session || session.kind !== operationKind) {
          session = { kind: operationKind, startedAt: now, lastAt: now, previousFlow: Math.max(0, snapshot.flow ?? 0), volumeMl: 0 }
          utilityOperationSession.current = session
          setLiveBrew((current) => current.active ? current : { ...current, visible: false })
        } else {
          const flow = Math.max(0, snapshot.flow ?? 0)
          const elapsedSeconds = Math.max(0, Math.min(2, (now - session.lastAt) / 1000))
          if (operationKind === 'hotWater') session.volumeMl += (session.previousFlow + flow) / 2 * elapsedSeconds
          session.lastAt = Math.max(session.lastAt, now)
          session.previousFlow = flow
        }
        const model = latestModel.current
        setUtilityOperation({
          kind: operationKind,
          elapsedMs: Math.max(0, now - session.startedAt),
          flow: Math.max(0, snapshot.flow ?? 0),
          temperature: operationKind === 'steam' ? snapshot.steamTemperature : snapshot.mixTemperature ?? snapshot.groupTemperature,
          volumeMl: session.volumeMl,
          targetDuration: operationKind === 'flush' ? latestFlushDuration.current : operationKind === 'steam' ? metricNumber(model, 'steam', 'Duration') : undefined,
          targetVolume: operationKind === 'hotWater' ? metricNumber(model, 'water', 'Volume') : undefined,
        })
      } else if (utilityOperationSession.current) {
        utilityOperationSession.current = null
        setUtilityOperation(null)
      }
      const isEspressoExtraction = isEspressoExtractionSnapshot(snapshot)
      const isCleaning = machineStateForSnapshot(snapshot) === 'cleaning' || Boolean(pendingCleaningSequence.current && isEspressoExtraction)
      if (isEspressoExtraction || isCleaning) {
        const now = snapshotTime(snapshot.timestamp)
        const currentModel = latestModel.current
        const cleaningSequence = pendingCleaningSequence.current
        const profile = isCleaning && cleaningSequence
          ? allProfilesRef.current.find((candidate) => candidate.id === cleaningSequence.profileId)
          : currentModel.profiles.find((candidate) => candidate.id === currentModel.activeProfileId) ?? currentModel.profiles[0]
        if (!liveShotSession.current) {
          liveShotSession.current = {
            kind: isCleaning ? 'cleaning' : 'espresso',
            startedAt: now,
            profileName: isCleaning ? cleaningSequence?.profileName ?? 'Cleaning' : profile?.name ?? 'Espresso',
            targetYield: Number(profile?.targetYield) || 36,
            stepNames: isCleaning ? cleaningSequence?.stepNames : profile?.stepNames,
            points: [],
          }
          if (!isCleaning) {
            void requestScaleTare(true)
            const adHocProfileAtBrewStart = retainedAdHocProfileAtBrewStart(currentModel.activeProfileId, retainedAdHocProfileId.current)
            if (adHocProfileAtBrewStart !== retainedAdHocProfileId.current) {
              retainedAdHocProfileId.current = adHocProfileAtBrewStart
              setModel((current) => ({
                ...current,
                profiles: carouselProfiles(allProfilesRef.current, favoriteAssignments.current, current.activeProfileId, adHocProfileAtBrewStart),
              }))
            }
          }
        }
        const session = liveShotSession.current
        const elapsedMs = Math.max(0, now - session.startedAt)
        const lastPoint = session.points.at(-1)
        if (!lastPoint || elapsedMs > lastPoint.elapsedMs) {
          const stage = shotStage(snapshot.profileFrame, typeof snapshot.state === 'object' ? snapshot.state.substate : undefined, session.stepNames)
          session.points.push({
            elapsedMs,
            pressure: snapshot.pressure,
            flow: snapshot.flow,
            targetPressure: snapshot.targetPressure,
            targetFlow: snapshot.targetFlow,
            temperature: snapshot.mixTemperature ?? snapshot.groupTemperature,
            weight: latestScaleSnapshot.current.weight,
            weightFlow: latestScaleSnapshot.current.weightFlow,
            ...stage,
          })
          if (session.points.length > MAX_LIVE_SHOT_POINTS) session.points.shift()
        }
        setLiveBrew({ active: true, visible: true, kind: session.kind, profileName: session.profileName, targetYield: session.targetYield, elapsedMs, points: [...session.points] })
      } else if (liveShotSession.current) {
        completeLiveShot()
      }

      const readiness = readinessTracker.current.evaluate(snapshot)
      if (readiness === 'sleeping') {
        if (previousReadiness.current !== 'sleeping') void dimDisplay()
        if (!wakeScreenDismissed.current && !sleepRequestInFlight.current) setSleepScreenActive(true)
      } else {
        if (previousReadiness.current === 'sleeping') void restoreDisplay()
        if (readiness !== 'disconnected') wakeScreenDismissed.current = false
        setSleepScreenActive(false)
      }
      previousReadiness.current = readiness
      if (readiness !== 'heating') {
        timeToReadyEstimate = null
        setHeatingSeconds(null)
      }
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
        readinessTracker.current.reset()
        completeLiveShot()
        utilityOperationSession.current = null
        setUtilityOperation(null)
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
        connectedScale.current = true
        refreshConnectedScale()
        return
      }
      if (snapshot.status === 'disconnected') {
        connectedScale.current = false
        latestScaleSnapshot.current = {}
        setScale((current) => current.status === 'searching' ? current : { status: 'disconnected' })
        return
      }
      if (snapshot.weight === undefined) return
      connectedScale.current = true
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
      const remainingTimeMs = frame.remainingTimeMs
      if (
        machineConnectionRef.current !== 'connected'
        || previousReadiness.current !== 'heating'
        || frame.status !== 'heating'
        || typeof remainingTimeMs !== 'number'
        || !Number.isFinite(remainingTimeMs)
        || remainingTimeMs <= 0
      ) {
        timeToReadyEstimate = null
        setHeatingSeconds(null)
        return
      }
      const now = Date.now()
      timeToReadyEstimate = { deadline: now + remainingTimeMs, receivedAt: now }
      setHeatingSeconds(Math.min(300, Math.ceil(remainingTimeMs / 1000)))
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
      getWorkflow().then((workflow) => {
        if (disposed || (workflow.profile?.beverage_type?.toLowerCase() === 'cleaning' && cleaningRestoreWorkflow.current)) return
        setModel((current) => applyWorkflow(current, rememberFlushDuration(workflow), profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
      }).catch(() => undefined)
    }, 15000)

    const refreshDeviceConnections = window.setInterval(() => {
      refreshConnectedDevices().catch(() => undefined)
    }, 3000)

    const refreshPreferredScaleSetting = window.setInterval(() => {
      void refreshPreferredScale()
    }, 30000)

    let backgroundScaleSearchTimeout: number | null = null
    const scheduleBackgroundScaleSearch = () => {
      backgroundScaleSearchTimeout = window.setTimeout(async () => {
        backgroundScaleSearchTimeout = null
        if (disposed) return
        if (preferredScaleId && !connectedScale.current) {
          try {
            const devices = await runScaleScan()
            if (devices.some((device) => device.type === 'scale' && device.state === 'connected')) connectedScale.current = true
          } catch { /* the next scheduled scan can retry */ }
        }
        if (!disposed) scheduleBackgroundScaleSearch()
      }, SCALE_SCAN_RETRY_DELAY_MS)
    }
    scheduleBackgroundScaleSearch()

    return () => {
      disposed = true
      window.clearInterval(refreshWorkflow)
      window.clearInterval(refreshDeviceConnections)
      window.clearInterval(refreshPreferredScaleSetting)
      if (backgroundScaleSearchTimeout !== null) window.clearTimeout(backgroundScaleSearchTimeout)
      window.clearInterval(heatingCountdown)
      if (latestShotRefreshTimeout !== null) window.clearTimeout(latestShotRefreshTimeout)
      if (feedbackTimeout.current !== null) window.clearTimeout(feedbackTimeout.current)
      if (actionErrorTimeout.current !== null) window.clearTimeout(actionErrorTimeout.current)
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
    if (manualScaleSearchInFlight.current) return
    manualScaleSearchInFlight.current = true
    showMachineActionError(null)
    setScale((current) => ({ ...current, status: 'searching' }))
    try {
      const devices = await runScaleScan()
      const activeScale = devices.find((device) => device.type === 'scale' && device.state === 'connected')
      const candidates = activeScale ? [] : availableScaleCandidates(devices)
      connectedScale.current = Boolean(activeScale)
      setAvailableScales(candidates.length > 1 ? candidates : [])
      setScale(activeScale ? { status: 'connected', id: activeScale.id, name: activeScale.name || 'Scale' } : { status: 'disconnected' })
    } catch {
      setScale({ status: 'disconnected' })
      showMachineActionError('Decaid could not start a scale search.')
    } finally {
      manualScaleSearchInFlight.current = false
    }
  }

  const connectToScale = async (deviceId: string) => {
    if (scaleConnectPendingId) return
    const selected = availableScales.find((candidate) => candidate.id === deviceId)
    if (!selected) return
    setScaleConnectPendingId(deviceId)
    showMachineActionError(null)
    try {
      await connectDevice(deviceId)
      const devices = await getDevices()
      const activeScale = devices.find((device) => device.type === 'scale' && device.state === 'connected' && device.id === deviceId)
      connectedScale.current = true
      setScale({ status: 'connected', id: deviceId, name: activeScale?.name || selected.name })
      setAvailableScales([])
    } catch {
      showMachineActionError(`Could not connect to ${selected.name}.`)
    } finally {
      setScaleConnectPendingId(null)
    }
  }

  const dismissScalePicker = () => {
    if (scaleConnectPendingId) return
    setAvailableScales([])
  }

  const startCleaningSequence = async (profileId: string) => {
    if (cleaningStartInFlight.current || liveShotSession.current) return false
    const profile = allProfilesRef.current.find((candidate) => candidate.id === profileId && candidate.beverageType?.toLowerCase() === 'cleaning')
    const record = profileRecords.current.find((candidate) => (candidate.id || candidate.profile?.title) === profileId)
    if (!profile || !record?.profile?.steps?.length) {
      showMachineActionError('That cleaning sequence is not available.')
      return false
    }
    if (connection !== 'connected' || machineConnection !== 'connected') {
      showMachineActionError('Connect to the machine before starting a cleaning sequence.')
      return false
    }

    cleaningStartInFlight.current = true
    setCleaningStartPending(true)
    const loaderStartedAt = performance.now()
    showMachineActionError(null)
    let previousWorkflow: DecaidWorkflow | null = null
    try {
      previousWorkflow = await getWorkflow()
      cleaningRestoreWorkflow.current = workflowPatch(previousWorkflow)
      pendingCleaningSequence.current = { profileId, profileName: profile.name, stepNames: profile.stepNames }
      await setMachineProfile(record.profile)
      const cleaningWorkflow = await updateWorkflow({ profile: record.profile })
      const selectedProfile = cleaningWorkflow.profile
      if (selectedProfile?.title !== record.profile.title || selectedProfile?.beverage_type?.toLowerCase() !== 'cleaning') {
        throw new Error('Decaid did not retain the selected cleaning profile')
      }
      await setMachineState('cleaning')
      return true
    } catch {
      pendingCleaningSequence.current = null
      const restorePatch = cleaningRestoreWorkflow.current
      cleaningRestoreWorkflow.current = null
      if (previousWorkflow && restorePatch) {
        updateWorkflow(restorePatch).then((workflow) => workflow.profile ? setMachineProfile(workflow.profile) : undefined).catch(() => undefined)
      }
      showMachineActionError('The machine did not start the cleaning sequence.')
      return false
    } finally {
      const remainingLoaderTime = MINIMUM_CLEANING_LOADER_MS - (performance.now() - loaderStartedAt)
      if (remainingLoaderTime > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, remainingLoaderTime))
      cleaningStartInFlight.current = false
      setCleaningStartPending(false)
    }
  }

  const stopEspresso = async () => {
    if (brewStopRequestInFlight.current || !liveShotSession.current) return
    if (connection !== 'connected' || machineConnection !== 'connected') {
      showMachineActionError('The machine is disconnected, so the pull could not be stopped.')
      return
    }
    brewStopRequestInFlight.current = true
    setBrewStopPending(true)
    showMachineActionError(null)
    try {
      await setMachineState('idle')
    } catch {
      brewStopRequestInFlight.current = false
      setBrewStopPending(false)
      showMachineActionError('The machine did not accept the stop command.')
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
      steamDuration: { label: 'Steam duration', patch: { steamSettings: { duration: value } }, sharedKey: 'last-steam-duration' },
      steamFlow: { label: 'Steam flow', patch: { steamSettings: { flow: value } }, sharedKey: 'last-steam-flow' },
    } as const
    const update = settings[setting]
    showSettingFeedback({ status: 'saving', message: `Saving ${update.label}…` })
    try {
      const workflow = await updateWorkflow(update.patch)
      setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
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
    const { patch, metadata } = workflowValuesForProfile(record, nextProfile)
    showSettingFeedback({ status: 'saving', message: `Saving ${currentProfile.name}…` })
    let workflow
    try {
      workflow = await updateWorkflow(patch)
      setModel((current) => applyWorkflow(current, workflow!, profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
    } catch {
      showSettingFeedback({ status: 'error', message: `${currentProfile.name} could not be applied to Decaid.` })
      return
    }
    try {
      const savedRecord = await updateProfileMetadata(profileId, metadata)
      profileRecords.current = profileRecords.current.map((candidate) => candidate.id === profileId ? savedRecord : candidate)
      const domainProfiles = profileRecordsToDomain(profileRecords.current, workflow, fixtureProfiles)
      allProfilesRef.current = domainProfiles
      setAllProfiles(domainProfiles)
      setFavoriteProfileSlots(resolveFavoriteProfileSlots(domainProfiles, favoriteAssignments.current))
      setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
      showSettingFeedback({ status: 'saved', message: `${currentProfile.name} saved and applied.` })
    } catch {
      showSettingFeedback({ status: 'error', message: `${currentProfile.name} was applied, but its saved defaults could not be recorded.` })
    }
  }

  const selectProfile = async (profileId: string) => {
    const profile = allProfiles.find((candidate) => candidate.id === profileId)
    if (!profile) {
      showSettingFeedback({ status: 'error', message: 'That profile is no longer available.' })
      return false
    }
    const favoriteSlots = resolveFavoriteProfileSlots(allProfiles, favoriteAssignments.current)
    const isFavorite = favoriteSlots.includes(profileId)
    if (latestModel.current.activeProfileId === profileId) {
      if (!isFavorite) retainedAdHocProfileId.current = profileId
      return true
    }
    if (connection === 'fixture') {
      if (!isFavorite) retainedAdHocProfileId.current = profileId
      setModel((current) => ({
        ...current,
        profiles: carouselProfiles(allProfiles, favoriteAssignments.current, profileId, retainedAdHocProfileId.current),
        activeProfileId: profileId,
      }))
      return true
    }
    if (connection !== 'connected') {
      showSettingFeedback({ status: 'error', message: 'Connect to Decaid before selecting a profile.' })
      return false
    }
    const record = profileRecords.current.find((candidate) => candidate.id === profileId)
    if (!record?.profile?.steps?.length) {
      showSettingFeedback({ status: 'error', message: 'This profile cannot be applied to Decaid.' })
      return false
    }
    try {
      const workflow = await updateWorkflow(workflowValuesForProfile(record, profile).patch)
      if (!isFavorite) retainedAdHocProfileId.current = profileId
      setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
      return true
    } catch {
      showSettingFeedback({ status: 'error', message: `${profile.name} could not be selected.` })
      return false
    }
  }

  const setFavoriteProfileSlot = async (profileId: string, slot: number) => {
    const profile = allProfiles.find((candidate) => candidate.id === profileId)
    if (!profile || slot < 0 || slot > 4) {
      showSettingFeedback({ status: 'error', message: 'That favorite slot is not available.' })
      return false
    }
    if (connection !== 'connected' && connection !== 'fixture') {
      showSettingFeedback({ status: 'error', message: 'Connect to Decaid before changing favorites.' })
      return false
    }
    const currentSlots = resolveFavoriteProfileSlots(allProfiles, favoriteAssignments.current)
    const existingSlot = currentSlots.indexOf(profileId)
    if (existingSlot === slot) return true
    const nextSlots = [...currentSlots]
    if (existingSlot >= 0) [nextSlots[existingSlot], nextSlots[slot]] = [nextSlots[slot], nextSlots[existingSlot]]
    else nextSlots[slot] = profileId
    const assignments = favoriteAssignmentsForSlots(nextSlots)
    try {
      if (connection === 'connected') await setSharedSetting('favorite-profiles', assignments)
      else window.localStorage.setItem(localFavoriteStorageKey, JSON.stringify(nextSlots))
      favoriteAssignments.current = assignments
      if (retainedAdHocProfileId.current && nextSlots.includes(retainedAdHocProfileId.current)) retainedAdHocProfileId.current = null
      const activeProfileId = latestModel.current.activeProfileId
      if (activeProfileId && !nextSlots.includes(activeProfileId)) retainedAdHocProfileId.current = activeProfileId
      setFavoriteProfileSlots(nextSlots)
      setModel((current) => ({
        ...current,
        profiles: carouselProfiles(allProfiles, assignments, current.activeProfileId, retainedAdHocProfileId.current),
      }))
      return true
    } catch {
      showSettingFeedback({ status: 'error', message: 'Favorite profiles could not be saved.' })
      return false
    }
  }

  const removeFavoriteProfile = async (profileId: string) => {
    if (connection !== 'connected' && connection !== 'fixture') {
      showSettingFeedback({ status: 'error', message: 'Connect to Decaid before changing favorites.' })
      return false
    }
    const currentSlots = resolveFavoriteProfileSlots(allProfiles, favoriteAssignments.current)
    const slot = currentSlots.indexOf(profileId)
    if (slot < 0) return true
    const nextSlots = [...currentSlots]
    nextSlots[slot] = null
    const assignments = favoriteAssignmentsForSlots(nextSlots)
    try {
      if (connection === 'connected') await setSharedSetting('favorite-profiles', assignments)
      else window.localStorage.setItem(localFavoriteStorageKey, JSON.stringify(nextSlots))
      favoriteAssignments.current = assignments
      if (latestModel.current.activeProfileId === profileId) retainedAdHocProfileId.current = profileId
      setFavoriteProfileSlots(nextSlots)
      setModel((current) => ({
        ...current,
        profiles: carouselProfiles(allProfiles, assignments, current.activeProfileId, retainedAdHocProfileId.current),
      }))
      return true
    } catch {
      showSettingFeedback({ status: 'error', message: 'Favorite profiles could not be saved.' })
      return false
    }
  }

  const loadHistoryShot = async (shotId: string) => {
    const cached = shotHistoryCache.current.get(shotId)
    if (cached) return cached
    if (connection !== 'connected') return null
    const shot = shotToDomain(await getShot(shotId))
    if (shot.id) shotHistoryCache.current.set(shot.id, shot)
    setShotHistory((current) => current.map((candidate) => candidate.id === shotId ? shot : candidate))
    return shot
  }

  const settingsDisabled = connection !== 'connected' || settingFeedback?.status === 'saving'
  const dismissLiveBrew = () => setLiveBrew((current) => current.active ? current : { ...current, visible: false })
  const favoriteProfileIds = favoriteProfileSlots.filter((id): id is string => Boolean(id))

  return { model, allProfiles, favoriteProfileIds, favoriteProfileSlots, liveBrew, utilityOperation, previousShotStatus, shotHistory, loadHistoryShot, heatingSeconds, connection, machineConnection, scale, availableScales, scaleConnectPendingId, scaleTarePending, brewStopPending, cleaningStartPending, sleepPending, sleepScreenActive, machineActionError, settingFeedback: settingFeedbackVisible ? settingFeedback : null, settingsDisabled, toggleSleep, wakeMachine, stopEspresso, startCleaningSequence, dismissLiveBrew, searchForScale, connectToScale, dismissScalePicker, tareConnectedScale: () => requestScaleTare(false), updateMachineSetting, updateProfileSetting, selectProfile, setFavoriteProfileSlot, removeFavoriteProfile }
}
