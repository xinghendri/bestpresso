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
      if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error('Brightness must be between 0 and 100.')
      const result = await api.write(value)
      api.persist(value)
      if (dimmed) beforeSleep = value
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
      const state = await api.read()
      beforeSleep = state.requestedBrightness ?? state.brightness ?? api.load() ?? 100
      await api.write(value)
      dimmed = true
    }),
    restore: () => enqueue(async () => {
      // A disconnect/wake callback is not itself permission to reset brightness.
      if (!dimmed) return
      await api.write(beforeSleep ?? api.load() ?? 100)
      beforeSleep = null
      dimmed = false
    }),
  }
}
