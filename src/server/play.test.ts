import { describe, it, expect, vi, beforeEach } from 'bun:test'
import WebSocket from 'ws'
import * as t from './types'
import * as scoring from './scoring'
import { onTickGame, onClientMessage, currentGameState, isCullable, startReaper, checkPlayAgainVotes, onPlayerDisconnect, removeDisconnectedPlayer, DISCONNECT_GRACE_MS, endGame } from './play'

function mockWs(readyState = WebSocket.OPEN): WebSocket {
  return { readyState, send: vi.fn() } as unknown as WebSocket
}

const stubVocab = { words: ['cat', 'dog'], vectors: [[1], [0]], globalCentroid: [0.5] }

function makeGame(players: { id: string, ws?: WebSocket }[]): t.Game {
  const game = new t.Game()
  for (const p of players) {
    game.players.push({
      id: p.id,
      name: p.id,
      mood: '😀',
      webSocket: p.ws ?? mockWs(),
      previousScoresAndGuesses: [],
    })
  }
  return game
}

function makeState(games?: [string, t.Game][]): t.State {
  const state = new t.State(
    { choose: () => 'test' } as any,
    categories,
    stubVocab,
  )
  if (games) {
    for (const [id, game] of games) {
      state.games.set(id, game)
    }
  }
  return state
}

function guessPhase(guesses: [string, string][] = []): t.Phase {
  const phase: t.Phase = {
    type: 'GUESSES',
    round: 0,
    prompt: 'animals',
    secsLeft: 10,
    guesses: new Map(guesses),
  }
  return phase
}

const stubScoring: scoring.ScoringResult = {
  scores: new Map([['a', 8], ['b', 6]]),
  positions: new Map([['a', [0.1, 0.2]], ['b', [-0.1, -0.2]]]),
  centroidWord: 'cat',
}

vi.spyOn(scoring, 'scoreGuesses').mockResolvedValue(stubScoring)

const categories: t.Category[] = [
  { id: 1, prompt: 'animals', difficulty: 'easy' },
]

describe('scoreRound via timer', () => {
  it('transitions to REVEAL when timer hits 0', async () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.currentPrompt = 'animals'
    game.phase = guessPhase([['a', 'cat'], ['b', 'dog']])
    ;(game.phase as any).secsLeft = 0

    const state = makeState([['test-game', game]])
    onTickGame('test-game', game, 0, 1, state)

    // scoreRound is async — wait for it
    await new Promise(r => setTimeout(r, 10))

    expect(game.phase.type).toBe('REVEAL')
    expect(game.scoringInProgress).toBe(false)
    if (game.phase.type === 'REVEAL') {
      expect(game.phase.scores.get('a')).toBe(8)
      expect(game.phase.scores.get('b')).toBe(6)
      expect(game.phase.guesses.get('a')).toBe('cat')
    }
    expect(game.previousScores).toHaveLength(1)
    expect(game.previousScores[0].prompt).toBe('animals')
    expect(game.players[0].previousScoresAndGuesses).toEqual([[8, 'cat']])
    expect(game.players[1].previousScoresAndGuesses).toEqual([[6, 'dog']])
  })
})

describe('scoreRound via all guesses submitted', () => {
  it('scores immediately when all live players have guessed', async () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.currentPrompt = 'animals'
    game.phase = guessPhase([['a', 'cat']])

    const state = makeState([['test-game', game]])

    onClientMessage(state, {
      type: 'GUESS',
      gameId: 'test-game',
      playerId: 'b',
      guess: 'dog',
    }, mockWs())

    await new Promise(r => setTimeout(r, 10))

    expect(game.phase.type).toBe('REVEAL')
    if (game.phase.type === 'REVEAL') {
      expect(game.phase.scores.get('a')).toBe(8)
      expect(game.phase.guesses.get('b')).toBe('dog')
    }
  })

  it('does NOT score when some players have not guessed', () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    game.phase = guessPhase()

    const state = makeState([['test-game', game]])

    onClientMessage(state, {
      type: 'GUESS',
      gameId: 'test-game',
      playerId: 'a',
      guess: 'cat',
    }, mockWs())

    expect(game.phase.type).toBe('GUESSES')
  })

  it('ignores disconnected players for all-guessed check', async () => {
    const closedWs = mockWs(WebSocket.CLOSED)
    const game = makeGame([{ id: 'a' }, { id: 'b' }, { id: 'c', ws: closedWs }])
    game.currentPrompt = 'animals'
    game.phase = guessPhase([['a', 'cat']])

    const state = makeState([['test-game', game]])

    onClientMessage(state, {
      type: 'GUESS',
      gameId: 'test-game',
      playerId: 'b',
      guess: 'dog',
    }, mockWs())

    await new Promise(r => setTimeout(r, 10))

    expect(game.phase.type).toBe('REVEAL')
  })
})

