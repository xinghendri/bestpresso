import { useEffect, useRef, useState } from 'react'
import { applyWorkflow, favoriteProfiles, profileRecordsToDomain, readinessFromSnapshot, shotToDomain, STEAM_HEATER_READY_C, tankMillilitres } from '../../api/decaid/adapters'
import { getDevices, getDisplayState, getFavoriteAssignments, getLatestShot, getProfiles, getWorkflow, scanForDevices, setDisplayBrightness, setMachineState } from '../../api/decaid/client'
import { getDecaidEndpoints } from '../../api/decaid/config'
import { subscribe } from '../../api/decaid/socket'
import type { DecaidProfileRecord, FavoriteAssignments, MachineSnapshot, ScaleSnapshot, TimeToReadyFrame, WaterLevels } from '../../api/decaid/types'
import type { BrewingScreenModel, DataConnection, MachineReadiness, ScaleConnection } from '../../domain/brewing'
import { brewingFixture } from '../../fixtures/brewingFixture'

export function useBrewingData() {
  const [model, setModel] = useState<BrewingScreenModel>(brewingFixture)
  const [allProfiles, setAllProfiles] = useState(brewingFixture.profiles)
  const [favoriteProfileIds, setFavoriteProfileIds] = useState(brewingFixture.profiles.slice(0, 5).map((profile) => profile.id))
  const [heatingSeconds, setHeatingSeconds] = useState<number | null>(null)
  const [connection, setConnection] = useState<DataConnection>('connecting')
  const [scale, setScale] = useState<ScaleConnection>({ status: 'disconnected' })
  const [sleepPending, setSleepPending] = useState(false)
  const [sleepScreenActive, setSleepScreenActive] = useState(false)
  const [machineActionError, setMachineActionError] = useState<string | null>(null)
  const sleepRequestInFlight = useRef(false)
  const wakeScreenDismissed = useRef(false)
  const previousReadiness = useRef<MachineReadiness | null>(null)
  const displayDimmed = useRef(false)
  const brightnessBeforeSleep = useRef<number | null>(null)
  const scaleSearchTimeout = useRef<number | null>(null)
  const gatewayHost = getDecaidEndpoints().gatewayHost

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

  useEffect(() => {
    let disposed = false
    let profileRecords: DecaidProfileRecord[] = []
    let favoriteAssignments: FavoriteAssignments | null = null
    let timeToReadyEstimate: { deadline: number; receivedAt: number } | null = null

    const refreshConnectedScale = () => {
      setScale((current) => ({ ...current, status: 'connected' }))
      if (scaleSearchTimeout.current !== null) window.clearTimeout(scaleSearchTimeout.current)
      scaleSearchTimeout.current = null
      getDevices().then((devices) => {
        if (disposed) return
        const connectedScale = devices.find((device) => device.type === 'scale' && device.state === 'connected')
        setScale({ status: 'connected', name: connectedScale?.name || 'Scale' })
      }).catch(() => undefined)
    }

    getDevices().then((devices) => {
      if (disposed) return
      const connectedScale = devices.find((device) => device.type === 'scale' && device.state === 'connected')
      if (connectedScale) setScale({ status: 'connected', name: connectedScale.name || 'Scale' })
    }).catch(() => undefined)

    Promise.all([getWorkflow(), getProfiles(), getFavoriteAssignments().catch(() => null), getLatestShot().catch(() => null)])
      .then(([workflow, records, assignments, shot]) => {
        if (disposed) return
        profileRecords = records
        favoriteAssignments = assignments
        const domainProfiles = profileRecordsToDomain(records, workflow, brewingFixture.profiles)
        const favorites = favoriteProfiles(domainProfiles, assignments)
        setAllProfiles(domainProfiles)
        setFavoriteProfileIds(favorites.map((profile) => profile.id))
        setModel((current) => ({ ...applyWorkflow(current, workflow, records, assignments), previousShot: shotToDomain(shot, current.previousShot) }))
        setConnection('connected')
      })
      .catch(() => { if (!disposed) setConnection('fixture') })

    const machine = subscribe<MachineSnapshot>('/machine/snapshot', (snapshot) => {
      const readiness = readinessFromSnapshot(snapshot)
      if (readiness === 'sleeping') {
        if (previousReadiness.current !== 'sleeping') void dimDisplay()
        if (!wakeScreenDismissed.current && !sleepRequestInFlight.current) setSleepScreenActive(true)
      } else {
        if (previousReadiness.current === 'sleeping') void restoreDisplay()
        wakeScreenDismissed.current = false
        setSleepScreenActive(false)
      }
      previousReadiness.current = readiness
      if (readiness !== 'heating') setHeatingSeconds(null)
      setModel((current) => ({
        ...current,
        readiness,
        utilities: current.utilities.map((utility) => utility.id === 'steam' ? { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Current' && snapshot.steamTemperature !== undefined ? { ...metric, value: String(Math.round(snapshot.steamTemperature)), highlight: snapshot.steamTemperature < STEAM_HEATER_READY_C } : metric) } : utility),
      }))
    }, (connected) => setConnection((current) => connected ? 'connected' : current === 'fixture' ? current : 'disconnected'))

    const scale = subscribe<ScaleSnapshot>('/scale/snapshot', (snapshot) => {
      if (snapshot.status === 'connected') {
        refreshConnectedScale()
        return
      }
      if (snapshot.status === 'disconnected') {
        setScale((current) => current.status === 'searching' ? current : { status: 'disconnected' })
        return
      }
      if (snapshot.weight === undefined) return
      setModel((current) => ({ ...current, utilities: current.utilities.map((utility) => utility.id === 'scale' ? { ...utility, metrics: utility.metrics.map((metric) => ({ ...metric, value: snapshot.weight!.toFixed(1) })) } : utility) }))
    }, () => undefined)

    const water = subscribe<WaterLevels>('/machine/waterLevels', (levels) => {
      if (levels.currentLevel === undefined) return
      setModel((current) => ({ ...current, utilities: current.utilities.map((utility) => utility.id === 'tank' ? { ...utility, metrics: utility.metrics.map((metric) => ({ ...metric, value: tankMillilitres(levels.currentLevel!).toLocaleString('en-US') })) } : utility) }))
    }, () => undefined)

    const timeToReady = subscribe<TimeToReadyFrame>('/plugins/time-to-ready.reaplugin/timeToReady', (frame) => {
      if (frame.status !== 'heating' || !frame.remainingTimeMs || frame.remainingTimeMs <= 0) {
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
      getWorkflow().then((workflow) => { if (!disposed) setModel((current) => applyWorkflow(current, workflow, profileRecords, favoriteAssignments)) }).catch(() => undefined)
    }, 15000)

    return () => {
      disposed = true
      window.clearInterval(refreshWorkflow)
      window.clearInterval(heatingCountdown)
      if (scaleSearchTimeout.current !== null) window.clearTimeout(scaleSearchTimeout.current)
      machine.close(); scale.close(); water.close(); timeToReady.close()
    }
  }, [])

  const toggleSleep = async () => {
    if (sleepRequestInFlight.current) return
    if (connection === 'fixture' || connection === 'connecting') {
      setMachineActionError('Connect to a Decaid gateway before controlling the machine.')
      return
    }

    sleepRequestInFlight.current = true
    setSleepPending(true)
    setMachineActionError(null)
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
        wakeScreenDismissed.current = false
        setSleepScreenActive(true)
        void dimDisplay()
      } else {
        setSleepScreenActive(false)
        void restoreDisplay()
      }
      setMachineActionError('The machine did not accept the sleep command.')
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
    setMachineActionError(null)
    const restorePromise = restoreDisplay()
    try {
      await setMachineState('idle')
      await restorePromise
    } catch {
      await restorePromise
      wakeScreenDismissed.current = false
      setSleepScreenActive(true)
      await dimDisplay()
      setMachineActionError('The machine did not accept the wake command.')
    } finally {
      sleepRequestInFlight.current = false
      setSleepPending(false)
    }
  }

  const searchForScale = async () => {
    setMachineActionError(null)
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
      setMachineActionError('Decaid could not start a scale search.')
    }
  }

  return { model, allProfiles, favoriteProfileIds, heatingSeconds, connection, gatewayHost, scale, sleepPending, sleepScreenActive, machineActionError, toggleSleep, wakeMachine, searchForScale }
}
