import * as t from './types'
import * as db from './db'

const SCHEMA_VERSION = 1
const PERSIST_INTERVAL_SECS = 5
const DB_TTL_MS = 24 * 60 * 60 * 1000

export { PERSIST_INTERVAL_SECS, DB_TTL_MS }

interface SerializedPlayer {
  id: t.PlayerId
  name: t.PlayerName
  mood: t.Mood
  previousScoresAndGuesses: [number, string][]
  disconnectedAt?: number
}

interface SerializedPhase {
  type: string
  round?: number
  prompt?: string
  secsLeft?: number
  guesses?: [string, string][]
  isReady?: string[]
  scores?: [string, number][]
  positions?: [string, [number, number]][]
  centroidWord?: string
  melded?: boolean
  isLeaving?: string[]
  isContinuing?: string[]
  isPlayingAgain?: string[]
  meldRound?: number | null
}

interface SerializedGame {
  schemaVersion: number
  phase: SerializedPhase
  previousScores: t.RoundScore[]
  centroidHistory: string[]
  currentPrompt: string
  scoringRetries: number
  lastStateChangeAt: number
  players: SerializedPlayer[]
}

function serializePhase(phase: t.Phase): SerializedPhase {
  switch (phase.type) {
    case 'LOBBY':
      return {
        type: 'LOBBY',
        secsLeft: phase.secsLeft,
        isReady: [...phase.isReady],
      }
    case 'GUESSES':
      return {
        type: 'GUESSES',
        round: phase.round,
        prompt: phase.prompt,
        secsLeft: phase.secsLeft,
        guesses: [...phase.guesses.entries()],
      }
    case 'REVEAL':
      return {
        type: 'REVEAL',
        round: phase.round,
        prompt: phase.prompt,
        secsLeft: phase.secsLeft,
        isReady: [...phase.isReady],
        scores: [...phase.scores.entries()],
        positions: [...phase.positions.entries()],
        guesses: [...phase.guesses.entries()],
        centroidWord: phase.centroidWord,
        melded: phase.melded,
      }
    case 'CONTINUE':
      return {
        type: 'CONTINUE',
        isLeaving: [...phase.isLeaving],
        isContinuing: [...phase.isContinuing],
      }
    case 'PLAY_AGAIN':
      return {
        type: 'PLAY_AGAIN',
        isLeaving: [...phase.isLeaving],
        isPlayingAgain: [...phase.isPlayingAgain],
        melded: phase.melded,
        meldRound: phase.meldRound,
      }
  }
}

function deserializePhase(s: SerializedPhase): t.Phase {
  switch (s.type) {
    case 'LOBBY':
      return {
        type: 'LOBBY',
        secsLeft: s.secsLeft,
        isReady: new Set(s.isReady ?? []),
      }
    case 'GUESSES':
      return {
        type: 'GUESSES',
        round: s.round!,
        prompt: s.prompt!,
        secsLeft: s.secsLeft!,
        guesses: new Map(s.guesses ?? []),
      }
    case 'REVEAL':
      return {
        type: 'REVEAL',
        round: s.round!,
        prompt: s.prompt!,
        secsLeft: s.secsLeft!,
        isReady: new Set(s.isReady ?? []),
        scores: new Map(s.scores ?? []),
        positions: new Map(s.positions ?? []),
        guesses: new Map(s.guesses ?? []),
        centroidWord: s.centroidWord!,
        melded: s.melded!,
      }
    case 'CONTINUE':
      return {
        type: 'CONTINUE',
        isLeaving: new Set(s.isLeaving ?? []),
        isContinuing: new Set(s.isContinuing ?? []),
      }
    case 'PLAY_AGAIN':
      return {
        type: 'PLAY_AGAIN',
        isLeaving: new Set(s.isLeaving ?? []),
        isPlayingAgain: new Set(s.isPlayingAgain ?? []),
        melded: s.melded!,
        meldRound: s.meldRound ?? null,
      }
    default:
      throw new Error(`Unknown phase type: ${s.type}`)
  }
}

export function serializeGame(game: t.Game): SerializedGame {
  return {
    schemaVersion: SCHEMA_VERSION,
    phase: serializePhase(game.phase),
    previousScores: game.previousScores,
    centroidHistory: [...game.centroidHistory],
    currentPrompt: game.currentPrompt,
    scoringRetries: game.scoringRetries,
    lastStateChangeAt: game.lastStateChangeAt,
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      mood: p.mood,
      previousScoresAndGuesses: [...p.previousScoresAndGuesses],
    })),
  }
}

export function deserializeGame(json: string): t.Game | null {
  let data: SerializedGame
  try {
    data = JSON.parse(json)
  } catch {
    return null
  }

  if (data.schemaVersion !== SCHEMA_VERSION) return null

  const game = new t.Game()
  game.phase = deserializePhase(data.phase)
  game.previousScores = data.previousScores
  game.centroidHistory = data.centroidHistory
  game.currentPrompt = data.currentPrompt
  game.scoringRetries = data.scoringRetries
  game.lastStateChangeAt = data.lastStateChangeAt
  game.paused = true
  game.players = data.players.map(p => ({
    id: p.id,
    name: p.name,
    mood: p.mood,
    webSocket: null as any,
    previousScoresAndGuesses: p.previousScoresAndGuesses,
    disconnectedAt: Date.now(),
  }))

  return game
}

const lastPersistedAt = new Map<t.GameId, number>()

export function syncAll(games: Map<t.GameId, t.Game>) {
  const d = db.get()
  if (!d) return
  const insertStmt = d.prepare(
    'INSERT OR REPLACE INTO games (game_id, state_json, updated_at) VALUES (?, ?, ?)'
  )
  const deleteStmt = d.prepare('DELETE FROM games WHERE game_id = ?')

  const tx = d.transaction(() => {
    for (const [gameId, game] of games) {
      const last = lastPersistedAt.get(gameId)
      if (last !== game.lastStateChangeAt) {
        insertStmt.run(gameId, JSON.stringify(serializeGame(game)), Date.now())
        lastPersistedAt.set(gameId, game.lastStateChangeAt)
      }
    }

    for (const gameId of lastPersistedAt.keys()) {
      if (!games.has(gameId)) {
        deleteStmt.run(gameId)
        lastPersistedAt.delete(gameId)
      }
    }
  })
  tx()
}

export function deleteGame(gameId: t.GameId) {
  lastPersistedAt.delete(gameId)
  const d = db.get()
  if (!d) return
  try {
    d.run('DELETE FROM games WHERE game_id = ?', [gameId])
  } catch (err) {
    console.error('persist.deleteGame failed:', err)
  }
}

export function loadGames(state: t.State) {
  const d = db.get()
  if (!d) return
  const cutoff = Date.now() - DB_TTL_MS
  const rows = d.query(
    'SELECT game_id, state_json, updated_at FROM games WHERE updated_at > ?'
  ).all(cutoff) as { game_id: string, state_json: string, updated_at: number }[]

  for (const row of rows) {
    const game = deserializeGame(row.state_json)
    if (!game) continue
    state.games.set(row.game_id, game)
    lastPersistedAt.set(row.game_id, game.lastStateChangeAt)
  }

  console.log(`Restored ${state.games.size} game(s) from DB`)
}

export function cleanupStaleRows() {
  const d = db.get()
  if (!d) return
  const cutoff = Date.now() - DB_TTL_MS
  try {
    d.run('DELETE FROM games WHERE updated_at < ?', [cutoff])
  } catch (err) {
    console.error('persist.cleanupStaleRows failed:', err)
  }
}
