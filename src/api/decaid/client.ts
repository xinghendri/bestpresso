import { getDecaidEndpoints } from './config'
import type { DecaidDevice, DecaidProfileRecord, DecaidWorkflow, FavoriteAssignments, PaginatedShots, ShotRecord } from './types'

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
export const getDevices = () => getJson<DecaidDevice[]>('/devices')
export const scanForDevices = () => getJson<unknown[]>('/devices/scan?quick=true')

export async function setMachineState(state: 'idle' | 'sleeping') {
  const response = await fetch(`${getDecaidEndpoints().apiBase}/machine/state/${state}`, { method: 'PUT' })
  if (!response.ok) throw new Error(`Decaid machine state returned ${response.status}`)
}

export async function getLatestShot() {
  const page = await getJson<PaginatedShots>('/shots?limit=1&offset=0&order=desc')
  const latest = page.items?.[0]
  return latest?.id ? getJson<ShotRecord>(`/shots/${encodeURIComponent(latest.id)}`) : null
}
