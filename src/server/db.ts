import Database from 'better-sqlite3'

const DB_PATH = process.env.DB_PATH || '/data/schellingpoints/schelling.db'

let db: Database.Database

export function init() {
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      device_token TEXT PRIMARY KEY,
      player_id TEXT NOT NULL
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_push_tokens_player ON push_tokens(player_id)`)
}

export function get(): Database.Database {
  return db
}
