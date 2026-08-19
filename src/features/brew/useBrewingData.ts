import { useEffect, useRef, useState } from 'react'
import { applyWorkflow, favoriteProfiles, profileRecordsToDomain, readinessFromSnapshot, shotToDomain, STEAM_HEATER_READY_C, tankMillilitres } from '../../api/decaid/adapters'
import { getFavoriteAssignments, getLatestShot, getProfiles, getWorkflow, setMachineState } from '../../api/decaid/client'
import { getDecaidEndpoints } from '../../api/decaid/config'
import { subscribe } from '../../api/decaid/socket'
import type { DecaidProfileRecord, FavoriteAssignments, MachineSnapshot, ScaleSnapshot, TimeToReadyFrame, WaterLevels } from '../../api/decaid/types'
import type { BrewingScreenModel, DataConnection } from '../../domain/brewing'
import { brewingFixture } from '../../fixtures/brewingFixture'

export function useBrewingData() {
  const [model, setModel] = useState<BrewingScreenModel>(brewingFixture)
  const [allProfiles, setAllProfiles] = useState(brewingFixture.profiles)
  const [favoriteProfileIds, setFavoriteProfileIds] = useState(brewingFixture.profiles.slice(0, 5).map((profile) => profile.id))
  const [heatingSeconds, setHeatingSeconds] = useState<number | null>(null)
  const [connection, setConnection] = useState<DataConnection>('connecting')
  const [sleepPending, setSleepPending] = useState(false)
  const [machineActionError, setMachineActionError] = useState<string | null>(null)
  const sleepRequestInFlight = useRef(false)
  const gatewayHost = getDecaidEndpoints().gatewayHost

  useEffect(() => {
    let disposed = false
    let profileRecords: DecaidProfileRecord[] = []
    let favoriteAssignments: FavoriteAssignments | null = null
    let timeToReadyEstimate: { deadline: number; receivedAt: number } | null = null

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
      if (readiness !== 'heating') setHeatingSeconds(null)
      setModel((current) => ({
        ...current,
        readiness,
        utilities: current.utilities.map((utility) => utility.id === 'steam' ? { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Current' && snapshot.steamTemperature !== undefined ? { ...metric, value: String(Math.round(snapshot.steamTemperature)), highlight: snapshot.steamTemperature < STEAM_HEATER_READY_C } : metric) } : utility),
      }))
    }, (connected) => setConnection((current) => connected ? 'connected' : current === 'fixture' ? current : 'disconnected'))

    const scale = subscribe<ScaleSnapshot>('/scale/snapshot', (snapshot) => {
      if (snapshot.status) return
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
      await setMachineState(model.readiness === 'sleeping' ? 'idle' : 'sleeping')
    } catch {
      setMachineActionError('The machine did not accept the sleep command.')
    } finally {
      sleepRequestInFlight.current = false
      setSleepPending(false)
    }
  }

  return { model, allProfiles, favoriteProfileIds, heatingSeconds, connection, gatewayHost, sleepPending, machineActionError, toggleSleep }
}
