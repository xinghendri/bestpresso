import completionSoundUrl from '../assets/audio/brew-complete.ogg'

type AudioContextConstructor = typeof AudioContext

let context: AudioContext | null = null
let completionBuffer: AudioBuffer | null = null
let completionBufferRequest: Promise<AudioBuffer | null> | null = null

const audioContextConstructor = () => window.AudioContext
  ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext

const getContext = () => {
  if (context) return context
  const AudioContextClass = audioContextConstructor()
  if (!AudioContextClass) return null
  context = new AudioContextClass()
  return context
}

const loadCompletionBuffer = (audioContext: AudioContext) => {
  if (completionBuffer) return Promise.resolve(completionBuffer)
  if (completionBufferRequest) return completionBufferRequest

  completionBufferRequest = fetch(completionSoundUrl)
    .then((response) => {
      if (!response.ok) throw new Error(`Completion sound request failed with ${response.status}`)
      return response.arrayBuffer()
    })
    .then((bytes) => audioContext.decodeAudioData(bytes))
    .then((buffer) => {
      completionBuffer = buffer
      return buffer
    })
    .catch(() => {
      completionBufferRequest = null
      return null
    })

  return completionBufferRequest
}

/** Unlocks and preloads the cue during a user gesture so delayed playback works on tablets. */
export function primeCompletionSound() {
  try {
    const audioContext = getContext()
    if (!audioContext) return
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined)
    void loadCompletionBuffer(audioContext)
  } catch {
    // Audio feedback is progressive enhancement.
  }
}

export async function playCompletionSound() {
  try {
    const audioContext = getContext()
    if (!audioContext) return
    if (audioContext.state === 'suspended') await audioContext.resume()
    const buffer = await loadCompletionBuffer(audioContext)
    if (!buffer) return

    const source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(audioContext.destination)
    source.addEventListener('ended', () => source.disconnect(), { once: true })
    source.start()
  } catch {
    // Completion remains functional if audio playback is unavailable.
  }
}
