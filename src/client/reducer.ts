import * as t from './types'

export function onMessage(state: t.State, message: t.ToClientMessage): t.State {
  switch (message.type) {
    case 'LOUNGE':
      return { ...state, view: { type: 'LOUNGE' }, otherPlayers: message.loungingPlayers }

    case 'MEMBER_CHANGE': {
      const viewGameId = 'gameId' in state.view ? state.view.gameId : undefined
      if (message.gameId !== viewGameId) return state
      return { ...state, otherPlayers: message.allPlayers }
    }

    case 'LOBBY_STATE':
      return { ...state, view: { type: 'LOBBY', gameId: message.gameId, isReady: message.isReady }, gameNotFound: false }

    case 'GUESS_STATE':
      return { ...state, view: { type: 'GUESSES', gameId: message.gameId, hasGuessed: message.hasGuessed, prompt: message.prompt, secsLeft: message.secsLeft, round: message.round, totalRounds: message.totalRounds } }

    case 'REVEAL_STATE':
      return { ...state, view: {
        type: 'REVEAL', gameId: message.gameId,
        centroidWord: message.centroidWord,
        centroidIsRepeat: message.centroidIsRepeat,
        positions: message.positions,
        guesses: message.guesses,
        melded: message.melded,
        round: message.round,
        totalRounds: message.totalRounds,
        secsLeft: message.secsLeft,
        isReady: message.isReady,
      }}

    case 'GAME_END':
      return { ...state, view: {
        type: 'GAME_END', gameId: message.gameId,
        melded: message.melded,
        meldRound: message.meldRound,
        centroidHistory: message.centroidHistory,
        playerHistory: message.playerHistory,
      }}

    case 'CONTINUE_PROMPT':
      return { ...state, view: {
        type: 'CONTINUE', gameId: message.gameId,
        centroidHistory: message.centroidHistory,
        playerHistory: message.playerHistory,
      }}

    case 'LOBBY_COUNTDOWN': {
      const isReady = state.view.type === 'LOBBY' ? state.view.isReady : []
      return { ...state, view: { type: 'LOBBY', gameId: message.gameId, isReady, secsLeft: message.secsLeft } }
    }

    case 'SCORING': {
      if (state.view.type !== 'GUESSES' || state.view.gameId !== message.gameId) return state
      return { ...state, view: { ...state.view, scoring: true } }
    }

    case 'CONNECTION_STATUS':
      return { ...state, connected: message.connected }

    case 'NETWORK_STATUS':
      return { ...state, networkOnline: message.online }

    case 'NO_SUCH_GAME':
      return { ...state, view: { type: 'LOUNGE' }, gameNotFound: true }
  }
}