const GAME_TTL_MS = 24 * 60 * 60 * 1000

describe('game culling', () => {
  it('isCullable returns true for games older than 24h', () => {
    const game = makeGame([{ id: 'a' }])
    game.lastStateChangeAt = Date.now() - GAME_TTL_MS - 3600_000
    expect(isCullable(game, Date.now())).toBe(true)
  })

  it('isCullable returns false for games younger than 24h', () => {
    const game = makeGame([{ id: 'a' }])
    game.lastStateChangeAt = Date.now() - GAME_TTL_MS + 3600_000
    expect(isCullable(game, Date.now())).toBe(false)
  })

  it('reaper deletes stale games and terminates sockets', () => {
    const ws = mockWs()
    ;(ws as any).terminate = vi.fn()
    const game = makeGame([{ id: 'a', ws }])
    game.lastStateChangeAt = Date.now() - GAME_TTL_MS - 1000
    const state = makeState([['stale-game', game]])

    const now = Date.now()
    for (const [gameId, g] of state.games) {
      if (isCullable(g, now)) {
        for (const p of g.players) (p.webSocket as any).terminate()
        state.games.delete(gameId)
      }
    }

    expect(state.games.size).toBe(0)
    expect((ws as any).terminate).toHaveBeenCalled()
  })

  it('phase transition resets lastStateChangeAt', async () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.currentPrompt = 'animals'
    game.phase = guessPhase([['a', 'cat'], ['b', 'dog']])
    ;(game.phase as any).secsLeft = 0
    game.lastStateChangeAt = Date.now() - GAME_TTL_MS - 1000

    const state = makeState([['test-game', game]])
    onTickGame('test-game', game, 0, 1, state)
    await new Promise(r => setTimeout(r, 10))

    expect(game.phase.type).toBe('REVEAL')
    expect(Date.now() - game.lastStateChangeAt).toBeLessThan(5000)
  })

  it('startReaper culls expired games on its interval', async () => {
    const TTL = 200
    const INTERVAL = 50

    const ws = mockWs()
    ;(ws as any).terminate = vi.fn()
    const staleGame = makeGame([{ id: 'a', ws }])
    staleGame.lastStateChangeAt = Date.now() - TTL - 100

    const freshGame = makeGame([{ id: 'b' }])

    const state = makeState([['stale', staleGame], ['fresh', freshGame]])

    const timer = startReaper(state, { ttlMs: TTL, intervalMs: INTERVAL })
    try {
      await new Promise(r => setTimeout(r, INTERVAL * 3))
      expect(state.games.has('stale')).toBe(false)
      expect(state.games.has('fresh')).toBe(true)
      expect((ws as any).terminate).toHaveBeenCalled()
    } finally {
      clearInterval(timer)
    }
  })
})

function playAgainPhase(melded = true, meldRound: number | null = 3): t.Phase {
  return {
    type: 'PLAY_AGAIN',
    isLeaving: new Set(),
    isPlayingAgain: new Set(),
    melded,
    meldRound,
  }
}

