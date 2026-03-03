#!/usr/bin/env bun
import type * as t from '../src/types'

const URL = process.argv[2] || 'ws://localhost:8000/ws'
const N_PLAYERS = Number(process.argv[3]) || 3
const GUESSES = ['fork', 'spoon', 'knife', 'plate', 'bowl', 'cup', 'pan', 'pot']
const TIMEOUT_MS = 30_000

type Msg = t.ToClientMessage

class Player {
  id: string
  name: string
  ws!: WebSocket
  gameId: string | null = null
  inbox: Msg[] = []
  private waiters: Array<(msg: Msg) => void> = []

  constructor(i: number) {
    this.id = `smoke-${Date.now()}-${i}`
    this.name = `Smokey${i + 1}`
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)
      this.ws.onopen = () => resolve()
      this.ws.onerror = (e) => reject(e)
      this.ws.onmessage = (e) => {
        const msg: Msg = JSON.parse(String(e.data))
        const waiter = this.waiters.find(() => true)
        if (waiter) {
          this.waiters.shift()
          waiter(msg)
        } else {
          this.inbox.push(msg)
        }
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

  close() {
    this.ws.close()
  }
}

async function run() {
  const players = Array.from({ length: N_PLAYERS }, (_, i) => new Player(i))
  const step = (s: string) => console.log(`  ✓ ${s}`)

  console.log(`Smoke test: ${N_PLAYERS} players → ${URL}\n`)

  await Promise.all(players.map((p) => p.connect(URL)))
  step('All WebSockets connected')

  for (const p of players) {
    p.send({ type: 'JOIN_LOUNGE', playerId: p.id, playerName: p.name, mood: '😀' })
    await p.waitFor('LOUNGE')
  }
  step('All players in lounge')

  const host = players[0]
  host.send({ type: 'NEW_GAME', playerId: host.id })
  const lobby = await host.waitFor('LOBBY_STATE') as Extract<Msg, { type: 'LOBBY_STATE' }>
  const gameId = lobby.gameId
  step(`Game created: ${gameId}`)

  for (const p of players.slice(1)) {
    p.send({ type: 'SUBSCRIBE_GAME', gameId, playerId: p.id, playerName: p.name, mood: '😀' })
    await p.waitFor('LOBBY_STATE')
  }
  step('All players joined game')

  for (const p of players) {
    p.gameId = gameId
    p.send({ type: 'LOBBY_READY', gameId, playerId: p.id, isReady: true })
  }

  await Promise.all(players.map((p) => p.waitFor('GUESS_STATE')))
  step('Game started — round 1')

  for (let i = 0; i < players.length; i++) {
    const p = players[i]
    p.send({ type: 'GUESS', gameId, playerId: p.id, guess: GUESSES[i % GUESSES.length] })
  }
  step('All guesses submitted')

  const reveals = await Promise.all(players.map((p) => p.waitFor('REVEAL_STATE')))
  const reveal = reveals[0] as Extract<Msg, { type: 'REVEAL_STATE' }>
  step(`Scoring complete — centroid: "${reveal.centroidWord}", positions: ${reveal.positions.length}`)

  for (const p of players) p.close()
  console.log('\nSmoke test passed.')
}

run().catch((err) => {
  console.error('\nSmoke test FAILED:', err.message)
  process.exit(1)
})
