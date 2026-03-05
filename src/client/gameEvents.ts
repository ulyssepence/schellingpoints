export type GameEvent = 'meld' | 'reveal' | 'round-start'

const bus = new EventTarget()

export function emit(event: GameEvent) {
  bus.dispatchEvent(new Event(event))
}

export function on(event: GameEvent, handler: () => void) {
  bus.addEventListener(event, handler)
  return () => bus.removeEventListener(event, handler)
}
