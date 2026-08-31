import { getDecaidEndpoints } from './config'
import type { DecaidDevice, DecaidMachineSettings, DecaidProfile, DecaidProfileRecord, DecaidSettings, DecaidWorkflow, DecaidWorkflowPatch, DisplayState, FavoriteAssignments, PaginatedShots, ScalePowerMode, ShotRecord } from './types'

export class DecaidApiError extends Error {
  status: number
  type?: string

  constructor(message: string, status: number, type?: string) {
    super(message)
    this.name = 'DecaidApiError'
    this.status = status
    this.type = type
  }
}

async function getJson<T>(path: string, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${getDecaidEndpoints().apiBase}${path}`, { signal: controller.signal })
    if (!response.ok) throw new Error(`Decaid ${path} returned ${response.status}`)
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export const getWorkflow = () => getJson<DecaidWorkflow>('/workflow')
export const getProfiles = () => getJson<DecaidProfileRecord[]>('/profiles')
export const getFavoriteAssignments = () => getJson<FavoriteAssignments>('/store/streamline-app/favorite-profiles')
export const getSharedSetting = <T>(key: string) => getJson<T>(`/store/streamline-app/${encodeURIComponent(key)}`)
export const getDevices = () => getJson<DecaidDevice[]>('/devices')
export const scanForDevices = () => getJson<unknown[]>('/devices/scan', 30000)
export const getDisplayState = () => getJson<DisplayState>('/display')
export const getSettings = () => getJson<DecaidSettings>('/settings')
export const getMachineSettings = () => getJson<DecaidMachineSettings>('/machine/settings')

export async function connectDevice(deviceId: string) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/devices/connect`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId }),
  })
  if (response.ok) return

  const body = await response.json().catch(() => null) as { message?: string; type?: string } | null
  throw new DecaidApiError(body?.message || `Decaid device connection returned ${response.status}`, response.status, body?.type)
}

export async function tareScale() {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/scale/tare`, { method: 'PUT' })
  if (response.ok) return

  const body = await response.json().catch(() => null) as { message?: string; type?: string } | null
  throw new DecaidApiError(body?.message || `Decaid scale tare returned ${response.status}`, response.status, body?.type)
}

export async function setDisplayBrightness(brightness: number) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/display/brightness`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brightness }),
  })
  if (!response.ok) throw new Error(`Decaid display brightness returned ${response.status}`)
  return await response.json() as DisplayState
}

export async function setScalePowerMode(scalePowerMode: ScalePowerMode) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scalePowerMode }),
  })
  if (!response.ok) throw new Error(`Decaid scale power mode returned ${response.status}`)
}

export async function updateWorkflow(patch: DecaidWorkflowPatch) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/workflow`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(`Decaid workflow update returned ${response.status}: ${await response.text()}`)
  return await response.json() as DecaidWorkflow
}

export async function updateProfileMetadata(profileId: string, metadata: Record<string, unknown>) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/profiles/${encodeURIComponent(profileId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata }),
  })
  if (!response.ok) throw new Error(`Decaid profile update returned ${response.status}: ${await response.text()}`)
  return await response.json() as DecaidProfileRecord
}

export async function setSharedSetting(key: string, value: unknown) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/store/streamline-app/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
  })
  if (!response.ok) throw new Error(`Decaid shared setting returned ${response.status}`)
}

export async function setMachineState(state: 'idle' | 'sleeping' | 'espresso' | 'cleaning' | 'skipStep') {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/machine/state/${state}`, { method: 'PUT' })
  if (!response.ok) throw new Error(`Decaid machine state returned ${response.status}`)
}

export async function setMachineProfile(profile: DecaidProfile) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/machine/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  if (!response.ok) throw new Error(`Decaid machine profile upload returned ${response.status}: ${await response.text()}`)
}

export async function getLatestShot() {
  const latest = await getJson<ShotRecord | null>('/shots/latest')
  return latest?.id ? getJson<ShotRecord>(`/shots/${encodeURIComponent(latest.id)}`) : null
}

export const getShotHistory = (limit = 30, offset = 0) => getJson<PaginatedShots>(`/shots?limit=${limit}&offset=${offset}&orderBy=timestamp&order=desc`)
export const getShot = (id: string) => getJson<ShotRecord>(`/shots/${encodeURIComponent(id)}`)
