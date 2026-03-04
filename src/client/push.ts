import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import * as mail from './mail'

let pendingGameId: string | null = null

export function getPendingGameId(): string | null {
  const id = pendingGameId
  pendingGameId = null
  return id
}

export function register(mailbox: mail.Box, playerId: string) {
  if (!Capacitor.isNativePlatform()) return

  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    const gameId = action.notification.data?.gameId
    if (!gameId) return
    if (document.visibilityState === 'visible') {
      history.pushState(null, '', `/game/${gameId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    } else {
      pendingGameId = gameId
    }
  })

  PushNotifications.requestPermissions().then(result => {
    if (result.receive !== 'granted') return
    PushNotifications.register()
  })

  PushNotifications.addListener('registration', token => {
    mailbox.send({
      type: 'REGISTER_PUSH_TOKEN',
      playerId,
      deviceToken: token.value,
    })
  })
}