describe('play again voting', () => {
  it('all vote yes → resets game to LOBBY and broadcasts LOBBY_STATE', () => {
    const wsA = mockWs()
    const wsB = mockWs()
    const game = makeGame([{ id: 'a', ws: wsA }, { id: 'b', ws: wsB }])
    game.phase = playAgainPhase()
    game.previousScores = [{ prompt: 'x', guessesAndScores: [] }]
    game.centroidHistory = ['cat', 'dog']
    game.players[0].previousScoresAndGuesses = [[5, 'cat']]
    const state = makeState([['g', game]])

    onClientMessage(state, { type: 'PLAY_AGAIN_VOTE', gameId: 'g', playerId: 'a', playAgain: true }, mockWs())
    expect(game.phase.type).toBe('PLAY_AGAIN')

    onClientMessage(state, { type: 'PLAY_AGAIN_VOTE', gameId: 'g', playerId: 'b', playAgain: true }, mockWs())
    expect(game.phase.type).toBe('LOBBY')
    expect(game.previousScores).toEqual([])
    expect(game.centroidHistory).toEqual([])
    expect(game.players[0].previousScoresAndGuesses).toEqual([])
    expect(state.games.has('g')).toBe(true)

    const sendsA = (wsA.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const sendsB = (wsB.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    expect(sendsA.some((m: any) => m.type === 'LOBBY_STATE')).toBe(true)
    expect(sendsB.some((m: any) => m.type === 'LOBBY_STATE')).toBe(true)
  })

  it('vote leave + remaining player votes play again → transitions to LOBBY', () => {
    const wsA = mockWs()
    const wsB = mockWs()
    const game = makeGame([{ id: 'a', ws: wsA }, { id: 'b', ws: wsB }])
    game.phase = playAgainPhase()
    game.previousScores = [{ prompt: 'x', guessesAndScores: [] }]
    game.centroidHistory = ['cat']
    const state = makeState([['g', game]])

    onClientMessage(state, { type: 'PLAY_AGAIN_VOTE', gameId: 'g', playerId: 'a', playAgain: false }, mockWs())
    expect(state.lounge.has('a')).toBe(true)
    expect(game.players).toHaveLength(1)

    onClientMessage(state, { type: 'PLAY_AGAIN_VOTE', gameId: 'g', playerId: 'b', playAgain: true }, mockWs())
    expect(game.phase.type).toBe('LOBBY')
    expect(state.games.has('g')).toBe(true)
    expect(game.previousScores).toEqual([])
    expect(game.centroidHistory).toEqual([])
  })

  it('disconnect during PLAY_AGAIN sets grace period, reaper removal counts as leaving', () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
    game.phase = playAgainPhase()
    const state = makeState([['g', game]])

    onPlayerDisconnect('c', 'g', game, state)
    expect(game.players).toHaveLength(3)
    expect(game.players.find(p => p.id === 'c')!.disconnectedAt).toBeDefined()

    // Simulate reaper removing the expired player
    removeDisconnectedPlayer('c', 'g', game, state)
    expect(game.players).toHaveLength(2)

    onClientMessage(state, { type: 'PLAY_AGAIN_VOTE', gameId: 'g', playerId: 'a', playAgain: true }, mockWs())
    onClientMessage(state, { type: 'PLAY_AGAIN_VOTE', gameId: 'g', playerId: 'b', playAgain: true }, mockWs())
    expect(game.phase.type).toBe('LOBBY')
  })

  it('meld triggers PLAY_AGAIN instead of endGame', async () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.currentPrompt = 'animals'
    game.phase = {
      type: 'REVEAL',
      round: 5,
      prompt: 'animals',
      secsLeft: 0,
      isReady: new Set(),
      scores: new Map([['a', 10], ['b', 10]]),
      positions: new Map([['a', [0, 0]], ['b', [0, 0]]]),
      guesses: new Map([['a', 'cat'], ['b', 'cat']]),
      centroidWord: 'cat',
      melded: true,
    }
    game.centroidHistory = ['dog', 'cat']
    const state = makeState([['g', game]])

    onTickGame('g', game, 0, 1, state)
    expect(game.phase.type).toBe('PLAY_AGAIN')
    if (game.phase.type === 'PLAY_AGAIN') {
      expect(game.phase.melded).toBe(true)
      expect(game.phase.meldRound).toBe(5)
    }
    expect(state.games.has('g')).toBe(true)
  })
})

