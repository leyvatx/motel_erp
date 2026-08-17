let context: AudioContext | null = null
let unlocked = false

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    context = new Ctor()
  }
  return context
}

export function unlockAudio(): void {
  if (unlocked) return
  const ctx = ensureContext()
  if (!ctx) return
  void ctx.resume()
  unlocked = true
}

interface BeepOptions {
  frequency?: number
  durationMs?: number
  volume?: number
}

function beep({ frequency = 880, durationMs = 180, volume = 0.15 }: BeepOptions = {}): void {
  const ctx = ensureContext()
  if (!ctx || ctx.state === 'suspended') return

  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()

  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.value = volume

  oscillator.connect(gain)
  gain.connect(ctx.destination)

  const end = ctx.currentTime + durationMs / 1000
  gain.gain.exponentialRampToValueAtTime(0.0001, end)

  oscillator.start()
  oscillator.stop(end)
}

function sequence(steps: readonly BeepOptions[], gapMs: number): void {
  steps.forEach((step, index) => {
    window.setTimeout(() => beep(step), index * gapMs)
  })
}

export function playWarningAlert(): void {
  sequence([{ frequency: 740 }, { frequency: 988 }], 220)
}

export function playExpiredAlert(): void {
  sequence(
    [
      { frequency: 523, durationMs: 220, volume: 0.2 },
      { frequency: 415, durationMs: 220, volume: 0.2 },
      { frequency: 330, durationMs: 320, volume: 0.2 },
    ],
    260,
  )
}

export function playSuccessTone(): void {
  beep({ frequency: 1046, durationMs: 120, volume: 0.1 })
}
