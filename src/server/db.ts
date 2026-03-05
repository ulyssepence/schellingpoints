import { Database } from 'bun:sqlite'

let db: Database

export function init() {
  const dbPath = process.env.DB_PATH || 'data/schelling.db'
  db = new Database(dbPath, { create: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      device_token TEXT PRIMARY KEY,
      player_id TEXT NOT NULL
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_push_tokens_player ON push_tokens(player_id)`)
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `)
}

export function get(): Database {
  return db
}
