import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

export function onReveal(distance: number, melded: boolean) {
  if (!Capacitor.isNativePlatform()) return
  if (melded) {
    Haptics.notification({ type: NotificationType.Success })
    return
  }
  const style = distance < 0.25 ? ImpactStyle.Heavy
    : distance < 0.5 ? ImpactStyle.Medium
    : ImpactStyle.Light
  Haptics.impact({ style })
}