describe('disconnect grace period', () => {
  it('disconnect sets disconnectedAt, player stays in game.players', () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    const state = makeState([['g', game]])

    onPlayerDisconnect('a', 'g', game, state)

    expect(game.players).toHaveLength(2)
    const player = game.players.find(p => p.id === 'a')!
    expect(player.disconnectedAt).toBeDefined()
    expect(Date.now() - player.disconnectedAt!).toBeLessThan(1000)
  })

  it('race guard: disconnect after socket already replaced is a no-op', () => {
    const oldWs = mockWs()
    const newWs = mockWs()
    const game = makeGame([{ id: 'a', ws: newWs }, { id: 'b' }])
    const state = makeState([['g', game]])

    onPlayerDisconnect('a', 'g', game, state, oldWs)

    const player = game.players.find(p => p.id === 'a')!
    expect(player.disconnectedAt).toBeUndefined()
  })

  it('reconnect during grace period clears disconnectedAt', () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.players[0].disconnectedAt = Date.now()
    const state = makeState([['g', game]])

    const newWs = mockWs()
    onClientMessage(state, {
      type: 'SUBSCRIBE_GAME',
      gameId: 'g',
      playerId: 'a',
      playerName: 'a',
      mood: '😀',
    }, newWs)

    const player = game.players.find(p => p.id === 'a')!
    expect(player.disconnectedAt).toBeUndefined()
    expect(player.webSocket).toBe(newWs)
  })

  it('reaper sweeps expired disconnected players', async () => {
    const TTL = 60_000
    const INTERVAL = 50

    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.players[0].disconnectedAt = Date.now() - DISCONNECT_GRACE_MS - 1000
    const state = makeState([['g', game]])

    const timer = startReaper(state, { ttlMs: TTL, intervalMs: INTERVAL })
    try {
      await new Promise(r => setTimeout(r, INTERVAL * 3))
      expect(game.players).toHaveLength(1)
      expect(game.players[0].id).toBe('b')
    } finally {
      clearInterval(timer)
    }
  })

  it('reaper leaves non-expired disconnected players alone', async () => {
    const TTL = 60_000
    const INTERVAL = 50

    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.players[0].disconnectedAt = Date.now() - 1000
    const state = makeState([['g', game]])

    const timer = startReaper(state, { ttlMs: TTL, intervalMs: INTERVAL })
    try {
      await new Promise(r => setTimeout(r, INTERVAL * 3))
      expect(game.players).toHaveLength(2)
    } finally {
      clearInterval(timer)
    }
  })

  it('reaper + GUESSES: expired disconnect triggers all-guessed check', async () => {
    const closedWs = mockWs(WebSocket.CLOSED)
    const game = makeGame([{ id: 'a' }, { id: 'b', ws: closedWs }])
    game.currentPrompt = 'animals'
    game.phase = guessPhase([['a', 'cat']])
    game.players[1].disconnectedAt = Date.now() - DISCONNECT_GRACE_MS - 1000
    const state = makeState([['g', game]])

    removeDisconnectedPlayer('b', 'g', game, state)

    await new Promise(r => setTimeout(r, 10))

    expect(game.phase.type).toBe('REVEAL')
    expect(game.players).toHaveLength(1)
  })

  it('reaper + CONTINUE: expired disconnect adds to isLeaving', () => {
    const closedWs = mockWs(WebSocket.CLOSED)
    const game = makeGame([{ id: 'a' }, { id: 'b' }, { id: 'c', ws: closedWs }])
    game.phase = {
      type: 'CONTINUE',
      isLeaving: new Set(),
      isContinuing: new Set(),
    }
    game.players[2].disconnectedAt = Date.now() - DISCONNECT_GRACE_MS - 1000
    const state = makeState([['g', game]])

    removeDisconnectedPlayer('c', 'g', game, state)

    expect(game.players).toHaveLength(2)
    if (game.phase.type === 'CONTINUE') {
      expect(game.phase.isLeaving.has('c')).toBe(true)
    }
  })

  it('reaper + already deleted game does not crash', async () => {
    const TTL = 60_000
    const INTERVAL = 50

    const game = makeGame([{ id: 'a' }])
    game.players[0].disconnectedAt = Date.now() - DISCONNECT_GRACE_MS - 1000
    const state = makeState([['g', game]])

    state.games.delete('g')

    const timer = startReaper(state, { ttlMs: TTL, intervalMs: INTERVAL })
    try {
      await new Promise(r => setTimeout(r, INTERVAL * 3))
      expect(state.games.size).toBe(0)
    } finally {
      clearInterval(timer)
    }
  })
})

