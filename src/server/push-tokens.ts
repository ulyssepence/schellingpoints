import * as db from './db'

export function register(playerId: string, deviceToken: string) {
  db.get().prepare(
    'INSERT OR REPLACE INTO push_tokens (device_token, player_id) VALUES (?, ?)'
  ).run(deviceToken, playerId)
}

export function getTokensForPlayer(playerId: string): string[] {
  const rows = db.get().prepare(
    'SELECT device_token FROM push_tokens WHERE player_id = ?'
  ).all(playerId) as { device_token: string }[]
  return rows.map(r => r.device_token)
}

export function remove(deviceToken: string) {
  db.get().prepare('DELETE FROM push_tokens WHERE device_token = ?').run(deviceToken)
}
