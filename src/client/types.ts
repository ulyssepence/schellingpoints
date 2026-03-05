export * from '../types'
import * as audio from './audio'
import * as mail from './mail'
import * as updater from './updater'
import * as t from '../types'

export type View =
  | { type: 'LOUNGE' }
  | { type: 'LOBBY', gameId: string, isReady: [t.PlayerId, boolean][], secsLeft?: number }
  | { type: 'GUESSES', gameId: string, hasGuessed: [t.PlayerId, boolean][], prompt: string, secsLeft: number, guess?: string, round: number, totalRounds: number, scoring?: boolean }
  | { type: 'REVEAL', gameId: string, isReady: [t.PlayerId, boolean][], secsLeft?: number, centroidWord: string, centroidIsRepeat: boolean, positions: [t.PlayerId, number, number][], guesses: [t.PlayerId, string][], melded: boolean, round: number, totalRounds: number }
  | { type: 'GAME_END', gameId: string, melded: boolean, meldRound: number | null, centroidHistory: string[], playerHistory: [string, string][] }
  | { type: 'CONTINUE', gameId: string, centroidHistory: string[], playerHistory: [string, string][] }

export type State = {
  audioPlayer: audio.Player,
  mailbox: mail.Box,
  view: View,
  otherPlayers: [t.PlayerId, t.PlayerName, t.Mood][],
  playerId: string,
  playerName: string,
  mood: t.Mood,
  connected: boolean,
  networkOnline: boolean,
}

export function initialState(): State {
  const audioPlayer = new audio.Player('/static')
  const apiHost = import.meta.env.API_HOST || window.location.host
  const wsProto = apiHost.startsWith('localhost') ? 'ws' : 'wss'
  const mailbox = new mail.Box(`${wsProto}://${apiHost}/ws`)
  updater.notifyReady()

  const playerId = localStorage.getItem('playerId') ?? crypto.randomUUID()
  const playerName = localStorage.getItem('playerName') ?? ''
  localStorage.setItem('playerId', playerId)

  return {
    audioPlayer,
    mailbox,
    view: { type: 'LOUNGE' },
    otherPlayers: [],
    playerId,
    playerName,
    mood: (localStorage.getItem('mood') as t.Mood) ?? '😀',
    connected: false,
    networkOnline: true,
  }
}
