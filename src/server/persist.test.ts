import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import * as t from './types'
import * as db from './db'
import * as persist from './persist'
import WebSocket from 'ws'

function mockWs(readyState = WebSocket.OPEN): WebSocket {
  return { readyState, send: () => {} } as unknown as WebSocket
}

function makeGame(players: { id: string }[]): t.Game {
  const game = new t.Game()
  for (const p of players) {
    game.players.push({
      id: p.id,
      name: p.id,
      mood: '😀',
      webSocket: mockWs(),
      previousScoresAndGuesses: [],
    })
  }
  return game
}

let testDbCounter = 0
beforeEach(() => {
  process.env.DB_PATH = `/tmp/schelling-test-${process.pid}-${++testDbCounter}.db`
  db.init()
})

afterEach(() => {
  const path = process.env.DB_PATH
  if (path) {
    try { require('fs').unlinkSync(path) } catch {}
    try { require('fs').unlinkSync(path + '-wal') } catch {}
    try { require('fs').unlinkSync(path + '-shm') } catch {}
  }
})

describe('serialize/deserialize round-trip', () => {
  it('preserves LOBBY phase with Sets', () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.phase = { type: 'LOBBY', isReady: new Set(['a']), secsLeft: 2 }
    game.centroidHistory = ['cat', 'dog']
    game.currentPrompt = 'animals'
    game.previousScores = [{ prompt: 'x', guessesAndScores: [['a', 'cat', 8]] }]
    game.players[0].previousScoresAndGuesses = [[8, 'cat']]

    const json = JSON.stringify(persist.serializeGame(game))
    const restored = persist.deserializeGame(json)!

    expect(restored).not.toBeNull()
    expect(restored.paused).toBe(true)
    expect(restored.scoringInProgress).toBe(false)
    expect(restored.phase.type).toBe('LOBBY')
    if (restored.phase.type === 'LOBBY') {
      expect(restored.phase.isReady).toBeInstanceOf(Set)
      expect(restored.phase.isReady.has('a')).toBe(true)
      expect(restored.phase.secsLeft).toBe(2)
    }
    expect(restored.centroidHistory).toEqual(['cat', 'dog'])
    expect(restored.currentPrompt).toBe('animals')
    expect(restored.previousScores).toEqual(game.previousScores)
    expect(restored.players).toHaveLength(2)
    expect(restored.players[0].webSocket).toBeNull()
    expect(restored.players[0].disconnectedAt).toBeDefined()
    expect(restored.players[0].previousScoresAndGuesses).toEqual([[8, 'cat']])
  })

  it('preserves GUESSES phase with Maps', () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.phase = {
      type: 'GUESSES', round: 2, prompt: 'colors',
      secsLeft: 5, guesses: new Map([['a', 'red']]),
    }

    const json = JSON.stringify(persist.serializeGame(game))
    const restored = persist.deserializeGame(json)!

    expect(restored.phase.type).toBe('GUESSES')
    if (restored.phase.type === 'GUESSES') {
      expect(restored.phase.guesses).toBeInstanceOf(Map)
      expect(restored.phase.guesses.get('a')).toBe('red')
      expect(restored.phase.round).toBe(2)
    }
  })

  it('preserves REVEAL phase', () => {
    const game = makeGame([{ id: 'a' }])
    game.phase = {
      type: 'REVEAL', round: 1, prompt: 'x', secsLeft: 3,
      isReady: new Set(['a']),
      scores: new Map([['a', 10]]),
      positions: new Map([['a', [0.1, 0.2]]]),
      guesses: new Map([['a', 'cat']]),
      centroidWord: 'cat', melded: false,
    }

    const json = JSON.stringify(persist.serializeGame(game))
    const restored = persist.deserializeGame(json)!

    if (restored.phase.type === 'REVEAL') {
      expect(restored.phase.scores.get('a')).toBe(10)
      expect(restored.phase.positions.get('a')).toEqual([0.1, 0.2])
      expect(restored.phase.isReady.has('a')).toBe(true)
      expect(restored.phase.centroidWord).toBe('cat')
    }
  })

  it('preserves CONTINUE phase', () => {
    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.phase = { type: 'CONTINUE', isLeaving: new Set(['a']), isContinuing: new Set(['b']) }

    const json = JSON.stringify(persist.serializeGame(game))
    const restored = persist.deserializeGame(json)!

    if (restored.phase.type === 'CONTINUE') {
      expect(restored.phase.isLeaving.has('a')).toBe(true)
      expect(restored.phase.isContinuing.has('b')).toBe(true)
    }
  })

  it('preserves PLAY_AGAIN phase', () => {
    const game = makeGame([{ id: 'a' }])
    game.phase = {
      type: 'PLAY_AGAIN', isLeaving: new Set(),
      isPlayingAgain: new Set(['a']), melded: true, meldRound: 5,
    }

    const json = JSON.stringify(persist.serializeGame(game))
    const restored = persist.deserializeGame(json)!

    if (restored.phase.type === 'PLAY_AGAIN') {
      expect(restored.phase.melded).toBe(true)
      expect(restored.phase.meldRound).toBe(5)
      expect(restored.phase.isPlayingAgain.has('a')).toBe(true)
    }
  })

  it('returns null for unknown schema version', () => {
    const json = JSON.stringify({ schemaVersion: 999 })
    expect(persist.deserializeGame(json)).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(persist.deserializeGame('not json')).toBeNull()
  })
})

