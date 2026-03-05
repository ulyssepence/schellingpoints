import * as howler from 'howler'

export type Clip =
  | 'Ex'
  | 'Oh'
  | 'Winner'
  | 'PlayerJoined'
  | 'RoundStart'
  | 'SubmitClick'
  | 'TimerTick'
  | 'RevealStinger'
  | 'MeldCelebration'
  | 'TransitionSwoosh'

export interface PlayOptions {
  volume?: number
  loop?: boolean
  preload?: boolean
  autoplay?: boolean
  mute?: boolean
  rate?: number
}

const CLIP_PATHS: Partial<Record<Clip, string>> = {
  RoundStart: 'audio/round_start/foxboytails-game-start-317318.mp3',
  SubmitClick: 'audio/submit_click/click1.mp3',
  TimerTick: 'audio/timer_tick/timer-preview-switch5.mp3',
  RevealStinger: 'audio/reveal_stinger/mixkit-tile-game-reveal-960.mp3',
  MeldCelebration: 'audio/match_celebration/floraphonic-cute-level-up-1-189852.mp3',
  TransitionSwoosh: 'audio/transition_swoosh/mixkit-fast-transitions-swoosh-3115.mp3',
}

export class Player {
  constructor(private urlBase: string) {
  }

  playSound(clip: Clip, options: PlayOptions = {}): howler.Howl {
      return new howler.Howl({
          src: [this._clipPath(clip)],
          autoplay: true,
          preload: true,
          ...options,
      });
  }

  _clipPath(clip: Clip): string {
      const sub = CLIP_PATHS[clip]
      if (sub) return `${this.urlBase}/${sub}`
      const dashName = clip.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
      return `${this.urlBase}/${dashName}.mp3`
  }
}
