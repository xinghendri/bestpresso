import { t } from '../../i18n/index.ts'
import type { DecaidWorkflow, DecaidWorkflowPatch } from '../../api/decaid/types'

type Water = NonNullable<DecaidWorkflow['hotWaterData']>
export interface HotWaterShotSettings {
  targetHotWaterVolume?: number
  targetHotWaterTemp?: number
  targetHotWaterDuration?: number
}
const fields = [
  ['volume', 'last-hot-water-volume'],
  ['targetTemperature', 'last-hot-water-temp'],
] as const
const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0

/** A setpoint, never a measured outlet/mix temperature. Prefer machine readback. */
export function hotWaterTargetTemperature(readback: Water, workflow: DecaidWorkflow): number | undefined {
  if (valid(readback.targetTemperature)) return readback.targetTemperature
  const target = workflow.hotWaterData?.targetTemperature
  return valid(target) ? target : undefined
}

export function hotWaterFromShotSettings(frame: HotWaterShotSettings): Water {
  const water: Water = {}
  if (valid(frame.targetHotWaterVolume)) water.volume = frame.targetHotWaterVolume
  if (valid(frame.targetHotWaterTemp)) water.targetTemperature = frame.targetHotWaterTemp
  if (valid(frame.targetHotWaterDuration)) water.duration = frame.targetHotWaterDuration
  return water
}

/** Streamline's shared intent → workflow ordering and 30-second drift guard.
 * No machine-state, tare, calibration, flow or safety-backstop writes occur here.
 * One queue covers both UI surfaces and reconciliation so a stale echo cannot
 * undo an edit while its shared-store request is still in flight.
 */
export function createHotWaterSync(api: {
  read(key: string): Promise<unknown>
  store(key: string, value: number): Promise<void>
  update(patch: DecaidWorkflowPatch): Promise<DecaidWorkflow>
  now?: () => number
}) {
  let queue: Promise<unknown> = Promise.resolve()
  let revision = 0
  let readback: Water = {}
  const checked = new Map<string, number | undefined>()
  const pushedAt = new Map<string, number>()
  const now = api.now ?? Date.now
  function ordered<T>(action: () => Promise<T>): Promise<T> {
    const result = queue.then(action)
    queue = result.catch(() => undefined)
    return result
  }

  return {
    readback: () => ({ ...readback }),
    observe(frame: HotWaterShotSettings) {
      const incoming = hotWaterFromShotSettings(frame)
      const changed = Object.entries(incoming).some(([key, value]) => readback[key as keyof Water] !== value)
      if (changed) readback = { ...readback, ...incoming }
      return changed
    },
    disconnect() {
      revision++
      readback = {}
      checked.clear()
      // Keep cooldown across reconnects: a flapping link must not cause a storm.
    },
    save(patch: DecaidWorkflowPatch) {
      revision++ // Invalidate an asynchronous drift lookup immediately.
      return ordered(async () => {
        for (const [field, key] of fields) {
          const value = patch.hotWaterData?.[field]
          if (value === undefined) continue
          if (!valid(value)) throw new Error(t('common.error.waterTarget'))
          // Fail visibly rather than write hardware while other skins can
          // still read the old shared target.
          await api.store(key, value)
        }
        const workflow = await api.update(patch)
        checked.clear()
        return workflow
      })
    },
    reconcile(workflow: DecaidWorkflow, canWrite: () => boolean): Promise<DecaidWorkflow | null> {
      const generation = revision
      return ordered(async () => {
        if (generation !== revision || !canWrite()) return null
        const actual = { ...workflow.hotWaterData, ...readback }
        const patch: Water = {}
        const observations = new Map<string, number | undefined>()
        for (const [field, key] of fields) {
          const value = actual[field]
          if (checked.has(field) && checked.get(field) === value) continue
          if (now() - (pushedAt.get(field) ?? -Infinity) < 30_000) continue
          // Claim before awaiting, including failures (Streamline's storm guard).
          pushedAt.set(field, now())
          const desired = await api.read(key)
          if (generation !== revision || !canWrite()) {
            pushedAt.delete(field)
            return null
          }
          observations.set(field, value)
          if (!valid(desired) || desired === value) pushedAt.delete(field)
          else patch[field] = desired
        }
        if (generation !== revision || !canWrite()) return null
        for (const [field, value] of observations) checked.set(field, value)
        if (!Object.keys(patch).length) return null
        // Intent already lives in the store. Do not re-store a value fetched
        // earlier over a newer choice from another device.
        try {
          return await api.update({ hotWaterData: patch })
        } catch (error) {
          // Permit a later bounded retry without requiring the failed machine
          // to emit a different value. Keep the 30-second cooldown.
          for (const field of Object.keys(patch)) checked.delete(field)
          throw error
        }
      })
    },
  }
}
