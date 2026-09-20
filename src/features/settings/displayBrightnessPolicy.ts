import { t } from '../../i18n/index.ts'

interface DisplayBrightnessDependencies {
  read: () => Promise<{ requestedBrightness?: number; brightness?: number }>
  write: (value: number) => Promise<unknown>
  load: () => number | null
  persist: (value: number) => void
}

// Serialize the temporary sleep override with explicit user choices and wake.
export function createDisplayBrightnessPolicy(api: DisplayBrightnessDependencies) {
  let queue: Promise<unknown> = Promise.resolve()
  let beforeSleep: number | null = null
  let dimmed = false
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = queue.then(operation)
    queue = result.catch(() => undefined)
    return result
  }
  return {
    choose: (value: number) => enqueue(async () => {
      if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error(t('settings.brightness.outOfRange'))
      const result = await api.write(value)
      if (dimmed) beforeSleep = value
      api.persist(value)
      return result
    }),
    replay: () => enqueue(async () => {
      const saved = api.load()
      if (saved === null || dimmed) return
      const state = await api.read()
      if ((state.requestedBrightness ?? state.brightness) !== saved) await api.write(saved)
    }),
    dim: (value: number) => enqueue(async () => {
      if (dimmed) return
      // Decaid reports the current override, not a separate normal-screen setting.
      // After a reload during sleep that can already be the screensaver brightness.
      const saved = api.load()
      const state = saved === null ? await api.read() : undefined
      beforeSleep = saved ?? state?.requestedBrightness ?? state?.brightness ?? 100
      await api.write(value)
      dimmed = true
    }),
    // The timed screen-off darkens an active saver session one step further.
    // Without a dim session the saver is gone or the wake already restored, and a
    // late blackout must not fight the restore queued behind it.
    deepen: (value: number) => enqueue(async () => {
      if (!dimmed) return
      await api.write(value)
    }),
    restore: () => enqueue(async () => {
      // A disconnect/wake callback is not itself permission to reset brightness.
      if (!dimmed) return
      await api.write(api.load() ?? beforeSleep ?? 100)
      beforeSleep = null
      dimmed = false
    }),
  }
}
