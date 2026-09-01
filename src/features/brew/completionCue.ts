export const MIN_SUCCESSFUL_ESPRESSO_MS = 5_000

interface CompletionCueContext {
  kind: 'espresso' | 'cleaning'
  interrupted: boolean
  elapsedMs: number
  hasExtraction: boolean
}

export const isSuccessfulEspressoCompletion = (elapsedMs: number, hasExtraction: boolean) => elapsedMs >= MIN_SUCCESSFUL_ESPRESSO_MS && hasExtraction

export const shouldPlayCompletionCue = ({ kind, interrupted, elapsedMs, hasExtraction }: CompletionCueContext) => {
  if (interrupted) return false
  if (kind === 'cleaning') return true
  return isSuccessfulEspressoCompletion(elapsedMs, hasExtraction)
}
