import { useEffect, useRef, useState } from 'react'
import { applyWorkflow, readinessFromSnapshot, shotToDomain, tankMillilitres } from '../../api/decaid/adapters'
import { getLatestShot, getProfiles, getWorkflow, setMachineState } from '../../api/decaid/client'
import { getDecaidEndpoints } from '../../api/decaid/config'
import { subscribe } from '../../api/decaid/socket'
import type { DecaidProfileRecord, MachineSnapshot, ScaleSnapshot, WaterLevels } from '../../api/decaid/types'
import type { BrewingScreenModel, DataConnection } from '../../domain/brewing'
import { brewingFixture } from '../../fixtures/brewingFixture'

export function useBrewingData() {
  const [model, setModel] = useState<BrewingScreenModel>(brewingFixture)
  const [connection, setConnection] = useState<DataConnection>('connecting')
  const [sleepPending, setSleepPending] = useState(false)
  const [machineActionError, setMachineActionError] = useState<string | null>(null)
  const sleepRequestInFlight = useRef(false)
  const gatewayHost = getDecaidEndpoints().gatewayHost

  useEffect(() => {
    let disposed = false
    let profileRecords: DecaidProfileRecord[] = []

    Promise.all([getWorkflow(), getProfiles(), getLatestShot().catch(() => null)])
      .then(([workflow, records, shot]) => {
        if (disposed) return
        profileRecords = records
        setModel((current) => ({ ...applyWorkflow(current, workflow, records), previousShot: shotToDomain(shot, current.previousShot) }))
        setConnection('connected')
      })
      .catch(() => { if (!disposed) setConnection('fixture') })

    const machine = subscribe<MachineSnapshot>('/machine/snapshot', (snapshot) => {
      setModel((current) => ({
        ...current,
        readiness: readinessFromSnapshot(snapshot),
        utilities: current.utilities.map((utility) => utility.id === 'steam' ? { ...utility, metrics: utility.metrics.map((metric) => metric.label === 'Current' && snapshot.steamTemperature !== undefined ? { ...metric, value: String(Math.round(snapshot.steamTemperature)) } : metric) } : utility),
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

    const refreshWorkflow = window.setInterval(() => {
      getWorkflow().then((workflow) => { if (!disposed) setModel((current) => applyWorkflow(current, workflow, profileRecords)) }).catch(() => undefined)
    }, 15000)

    return () => {
      disposed = true
      window.clearInterval(refreshWorkflow)
      machine.close(); scale.close(); water.close()
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

  return { model, connection, gatewayHost, sleepPending, machineActionError, toggleSleep }
}