describe('syncAll', () => {
  it('persists games and removes deleted ones', () => {
    const games = new Map<t.GameId, t.Game>()
    const game1 = makeGame([{ id: 'a' }])
    const game2 = makeGame([{ id: 'b' }])
    games.set('g1', game1)
    games.set('g2', game2)

    persist.syncAll(games)

    const rows = db.get().query('SELECT game_id FROM games').all() as { game_id: string }[]
    expect(rows.map(r => r.game_id).sort()).toEqual(['g1', 'g2'])

    games.delete('g1')
    persist.syncAll(games)

    const rows2 = db.get().query('SELECT game_id FROM games').all() as { game_id: string }[]
    expect(rows2.map(r => r.game_id)).toEqual(['g2'])
  })

  it('only writes games whose lastStateChangeAt changed', () => {
    const games = new Map<t.GameId, t.Game>()
    const game = makeGame([{ id: 'a' }])
    games.set('g1', game)

    persist.syncAll(games)
    const row1 = db.get().query('SELECT updated_at FROM games WHERE game_id = ?').get('g1') as { updated_at: number }

    // sync again without changing lastStateChangeAt — updated_at shouldn't change much
    persist.syncAll(games)
    const row2 = db.get().query('SELECT updated_at FROM games WHERE game_id = ?').get('g1') as { updated_at: number }
    expect(row2.updated_at).toBe(row1.updated_at)

    // change lastStateChangeAt
    game.lastStateChangeAt = Date.now() + 1000
    persist.syncAll(games)
    const row3 = db.get().query('SELECT updated_at FROM games WHERE game_id = ?').get('g1') as { updated_at: number }
    expect(row3.updated_at).toBeGreaterThanOrEqual(row2.updated_at)
  })
})

describe('deleteGame', () => {
  it('eagerly removes from DB', () => {
    const games = new Map<t.GameId, t.Game>()
    games.set('g1', makeGame([{ id: 'a' }]))
    persist.syncAll(games)

    persist.deleteGame('g1')

    const row = db.get().query('SELECT game_id FROM games WHERE game_id = ?').get('g1')
    expect(row).toBeNull()
  })
})

describe('loadGames', () => {
  it('restores games as paused with disconnected players', () => {
    const stubVocab = { words: ['cat'], vectors: [[1]], globalCentroid: [0.5] }
    const state = new t.State(
      { choose: () => 'test' } as any,
      [],
      stubVocab,
    )

    const game = makeGame([{ id: 'a' }, { id: 'b' }])
    game.phase = { type: 'GUESSES', round: 1, prompt: 'colors', secsLeft: 5, guesses: new Map([['a', 'red']]) }
    game.centroidHistory = ['dog']
    game.currentPrompt = 'colors'

    const games = new Map<t.GameId, t.Game>()
    games.set('g1', game)
    persist.syncAll(games)

    persist.loadGames(state)

    expect(state.games.size).toBe(1)
    const restored = state.games.get('g1')!
    expect(restored.paused).toBe(true)
    expect(restored.players[0].webSocket).toBeNull()
    expect(restored.players[0].disconnectedAt).toBeDefined()
    expect(restored.centroidHistory).toEqual(['dog'])
    if (restored.phase.type === 'GUESSES') {
      expect(restored.phase.guesses.get('a')).toBe('red')
    }
  })

  it('skips games older than TTL', () => {
    const stubVocab = { words: ['cat'], vectors: [[1]], globalCentroid: [0.5] }
    const state = new t.State(
      { choose: () => 'test' } as any,
      [],
      stubVocab,
    )

    // Insert a stale row directly
    db.get().run(
      'INSERT INTO games (game_id, state_json, updated_at) VALUES (?, ?, ?)',
      ['stale', JSON.stringify(persist.serializeGame(makeGame([{ id: 'a' }]))), Date.now() - persist.DB_TTL_MS - 1000]
    )

    persist.loadGames(state)
    expect(state.games.size).toBe(0)
  })
})

describe('reconnect unpauses', () => {
  it('SUBSCRIBE_GAME unpauses a restored game', () => {
    const { onClientMessage } = require('./play')
    const stubVocab = { words: ['cat'], vectors: [[1]], globalCentroid: [0.5] }
    const state = new t.State(
      { choose: () => 'test' } as any,
      [],
      stubVocab,
    )

    const game = new t.Game()
    game.paused = true
    game.players = [{
      id: 'a', name: 'a', mood: '😀',
      webSocket: null as any,
      previousScoresAndGuesses: [],
      disconnectedAt: Date.now(),
    }]
    state.games.set('g1', game)

    const ws = mockWs()
    onClientMessage(state, {
      type: 'SUBSCRIBE_GAME',
      gameId: 'g1',
      playerId: 'a',
      playerName: 'a',
      mood: '😀',
    }, ws)

    expect(game.paused).toBe(false)
    expect(game.players[0].webSocket).toBe(ws)
    expect(game.players[0].disconnectedAt).toBeUndefined()
  })
})
