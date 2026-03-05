import { Database } from 'bun:sqlite'

const DB_PATH = process.env.DB_PATH || 'data/schelling.db'

let db: Database

export function init() {
  db = new Database(DB_PATH, { create: true })
  db.run('PRAGMA journal_mode = WAL')
  db.run(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      device_token TEXT PRIMARY KEY,
      player_id TEXT NOT NULL
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_push_tokens_player ON push_tokens(player_id)`)
}

export function get(): Database {
  return db
}
