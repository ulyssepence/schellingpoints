import apn from '@parse/node-apn'
import fs from 'fs'
import * as pushTokens from './push-tokens'

const APNS_KEY_PATH = process.env.APNS_KEY_PATH || '/data/schellingpoints/AuthKey.p8'
const APNS_KEY_ID = 'P68Y4GSD5W'
const APNS_TEAM_ID = 'M86QA9WVD2'

let provider: apn.Provider | null = null

export function init() {
  if (!fs.existsSync(APNS_KEY_PATH)) {
    console.warn(`APNs: ${APNS_KEY_PATH} not found — push disabled`)
    return
  }
  provider = new apn.Provider({
    token: { key: APNS_KEY_PATH, keyId: APNS_KEY_ID, teamId: APNS_TEAM_ID },
    production: true,
  })
}

export function sendLobbyJoinNotification(deviceToken: string, gameId: string, joinerName: string) {
  if (!provider) return
  const note = new apn.Notification()
  note.topic = 'app.schellingpoints'
  note.alert = { title: 'Schelling Points', body: `${joinerName} joined your game!` }
  note.sound = 'default'
  note.payload = { gameId }
  provider.send(note, deviceToken).then(res => {
    for (const failure of res.failed) {
      if (failure.response?.reason === 'BadDeviceToken' || failure.response?.reason === 'Unregistered') {
        pushTokens.remove(failure.device)
      }
    }
  })
}
