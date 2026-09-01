import { useEffect, useRef, useState } from 'react'
import { playCompletionSound } from '../../audio/completionSound'
import { activeProfileForWorkflow, applyWorkflow, carouselProfiles, favoriteProfileSlots as resolveFavoriteProfileSlots, isCleaningProfile, profileRecordsToDomain, profilesWithParsedTitles, retainedAdHocProfileAtBrewStart, shotStage, shotToDomain, STEAM_HEATER_READY_C, tankMillilitres } from '../../api/decaid/adapters'
import { connectDevice, DecaidApiError, getDevices, getDisplayState, getFavoriteAssignments, getLatestShot, getMachineSettings, getProfiles, getSettings, getSharedSetting, getShot, getShotHistory, getWorkflow, scanForDevices, setDisplayBrightness, setMachineProfile, setMachineState, setSharedSetting, tareScale, updateProfileMetadata, updateWorkflow } from '../../api/decaid/client'
import { profileUsesStopAtWeight, workflowValuesForProfile } from '../../api/decaid/profileWorkflow'
import { createMachineReadinessTracker } from '../../api/decaid/readiness'
import { subscribe } from '../../api/decaid/socket'
import type { DecaidProfileRecord, DecaidWorkflowPatch, FavoriteAssignments, MachineSnapshot, ScaleSnapshot, TimeToReadyFrame, WaterLevels } from '../../api/decaid/types'
import { liveShotYield, normalizedLiveScaleWeight, scaleConnectionIsActive, WATER_TANK_SENSOR_FULL_MM, waterTankLevelState } from '../../domain/brewing'
import type { AvailableScale, BrewingScreenModel, DataConnection, EditableMachineSetting, EditableProfileSetting, LiveBrewState, LiveShotPoint, LiveUtilityOperation, MachineReadiness, PreviousShot, PreviousShotStatus, ScaleConnection, SettingFeedback, UtilityOperationKind } from '../../domain/brewing'
import { brewingFixture, demoLiveBrewFixture } from '../../fixtures/brewingFixture'
import { scaleFixtureForKey } from '../../fixtures/scaleFixtures'
import { CLEANING_PROFILE_START_STATE, cleaningRestorePatch, isCleaningSequenceRun, profileForCleaningShortcut } from '../cleaning/cleaningSequence'
import { observePostShotWeight, reconciledShotYield, type YieldFinalizationState } from '../history/shotYieldFinalization'
import { LAST_SELECTED_PROFILE_LOCAL_KEY, LAST_SELECTED_PROFILE_SHARED_KEY, normalizeRememberedProfileId, resolveRememberedProfileId } from '../profiles/profileSelectionPersistence'
import { rinseWorkflowPatchFromMachineSettings } from './flushSettings'
import { isSuccessfulEspressoCompletion, shouldPlayCompletionCue } from './completionCue'
import { beginSkipTransition, observeSkipTransition, type SkipTransition } from './liveShotState'
import { SLEEP_DISPLAY_BRIGHTNESS, shouldRunBackgroundScaleScan, sleepMachineWithConfiguredScalePolicy } from './sleepControl'

const MAX_LIVE_SHOT_POINTS = 900
const MINIMUM_SCALE_SCAN_MS = 10_000
const SCALE_SCAN_RETRY_DELAY_MS = 5_000
const fixtureProfiles = profilesWithParsedTitles(brewingFixture.profiles)
const localScaleFixture = import.meta.env.DEV
  ? scaleFixtureForKey(new URLSearchParams(window.location.search).get('mockScale'))
  : undefined
const localLiveBrewFixture = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demoShot') === 'live'
  ? { ...demoLiveBrewFixture, points: [...demoLiveBrewFixture.points] }
  : undefined

interface LiveShotSession {
  kind: 'espresso' | 'cleaning'
  startedAt: number
  profileName: string
  targetYield?: number
  stepNames?: string[]
  points: LiveShotPoint[]
}

interface PendingCleaningSequence {
  profileId: string
  profileName: string
  stepNames?: string[]
}

