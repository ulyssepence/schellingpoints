const FLAG_NAMES = [
  'buttonScale',
  'screenTransitions',
  'centroidEntrance',
  'lockInPunch',
  'progressDotPop',
  'promptTypewriter',
  'timerUrgency',
  'historyStagger',
  'soundExpansion',
  'scatterAnimation',
  'scatterEnhancements',
  'meldCelebration',
  'backgroundReactivity',
] as const

export type FlagName = typeof FLAG_NAMES[number]

export type Flags = Record<FlagName, boolean> & { allJuice: boolean }

const DEFAULTS: Flags = {
  allJuice: true,
  buttonScale: true,
  screenTransitions: true,
  centroidEntrance: true,
  lockInPunch: true,
  progressDotPop: true,
  promptTypewriter: true,
  timerUrgency: true,
  historyStagger: true,
  soundExpansion: true,
  scatterAnimation: true,
  scatterEnhancements: true,
  meldCelebration: true,
  backgroundReactivity: true,
}

const STORAGE_KEY = 'juice_flags'

export function getFlags(): Flags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function setFlags(flags: Flags) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags))
}

export function flag(name: FlagName): boolean {
  const flags = getFlags()
  if (!flags.allJuice) return false
  return flags[name]
}

export function applyBodyClasses() {
  const flags = getFlags()
  for (const name of FLAG_NAMES) {
    const cls = 'juice-' + name.replace(/([A-Z])/g, '-$1').toLowerCase()
    if (flags.allJuice && flags[name]) {
      document.body.classList.add(cls)
    } else {
      document.body.classList.remove(cls)
    }
  }
}

export { FLAG_NAMES }