describe('NEW_GAME (bug 4)', () => {
  it('removes player from lounge and broadcasts member change', () => {
    const ws = mockWs()
    const state = makeState()
    state.lounge.set('a', { name: 'Alice', mood: '😀', webSocket: ws })

    onClientMessage(state, { type: 'NEW_GAME', playerId: 'a' }, ws)

    expect(state.lounge.has('a')).toBe(false)
    expect(state.games.size).toBe(1)

    const [, game] = [...state.games.entries()][0]
    expect(game.players).toHaveLength(1)
    expect(game.players[0].id).toBe('a')

    const sends = (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const memberChange = sends.find((m: any) => m.type === 'MEMBER_CHANGE')
    expect(memberChange).toBeDefined()
    expect(memberChange.allPlayers).toHaveLength(1)
  })
})

describe('LEAVE_GAME (bug 2)', () => {
  it('returns player to lounge from LOBBY', () => {
    const wsA = mockWs()
    const wsB = mockWs()
    const game = makeGame([{ id: 'a', ws: wsA }, { id: 'b', ws: wsB }])
    const state = makeState([['g', game]])

    onClientMessage(state, { type: 'LEAVE_GAME', gameId: 'g', playerId: 'a' }, wsA)

    expect(state.lounge.has('a')).toBe(true)
    expect(game.players).toHaveLength(1)
    expect(game.players[0].id).toBe('b')

    const sends = (wsA.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const lounge = sends.find((m: any) => m.type === 'LOUNGE')
    expect(lounge).toBeDefined()
  })

  it('deletes game when last player leaves', () => {
    const ws = mockWs()
    const game = makeGame([{ id: 'a', ws }])
    const state = makeState([['g', game]])

    onClientMessage(state, { type: 'LEAVE_GAME', gameId: 'g', playerId: 'a' }, ws)

    expect(state.games.has('g')).toBe(false)
    expect(state.lounge.has('a')).toBe(true)
  })

  it('ends game when 1 player remains in non-LOBBY phase', () => {
    const wsA = mockWs()
    const wsB = mockWs()
    const game = makeGame([{ id: 'a', ws: wsA }, { id: 'b', ws: wsB }])
    game.currentPrompt = 'animals'
    game.phase = guessPhase([['a', 'cat'], ['b', 'dog']])
    const state = makeState([['g', game]])

    onClientMessage(state, { type: 'LEAVE_GAME', gameId: 'g', playerId: 'a' }, wsA)

    expect(state.games.has('g')).toBe(false)
    expect(state.lounge.has('a')).toBe(true)
    expect(state.lounge.has('b')).toBe(true)
  })

  it('no-op for nonexistent game', () => {
    const ws = mockWs()
    const state = makeState()
    onClientMessage(state, { type: 'LEAVE_GAME', gameId: 'nope', playerId: 'a' }, ws)
    expect(state.games.size).toBe(0)
  })
})

describe('client reducer: LOBBY_STATE preserves otherPlayers', () => {
  it('spread preserves otherPlayers from previous state', async () => {
    const { onMessage } = await import('../client/reducer')
    const state = {
      audioPlayer: {} as any,
      mailbox: {} as any,
      view: { type: 'LOUNGE' as const },
      otherPlayers: [['a', 'Alice', '😀']] as [string, string, string][],
      playerId: 'b',
      playerName: 'Bob',
      mood: '😀' as const,
      connected: true,
      networkOnline: true,
    }

    const next = onMessage(state, {
      type: 'LOBBY_STATE',
      gameId: 'g',
      isReady: [],
    })

    expect(next.otherPlayers).toEqual([['a', 'Alice', '😀']])
    expect(next.view.type).toBe('LOBBY')
  })
})

describe('SUBSCRIBE_GAME sends NO_SUCH_GAME (bug 1)', () => {
  it('sends NO_SUCH_GAME when game does not exist', () => {
    const ws = mockWs()
    const state = makeState()

    onClientMessage(state, {
      type: 'SUBSCRIBE_GAME',
      gameId: 'nonexistent',
      playerId: 'a',
      playerName: 'Alice',
      mood: '😀',
    }, ws)

    const sends = (ws.send as any).mock.calls.map((c: any) => JSON.parse(c[0]))
    const noSuch = sends.find((m: any) => m.type === 'NO_SUCH_GAME')
    expect(noSuch).toBeDefined()
    expect(noSuch.gameId).toBe('nonexistent')
    expect(state.lounge.has('a')).toBe(true)
  })
})
