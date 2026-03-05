#!/usr/bin/env bun
import { spawn, type Subprocess } from 'bun'
import type * as t from '../src/types'
import { existsSync, unlinkSync } from 'fs'

const DB_PATH = `/tmp/schelling-persist-test-${Date.now()}.db`
const PORT = 9877
const WS_URL = `ws://localhost:${PORT}/ws`
const TIMEOUT_MS = 30_000
const GUESSES = ['fork', 'spoon']

type Msg = t.ToClientMessage

class Player {
  id: string
  name: string
  ws!: WebSocket
  gameId: string | null = null
  inbox: Msg[] = []
  private waiters: Array<(msg: Msg) => void> = []

  constructor(i: number) {
    this.id = `persist-${Date.now()}-${i}`
    this.name = `Player${i + 1}`
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)
      this.ws.onopen = () => resolve()
      this.ws.onerror = (e) => reject(e)
      this.ws.onmessage = (e) => {
        const msg: Msg = JSON.parse(String(e.data))
        const waiter = this.waiters.shift()
        if (waiter) waiter(msg)
        else this.inbox.push(msg)
      }
    })
  }

  send(msg: t.ToServerMessage) {
    this.ws.send(JSON.stringify(msg))
  }

  waitFor(type: string, timeoutMs = TIMEOUT_MS): Promise<Msg> {
    const buffered = this.inbox.findIndex((m) => m.type === type)
    if (buffered !== -1) {
      const [msg] = this.inbox.splice(buffered, 1)
      return Promise.resolve(msg)
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name}: timeout waiting for ${type}`)), timeoutMs)
      const check = (msg: Msg) => {
        if (msg.type === type) {
          clearTimeout(timer)
          resolve(msg)
        } else {
          this.inbox.push(msg)
          this.waiters.push(check)
        }
      }
      this.waiters.push(check)
    })
  }

  close() { this.ws.close() }
}

async function startServer(): Promise<Subprocess> {
  const proc = spawn({
    cmd: ['bun', 'run', 'src/server.ts'],
    env: { ...process.env, DB_PATH, PORT: String(PORT) },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  // Wait for server to be ready
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`)
      if (res.ok || res.status === 404) return proc
    } catch {}
    await Bun.sleep(200)
  }
  throw new Error('Server failed to start')
}

async function stopServer(proc: Subprocess) {
  proc.kill('SIGTERM')
  await proc.exited
}

function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    try { unlinkSync(DB_PATH + suffix) } catch {}
  }
}

async function run() {
  // Check Ollama is available
  try {
    await fetch('http://localhost:11434/api/tags')
  } catch {
    console.log('Skipping persistence E2E test: Ollama not available on localhost:11434')
    process.exit(0)
  }

  const step = (s: string) => console.log(`  ✓ ${s}`)
  console.log(`Persistence E2E test: DB=${DB_PATH}\n`)

  // Phase 1: Create game and advance to REVEAL
  let server = await startServer()
  step('Server started (first run)')

  const players = [new Player(0), new Player(1)]
  await Promise.all(players.map(p => p.connect(WS_URL)))
  step('Players connected')

  for (const p of players) {
    p.send({ type: 'JOIN_LOUNGE', playerId: p.id, playerName: p.name, mood: '😀' })
    await p.waitFor('LOUNGE')
  }

  players[0].send({ type: 'NEW_GAME', playerId: players[0].id })
  const lobby = await players[0].waitFor('LOBBY_STATE') as Extract<Msg, { type: 'LOBBY_STATE' }>
  const gameId = lobby.gameId
  step(`Game created: ${gameId}`)

  players[1].send({ type: 'SUBSCRIBE_GAME', gameId, playerId: players[1].id, playerName: players[1].name, mood: '😀' })
  await players[1].waitFor('LOBBY_STATE')

  for (const p of players) {
    p.gameId = gameId
    p.send({ type: 'LOBBY_READY', gameId, playerId: p.id, isReady: true })
  }
  await Promise.all(players.map(p => p.waitFor('GUESS_STATE')))
  step('Game started')

  for (let i = 0; i < players.length; i++) {
    players[i].send({ type: 'GUESS', gameId, playerId: players[i].id, guess: GUESSES[i] })
  }

  const reveals = await Promise.all(players.map(p => p.waitFor('REVEAL_STATE')))
  const reveal = reveals[0] as Extract<Msg, { type: 'REVEAL_STATE' }>
  step(`Scoring complete — centroid: "${reveal.centroidWord}", round: ${reveal.round}`)

  const savedRound = reveal.round
  const savedCentroid = reveal.centroidWord

  // Close WebSockets before stopping
  for (const p of players) p.close()
  await Bun.sleep(500)

  await stopServer(server)
  step('Server stopped (SIGTERM)')

  // Phase 2: Restart and verify state
  server = await startServer()
  step('Server restarted (second run)')

  const reconnected = [new Player(0), new Player(1)]
  reconnected[0].id = players[0].id
  reconnected[0].name = players[0].name
  reconnected[1].id = players[1].id
  reconnected[1].name = players[1].name

  await Promise.all(reconnected.map(p => p.connect(WS_URL)))
  step('Players reconnected')

  for (const p of reconnected) {
    p.send({ type: 'SUBSCRIBE_GAME', gameId, playerId: p.id, playerName: p.name, mood: '😀' })
  }

  const state0 = await reconnected[0].waitFor('REVEAL_STATE') as Extract<Msg, { type: 'REVEAL_STATE' }>
  step(`Restored game state received`)

  if (state0.round !== savedRound) throw new Error(`Round mismatch: ${state0.round} !== ${savedRound}`)
  if (state0.centroidWord !== savedCentroid) throw new Error(`Centroid mismatch: ${state0.centroidWord} !== ${savedCentroid}`)
  step(`Round and centroid match (round=${savedRound}, centroid="${savedCentroid}")`)

  for (const p of reconnected) p.close()
  await stopServer(server)
  cleanup()

  console.log('\nPersistence E2E test passed.')
}

run().catch((err) => {
  console.error('\nPersistence E2E test FAILED:', err.message || err)
  cleanup()
  process.exit(1)
})