interface PendingYieldFinalization {
  session: LiveShotSession
  localShotId: string
  state: YieldFinalizationState
  displayWeight: number
  timeout: number | null
}

interface UtilityOperationSession {
  kind: UtilityOperationKind
  startedAt: number
  lastAt: number
  previousFlow: number
  volumeMl: number
  weightGrams?: number
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

const storedLastSelectedProfileId = () => {
  try { return normalizeRememberedProfileId(window.localStorage.getItem(LAST_SELECTED_PROFILE_LOCAL_KEY)) }
  catch { return null }
}

const storeLastSelectedProfileIdLocally = (profileId: string) => {
  try { window.localStorage.setItem(LAST_SELECTED_PROFILE_LOCAL_KEY, profileId) }
  catch { /* Decaid's shared store remains the durable source. */ }
}

export function useBrewingData() {
  const [model, setModel] = useState<BrewingScreenModel>({ ...brewingFixture, profiles: fixtureProfiles.slice(0, 5), previousShot: null })
  const [allProfiles, setAllProfiles] = useState(fixtureProfiles)
  const [favoriteProfileSlots, setFavoriteProfileSlots] = useState<Array<string | null>>(fixtureProfiles.slice(0, 5).map((profile) => profile.id))
  const [heatingSeconds, setHeatingSeconds] = useState<number | null>(null)
  const [connection, setConnection] = useState<DataConnection>('connecting')
  const [machineConnection, setMachineConnection] = useState<DataConnection>('connecting')
  const [scale, setScale] = useState<ScaleConnection>(localScaleFixture ?? { status: 'disconnected' })
  const [availableScales, setAvailableScales] = useState<AvailableScale[]>([])
  const [scaleConnectPendingId, setScaleConnectPendingId] = useState<string | null>(null)
  const [scaleTarePending, setScaleTarePending] = useState(false)
  const [brewStopPending, setBrewStopPending] = useState(false)
  const [brewSkipPending, setBrewSkipPending] = useState(false)
  const [cleaningStartPending, setCleaningStartPending] = useState(false)
  const [cleaningPreparedProfileId, setCleaningPreparedProfileId] = useState<string | null>(null)
  const [sleepPending, setSleepPending] = useState(false)
  const [sleepScreenActive, setSleepScreenActive] = useState(false)
  const [machineActionError, setMachineActionError] = useState<string | null>(null)
  const [settingFeedback, setSettingFeedback] = useState<SettingFeedback | null>(null)
  const [settingFeedbackVisible, setSettingFeedbackVisible] = useState(false)
  const [previousShotStatus, setPreviousShotStatus] = useState<PreviousShotStatus>('loading')
  const [shotHistory, setShotHistory] = useState<PreviousShot[]>(() => brewingFixture.previousShot ? [{ ...brewingFixture.previousShot, id: 'fixture-latest' }] : [])
  const [liveBrew, setLiveBrew] = useState<LiveBrewState>(localLiveBrewFixture ?? { active: false, visible: false, elapsedMs: 0, points: [] })
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
  const connectedScale = useRef(Boolean(localScaleFixture))
  const scaleStreamConnected = useRef(Boolean(localScaleFixture))
  const scaleTareInFlight = useRef(false)
  const brewStopRequestInFlight = useRef(false)
  const brewSkipRequestInFlight = useRef(false)
  const brewSkipTransition = useRef<SkipTransition | null>(null)
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
  const latestFlushDuration = useRef<number | undefined>(undefined)
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

  const dimDisplay = async () => {
    if (displayDimmed.current) return
    displayDimmed.current = true
    try {
      const display = await getDisplayState()
      if (typeof display.requestedBrightness === 'number' && display.requestedBrightness > 0) brightnessBeforeSleep.current = display.requestedBrightness
    } catch { /* brightness capture is optional */ }
    try { await setDisplayBrightness(SLEEP_DISPLAY_BRIGHTNESS) }
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
    let pendingYieldFinalization: PendingYieldFinalization | null = null
    let pendingScaleRenderWeight: number | null = null
    let scaleRenderFrame: number | null = null
    const settledYieldBySession = new Map<number, number>()

    const scheduleScaleWeightRender = (weight: number) => {
      pendingScaleRenderWeight = weight
      if (scaleRenderFrame !== null) return
      scaleRenderFrame = window.requestAnimationFrame(() => {
        scaleRenderFrame = null
        const latestWeight = pendingScaleRenderWeight
        pendingScaleRenderWeight = null
        if (latestWeight === null || disposed) return
        const operation = utilityOperationSession.current
        if (operation?.kind === 'hotWater') {
          operation.weightGrams = latestWeight
          setUtilityOperation((current) => current?.kind === 'hotWater'
            ? { ...current, scaleConnected: true, weightGrams: latestWeight }
            : current)
          return
        }
        if (liveShotSession.current?.kind === 'espresso') {
          setLiveBrew((current) => current.active && current.kind === 'espresso'
            ? { ...current, scaleWeight: latestWeight }
            : current)
          return
        }
        setDisplayedScaleWeight(latestWeight)
      })
    }

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
      const activeScale = localScaleFixture ?? devices.find((device) => device.type === 'scale' && device.state === 'connected')
      const scaleConnected = scaleConnectionIsActive(Boolean(activeScale), scaleStreamConnected.current)
      connectedScale.current = scaleConnected
      if (scaleConnected) setAvailableScales([])
      updateMachineConnection(connectedMachine ? 'connected' : 'disconnected')
      setScale((current) => current.status === 'searching'
        ? current
        : activeScale
          ? { status: 'connected', id: activeScale.id, name: activeScale.name || 'Scale' }
          : scaleStreamConnected.current
            ? { ...current, status: 'connected', name: current.name || 'Scale' }
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
            const persistedShot = shotToDomain(shot)
            const domainShot = {
              ...persistedShot,
              profileName: session.profileName,
              beverageType: session.kind,
              totalYield: reconciledShotYield(persistedShot.totalYield, settledYieldBySession.get(session.startedAt)),
            }
            settledYieldBySession.delete(session.startedAt)
            if (domainShot.id) shotHistoryCache.current.set(domainShot.id, domainShot)
            setModel((current) => ({ ...current, previousShot: domainShot }))
            setShotHistory((current) => [domainShot, ...current.filter((candidate) => candidate.id !== domainShot.id && candidate.id !== `live:${session.startedAt}`)])
            setPreviousShotStatus('loaded')
          } else if (attempt < 2) schedulePersistedShotRefresh(session, attempt + 1)
        }).catch(() => { if (!disposed && attempt < 2) schedulePersistedShotRefresh(session, attempt + 1) })
      }, 800 * (attempt + 1))
    }

    const updateLocalShotYield = (localShotId: string, weight: number) => {
      const totalYield = weight.toFixed(1)
      setModel((current) => current.previousShot?.id === localShotId
        ? { ...current, previousShot: { ...current.previousShot, totalYield } }
        : current)
      setShotHistory((current) => current.map((shot) => shot.id === localShotId ? { ...shot, totalYield } : shot))
      const cachedShot = shotHistoryCache.current.get(localShotId)
      if (cachedShot) shotHistoryCache.current.set(localShotId, { ...cachedShot, totalYield })
    }

    const finishPendingYield = () => {
      const pending = pendingYieldFinalization
      if (!pending) return
      if (pending.timeout !== null) window.clearTimeout(pending.timeout)
      settledYieldBySession.set(pending.session.startedAt, pending.displayWeight)
      pendingYieldFinalization = null
      schedulePersistedShotRefresh(pending.session)
    }

    const completeLiveShot = (interrupted = false) => {
      const session = liveShotSession.current
      if (!session) return
      liveShotSession.current = null
      brewSkipTransition.current = null
      brewStopRequestInFlight.current = false
      brewSkipRequestInFlight.current = false
      setBrewStopPending(false)
      setBrewSkipPending(false)
      let points = [...session.points]
      const elapsedMs = points.at(-1)?.elapsedMs ?? 0
      if (session.kind === 'cleaning') {
        if (shouldPlayCompletionCue({ kind: session.kind, interrupted, elapsedMs, hasExtraction: false })) void playCompletionSound()
        setLiveBrew({ active: false, visible: false, startedAt: session.startedAt, kind: 'cleaning', profileName: session.profileName, elapsedMs, points })
        pendingCleaningSequence.current = null
        setCleaningPreparedProfileId(null)
        const restorePatch = cleaningRestoreWorkflow.current
        if (restorePatch) {
          Promise.resolve().then(async () => {
            if (restorePatch.profile) await setMachineProfile(restorePatch.profile)
            const workflow = await updateWorkflow(restorePatch)
            if (disposed) return
            cleaningRestoreWorkflow.current = null
            setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
          }).catch(() => {
            if (!disposed) showMachineActionError('Cleaning finished, but the previous brew profile could not be restored.')
          })
        }
        return
      }
      const finalWeight = liveShotYield(connectedScale.current ? latestScaleSnapshot.current.weight : undefined, points)
      if (finalWeight !== undefined && points.length > 0) {
        points = points.map((point, index) => index === points.length - 1 ? { ...point, weight: finalWeight } : point)
      }
      setLiveBrew({ active: false, visible: true, startedAt: session.startedAt, kind: 'espresso', profileName: session.profileName, targetYield: session.targetYield, scaleWeight: finalWeight, elapsedMs, points })

      const hasExtraction = points.some((point) => (point.pressure ?? 0) > 0.5 || (point.flow ?? 0) > 0.1)
      if (!isSuccessfulEspressoCompletion(elapsedMs, hasExtraction)) return
      if (shouldPlayCompletionCue({ kind: session.kind, interrupted, elapsedMs, hasExtraction })) void playCompletionSound()
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
      if (finalWeight !== undefined && connectedScale.current) {
        finishPendingYield()
        pendingYieldFinalization = {
          session,
          localShotId: localShot.id,
          state: { bestWeight: finalWeight, lastWeight: finalWeight, stableSamples: 0, previousFlow: points.at(-1)?.weightFlow },
          displayWeight: finalWeight,
          timeout: null,
        }
        pendingYieldFinalization.timeout = window.setTimeout(finishPendingYield, 4_000)
      } else {
        schedulePersistedShotRefresh(session)
      }
    }

    const refreshConnectedScale = () => {
      connectedScale.current = true
      if (localScaleFixture) {
        setScale(localScaleFixture)
        return
      }
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
    const rememberedProfileRequest = getSharedSetting<unknown>(LAST_SELECTED_PROFILE_SHARED_KEY)
      .then((value) => normalizeRememberedProfileId(value) ?? storedLastSelectedProfileId())
      .catch(storedLastSelectedProfileId)
    const machineSettingsRequest = getMachineSettings().catch(() => null)

    Promise.all([getWorkflow(), machineSettingsRequest, getProfiles(), getFavoriteAssignments().catch(() => null), latestShotRequest, shotHistoryRequest, rememberedProfileRequest])
      .then(async ([initialWorkflow, machineSettings, records, assignments, latestShot, historyResult, rememberedProfileId]) => {
        if (disposed) return
        profileRecords.current = records
        favoriteAssignments.current = assignments
        let workflow = rememberFlushDuration(initialWorkflow)
        const rinsePatch = machineSettings && rinseWorkflowPatchFromMachineSettings(workflow, machineSettings)
        if (rinsePatch) {
          try {
            workflow = rememberFlushDuration(await updateWorkflow(rinsePatch))
            if (disposed) return
          } catch {
            workflow = initialWorkflow
          }
        }
        let domainProfiles = profileRecordsToDomain(records, workflow, fixtureProfiles)
        const workflowProfile = activeProfileForWorkflow(domainProfiles, records, workflow)
        const restoredProfileId = resolveRememberedProfileId(domainProfiles.map((profile) => profile.id), rememberedProfileId, workflowProfile?.id)
        if (restoredProfileId && restoredProfileId !== workflowProfile?.id) {
          const restoredProfile = domainProfiles.find((profile) => profile.id === restoredProfileId)
          const restoredRecord = records.find((record) => (record.id || record.profile?.title) === restoredProfileId)
          if (restoredProfile && restoredRecord?.profile?.steps?.length) {
            const workflowBeforeProfileRestore = workflow
            try {
              workflow = await updateWorkflow(workflowValuesForProfile(restoredRecord, restoredProfile).patch)
              if (disposed) return
              domainProfiles = profileRecordsToDomain(records, workflow, fixtureProfiles)
            } catch {
              workflow = workflowBeforeProfileRestore
              domainProfiles = profileRecordsToDomain(records, workflow, fixtureProfiles)
            }
          }
        }
        const slots = resolveFavoriteProfileSlots(domainProfiles, assignments)
        const activeProfile = activeProfileForWorkflow(domainProfiles, records, workflow)
        if (activeProfile) storeLastSelectedProfileIdLocally(activeProfile.id)
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
        const activeProfileId = resolveRememberedProfileId(fixtureProfiles.map((profile) => profile.id), storedLastSelectedProfileId(), latestModel.current.activeProfileId) ?? latestModel.current.activeProfileId
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
          profiles: carouselProfiles(fixtureProfiles, assignments, activeProfileId, retainedAdHocProfileId.current),
          activeProfileId,
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
          session = {
            kind: operationKind,
            startedAt: now,
            lastAt: now,
            previousFlow: Math.max(0, snapshot.flow ?? 0),
            volumeMl: 0,
            weightGrams: operationKind === 'hotWater' && connectedScale.current ? 0 : undefined,
          }
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
          scaleConnected: operationKind === 'hotWater' && connectedScale.current,
          weightGrams: operationKind === 'hotWater' ? session.weightGrams : undefined,
          targetDuration: operationKind === 'flush' ? latestFlushDuration.current : operationKind === 'steam' ? metricNumber(model, 'steam', 'Duration') : undefined,
          targetVolume: operationKind === 'hotWater' ? metricNumber(model, 'water', 'Volume') : undefined,
        })
      } else if (utilityOperationSession.current) {
        if (utilityOperationSession.current.kind === 'hotWater') {
          const finalWeight = normalizedLiveScaleWeight(latestScaleSnapshot.current.weight)
          if (finalWeight !== undefined) setDisplayedScaleWeight(finalWeight)
        }
        utilityOperationSession.current = null
        setUtilityOperation(null)
      }
      const skipObservation = observeSkipTransition(snapshot, brewSkipTransition.current, Date.now(), liveShotSession.current !== null)
      brewSkipTransition.current = skipObservation.transition
      const isEspressoExtraction = skipObservation.keepShotActive
      const isCleaning = isCleaningSequenceRun(machineStateForSnapshot(snapshot), isEspressoExtraction, pendingCleaningSequence.current !== null)
      if (isEspressoExtraction || isCleaning) {
        const now = snapshotTime(snapshot.timestamp)
        const currentModel = latestModel.current
        const cleaningSequence = pendingCleaningSequence.current
        const profile = isCleaning && cleaningSequence
          ? allProfilesRef.current.find((candidate) => candidate.id === cleaningSequence.profileId)
          : currentModel.profiles.find((candidate) => candidate.id === currentModel.activeProfileId) ?? currentModel.profiles[0]
        if (!liveShotSession.current) {
          finishPendingYield()
          liveShotSession.current = {
            kind: isCleaning ? 'cleaning' : 'espresso',
            startedAt: now,
            profileName: isCleaning ? cleaningSequence?.profileName ?? 'Cleaning' : profile?.name ?? 'Espresso',
            targetYield: profile && Number.isFinite(Number(profile.targetYield)) ? Number(profile.targetYield) : undefined,
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
        const acceptsShotTelemetry = skipObservation.acceptTelemetry || machineState === 'cleaning'
        if (acceptsShotTelemetry && (!lastPoint || elapsedMs > lastPoint.elapsedMs)) {
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
        setLiveBrew({ active: true, visible: true, startedAt: session.startedAt, kind: session.kind, profileName: session.profileName, targetYield: session.targetYield, scaleWeight: session.kind === 'espresso' ? normalizedLiveScaleWeight(latestScaleSnapshot.current.weight) : undefined, elapsedMs, points: [...session.points] })
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
          if (utility.id === 'tank') {
            const tankState = waterTankLevelState(latestTankVolume.current ?? Number.POSITIVE_INFINITY, machineNeedsWater.current)
            return { ...utility, alert: tankState === 'needsWater', warning: tankState === 'warning' }
          }
          return utility
        }),
      }))
    }, (connected) => {
      if (!connected) {
        readinessTracker.current.reset()
        brewSkipTransition.current = null
        completeLiveShot(true)
        utilityOperationSession.current = null
        setUtilityOperation(null)
      } else if (machineConnectionRef.current === 'fixture') {
        updateMachineConnection('connecting')
      }
      setConnection((current) => connected ? 'connected' : current === 'fixture' ? current : 'disconnected')
    })

    const scale = subscribe<ScaleSnapshot>('/scale/snapshot', (snapshot) => {
      if (localScaleFixture) return
      const liveWeight = normalizedLiveScaleWeight(snapshot.weight)
      if (liveWeight !== undefined || snapshot.weightFlow !== undefined) {
        latestScaleSnapshot.current = {
          weight: liveWeight ?? latestScaleSnapshot.current.weight,
          weightFlow: snapshot.weightFlow ?? latestScaleSnapshot.current.weightFlow,
        }
      }
      if (liveWeight !== undefined) {
        scaleStreamConnected.current = true
        connectedScale.current = true
        if (utilityOperationSession.current?.kind === 'hotWater') utilityOperationSession.current.weightGrams = liveWeight
        scheduleScaleWeightRender(liveWeight)
      }
      if (pendingYieldFinalization && snapshot.weight !== undefined) {
        const result = observePostShotWeight(pendingYieldFinalization.state, snapshot.weight, snapshot.weightFlow)
        pendingYieldFinalization.state = result.state
        pendingYieldFinalization.displayWeight = result.displayWeight
        updateLocalShotYield(pendingYieldFinalization.localShotId, result.displayWeight)
        if (result.finished) finishPendingYield()
      }
      if (snapshot.status === 'connected') {
        scaleStreamConnected.current = true
        connectedScale.current = true
        setUtilityOperation((current) => current?.kind === 'hotWater' ? { ...current, scaleConnected: true } : current)
        refreshConnectedScale()
        return
      }
      if (snapshot.status === 'disconnected') {
        finishPendingYield()
        scaleStreamConnected.current = false
        connectedScale.current = false
        latestScaleSnapshot.current = {}
        if (utilityOperationSession.current?.kind === 'hotWater') utilityOperationSession.current.weightGrams = undefined
        setUtilityOperation((current) => current?.kind === 'hotWater' ? { ...current, scaleConnected: false, weightGrams: undefined } : current)
        setScale((current) => current.status === 'searching' ? current : { status: 'disconnected' })
        return
      }
    }, (socketConnected) => {
      if (!socketConnected) scaleStreamConnected.current = false
    })

    const water = subscribe<WaterLevels>('/machine/waterLevels', (levels) => {
      if (levels.currentLevel === undefined) return
      const sensorLevel = levels.currentLevel
      const volume = tankMillilitres(sensorLevel)
      const levelPercent = Math.max(0, Math.min(100, sensorLevel / WATER_TANK_SENSOR_FULL_MM * 100))
      const tankState = waterTankLevelState(volume, machineNeedsWater.current)
      latestTankVolume.current = volume
      setModel((current) => ({
        ...current,
        utilities: current.utilities.map((utility) => utility.id === 'tank' ? {
          ...utility,
          alert: tankState === 'needsWater',
          warning: tankState === 'warning',
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
        if (disposed || liveShotSession.current || (workflow.profile?.beverage_type?.toLowerCase() === 'cleaning' && cleaningRestoreWorkflow.current)) return
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
        if (shouldRunBackgroundScaleScan(preferredScaleId, connectedScale.current, previousReadiness.current)) {
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
      const pendingYieldTimeout = pendingYieldFinalization?.timeout
      if (pendingYieldTimeout !== null && pendingYieldTimeout !== undefined) window.clearTimeout(pendingYieldTimeout)
      if (feedbackTimeout.current !== null) window.clearTimeout(feedbackTimeout.current)
      if (actionErrorTimeout.current !== null) window.clearTimeout(actionErrorTimeout.current)
      if (scaleRenderFrame !== null) window.cancelAnimationFrame(scaleRenderFrame)
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
        await sleepMachineWithConfiguredScalePolicy({ setMachineState })
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

  const prepareCleaningSequence = async (profileId: string) => {
    if (cleaningStartInFlight.current || liveShotSession.current) return false
    const profile = allProfilesRef.current.find((candidate) => candidate.id === profileId && isCleaningProfile(candidate))
    const record = profileRecords.current.find((candidate) => (candidate.id || candidate.profile?.title) === profileId)
    if (!profile || !record?.profile?.steps?.length) {
      showMachineActionError('That cleaning sequence is not available.')
      return false
    }
    if (connection !== 'connected' || machineConnection !== 'connected') {
      showMachineActionError('Connect to the machine before loading a cleaning sequence.')
      return false
    }

    cleaningStartInFlight.current = true
    setCleaningStartPending(true)
    setCleaningPreparedProfileId(null)
    showMachineActionError(null)
    try {
      if (!cleaningRestoreWorkflow.current) cleaningRestoreWorkflow.current = cleaningRestorePatch(await getWorkflow())
      const executionProfile = profileForCleaningShortcut(record.profile)
      await setMachineProfile(executionProfile)
      const cleaningWorkflow = await updateWorkflow({ profile: executionProfile })
      const selectedProfile = cleaningWorkflow.profile
      if (selectedProfile?.title !== executionProfile.title || selectedProfile?.beverage_type?.toLowerCase() !== 'cleaning') {
        throw new Error('Decaid did not retain the selected cleaning profile')
      }
      pendingCleaningSequence.current = { profileId, profileName: profile.name, stepNames: profile.stepNames }
      setCleaningPreparedProfileId(profileId)
      return true
    } catch {
      pendingCleaningSequence.current = null
      const restorePatch = cleaningRestoreWorkflow.current
      cleaningRestoreWorkflow.current = null
      if (restorePatch) {
        try {
          if (restorePatch.profile) await setMachineProfile(restorePatch.profile)
          await updateWorkflow(restorePatch)
        } catch {
          // The original profile remains the desired recovery target in Decaid.
        }
      }
      showMachineActionError('The cleaning sequence could not be loaded onto the machine.')
      return false
    } finally {
      cleaningStartInFlight.current = false
      setCleaningStartPending(false)
    }
  }

  const startCleaningSequence = async (profileId: string) => {
    if (cleaningStartInFlight.current || liveShotSession.current) return false
    if (cleaningPreparedProfileId !== profileId || pendingCleaningSequence.current?.profileId !== profileId) {
      showMachineActionError('Wait for the selected cleaning sequence to finish loading.')
      return false
    }
    if (connection !== 'connected' || machineConnection !== 'connected') {
      showMachineActionError('Connect to the machine before starting a cleaning sequence.')
      return false
    }

    cleaningStartInFlight.current = true
    showMachineActionError(null)
    try {
      await setMachineState(CLEANING_PROFILE_START_STATE)
      return true
    } catch {
      showMachineActionError('The machine did not start the cleaning sequence.')
      return false
    } finally {
      cleaningStartInFlight.current = false
    }
  }

  const cancelCleaningSequence = async () => {
    if (cleaningStartInFlight.current || liveShotSession.current) return false
    const restorePatch = cleaningRestoreWorkflow.current
    if (!restorePatch) {
      pendingCleaningSequence.current = null
      setCleaningPreparedProfileId(null)
      return true
    }

    cleaningStartInFlight.current = true
    setCleaningStartPending(true)
    showMachineActionError(null)
    try {
      if (restorePatch.profile) await setMachineProfile(restorePatch.profile)
      const workflow = await updateWorkflow(restorePatch)
      cleaningRestoreWorkflow.current = null
      pendingCleaningSequence.current = null
      setCleaningPreparedProfileId(null)
      setModel((current) => applyWorkflow(current, workflow, profileRecords.current, favoriteAssignments.current, retainedAdHocProfileId.current))
      return true
    } catch {
      showMachineActionError('The previous brew profile could not be restored.')
      return false
    } finally {
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
    brewSkipTransition.current = null
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

  const skipBrewStage = async (): Promise<boolean> => {
    if (brewSkipRequestInFlight.current || !liveShotSession.current) return false
    if (connection !== 'connected' || machineConnection !== 'connected') {
      showMachineActionError('The machine is disconnected, so the phase could not be skipped.')
      return false
    }
    brewSkipRequestInFlight.current = true
    brewSkipTransition.current = beginSkipTransition(liveShotSession.current.points.at(-1)?.stageIndex, Date.now())
    setBrewSkipPending(true)
    showMachineActionError(null)
    try {
      await setMachineState('skipStep')
      return true
    } catch {
      brewSkipTransition.current = null
      showMachineActionError('The machine did not accept the skip command.')
      return false
    } finally {
      brewSkipRequestInFlight.current = false
      setBrewSkipPending(false)
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
    if (setting === 'targetYield' && !profileUsesStopAtWeight(record.profile)) {
      showSettingFeedback({ status: 'error', message: `${currentProfile.name} does not use stop at weight.` })
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
    if (liveShotSession.current) return false
    const profile = allProfiles.find((candidate) => candidate.id === profileId)
    if (!profile) {
      showSettingFeedback({ status: 'error', message: 'That profile is no longer available.' })
      return false
    }
    const favoriteSlots = resolveFavoriteProfileSlots(allProfiles, favoriteAssignments.current)
    const isFavorite = favoriteSlots.includes(profileId)
    if (latestModel.current.activeProfileId === profileId) {
      if (!isFavorite) retainedAdHocProfileId.current = profileId
      storeLastSelectedProfileIdLocally(profileId)
      if (connection === 'connected') await setSharedSetting(LAST_SELECTED_PROFILE_SHARED_KEY, profileId).catch(() => undefined)
      return true
    }
    if (connection === 'fixture') {
      if (!isFavorite) retainedAdHocProfileId.current = profileId
      storeLastSelectedProfileIdLocally(profileId)
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
      storeLastSelectedProfileIdLocally(profileId)
      await setSharedSetting(LAST_SELECTED_PROFILE_SHARED_KEY, profileId).catch(() => undefined)
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

  return { model, allProfiles, favoriteProfileIds, favoriteProfileSlots, liveBrew, utilityOperation, previousShotStatus, shotHistory, loadHistoryShot, heatingSeconds, connection, machineConnection, scale, availableScales, scaleConnectPendingId, scaleTarePending, brewStopPending, brewSkipPending, cleaningStartPending, cleaningPreparedProfileId, sleepPending, sleepScreenActive, machineActionError, settingFeedback: settingFeedbackVisible ? settingFeedback : null, settingsDisabled, toggleSleep, wakeMachine, stopEspresso, skipBrewStage, prepareCleaningSequence, startCleaningSequence, cancelCleaningSequence, dismissLiveBrew, searchForScale, connectToScale, dismissScalePicker, tareConnectedScale: () => requestScaleTare(false), updateMachineSetting, updateProfileSetting, selectProfile, setFavoriteProfileSlot, removeFavoriteProfile }
}
