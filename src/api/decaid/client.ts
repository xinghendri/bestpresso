import { getDecaidEndpoints } from './config'
import type { DecaidAdvancedMachineSettings, DecaidDevice, DecaidInfo, DecaidMachineSettings, DecaidProfile, DecaidProfileRecord, DecaidSettings, DecaidWorkflow, DecaidWorkflowPatch, DecentAccountStatus, DisplayState, FavoriteAssignments, MachineCapabilities, PaginatedShots, PresenceSettings, ScalePowerMode, ShotRecord, WakeSchedule } from './types'

export interface DecaidPluginManifest {
  id?: string
  name?: string
  description?: string
  loaded?: boolean
  autoLoad?: boolean
  version?: string
  pendingUpdate?: unknown
}

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

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null) as { message?: string; error?: string; type?: string } | null
  return new DecaidApiError(body?.message || body?.error || fallback, response.status, body?.type)
}

async function getJson<T>(path: string, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${getDecaidEndpoints().apiBase}${path}`, { signal: controller.signal })
    if (!response.ok) throw await responseError(response, `Decaid ${path} returned ${response.status}`)
    return await response.json() as T
  } finally {
    window.clearTimeout(timeout)
  }
}

export const getWorkflow = () => getJson<DecaidWorkflow>('/workflow')
export const getProfiles = () => getJson<DecaidProfileRecord[]>('/profiles')
export const getProfile = (profileId: string) => getJson<DecaidProfileRecord>(`/profiles/${encodeURIComponent(profileId)}`)
export const getFavoriteAssignments = () => getJson<FavoriteAssignments>('/store/streamline-app/favorite-profiles')
export const getSharedSetting = <T>(key: string) => getJson<T>(`/store/streamline-app/${encodeURIComponent(key)}`)
export const getDevices = () => getJson<DecaidDevice[]>('/devices')
export const scanForDevices = () => getJson<unknown[]>('/devices/scan', 30000)
export const getDisplayState = () => getJson<DisplayState>('/display')
export const getSettings = () => getJson<DecaidSettings>('/settings')
// This endpoint performs several serialized MMR reads over BLE. Streamline
// leaves it unbounded and gives the advanced read 20 seconds; use that same
// practical window so a healthy but busy machine is not reported unavailable.
export const getMachineSettings = () => getJson<DecaidMachineSettings>('/machine/settings', 20000)
export const getAdvancedMachineSettings = () => getJson<DecaidAdvancedMachineSettings>('/machine/settings/advanced', 20000)
export const getMachineCapabilities = () => getJson<MachineCapabilities>('/machine/capabilities')
export const getPresenceSettings = () => getJson<PresenceSettings>('/presence/settings')
export const getWakeSchedules = () => getJson<WakeSchedule[]>('/presence/schedules')
export const getDecaidInfo = () => getJson<DecaidInfo>('/info')
export const getDecentAccountStatus = () => getJson<DecentAccountStatus>('/account/decent')
export const getPlugins = () => getJson<DecaidPluginManifest[]>('/plugins')
export const getPluginSettings = (pluginId: string) => getJson<Record<string, unknown>>(`/plugins/${encodeURIComponent(pluginId)}/settings`)

export async function callPluginEndpoint<T>(pluginId: string, endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/plugins/${encodeURIComponent(pluginId)}/${encodeURIComponent(endpoint)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await responseError(response, `${pluginId} ${endpoint} returned ${response.status}`)
  return await response.json() as T
}

export async function createProfile(profile: DecaidProfile, parentId?: string, metadata?: Record<string, unknown> | null) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, parentId: parentId ?? null, metadata: metadata ?? null }),
  })
  if (!response.ok) throw await responseError(response, `Decaid profile creation returned ${response.status}`)
  return await response.json() as DecaidProfileRecord
}

export async function updateProfile(profileId: string, profile: DecaidProfile, metadata?: Record<string, unknown> | null) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/profiles/${encodeURIComponent(profileId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, metadata: metadata ?? null }),
  })
  if (!response.ok) throw await responseError(response, `Decaid profile update returned ${response.status}`)
  return await response.json() as DecaidProfileRecord
}

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

async function postJson<T>(path: string, body: unknown, method = 'POST'): Promise<T | undefined> {
  const response = await fetch(`${getDecaidEndpoints().apiBase}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await responseError(response, `Decaid ${path} returned ${response.status}`)
  if (!(response.headers.get('content-type') || '').includes('application/json')) return undefined
  return await response.json() as T
}

export const updateSettings = (patch: Partial<DecaidSettings>) => postJson<DecaidSettings>('/settings', patch)
export const updateMachineSettings = (patch: Partial<DecaidMachineSettings>) => {
  // Decaid reads USB state as a boolean, but its write contract intentionally
  // uses the firmware-facing "enable" / "disable" values.
  const body: Record<string, unknown> = { ...patch }
  if (typeof patch.usb === 'boolean') body.usb = patch.usb ? 'enable' : 'disable'
  return postJson<void>('/machine/settings', body)
}
export const updateAdvancedMachineSettings = (patch: Partial<DecaidAdvancedMachineSettings>) => postJson<void>('/machine/settings/advanced', patch)
export const updatePresenceSettings = (patch: Partial<PresenceSettings>) => postJson<PresenceSettings>('/presence/settings', patch)

export async function setDisplayWakeLock(enabled: boolean) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/display/wakelock`, { method: enabled ? 'POST' : 'DELETE' })
  if (!response.ok) throw await responseError(response, `Decaid wake lock returned ${response.status}`)
  return await response.json() as DisplayState
}

export async function disconnectDevice(deviceId: string) {
  await postJson<void>('/devices/disconnect', { deviceId }, 'PUT')
}

export async function forgetDevice(deviceId: string) {
  await postJson<void>('/devices/forget', { deviceId }, 'PUT')
}

export async function enablePlugin(pluginId: string, enabled: boolean) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/plugins/${encodeURIComponent(pluginId)}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' })
  if (!response.ok) throw await responseError(response, `Decaid plugin update returned ${response.status}`)
}

export const createWakeSchedule = (schedule: WakeSchedule) => postJson<WakeSchedule>('/presence/schedules', schedule)
export const updateWakeSchedule = (id: string, schedule: Partial<WakeSchedule>) => postJson<WakeSchedule>(`/presence/schedules/${encodeURIComponent(id)}`, schedule, 'PUT')

export async function deleteWakeSchedule(id: string) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/presence/schedules/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) throw await responseError(response, `Decaid wake schedule delete returned ${response.status}`)
}

export async function importDecaidBackup(file: File, overwrite = false) {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/data/import?onConflict=${overwrite ? 'overwrite' : 'skip'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: file,
  })
  if (!response.ok && response.status !== 207) throw await responseError(response, `Decaid backup import returned ${response.status}`)
  return await response.json() as Record<string, unknown>
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

export async function setMachineState(state: 'idle' | 'sleeping' | 'espresso' | 'cleaning' | 'skipStep' | 'descaling' | 'airPurge') {
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
