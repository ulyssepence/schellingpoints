import { Capacitor } from '@capacitor/core'

export function initShake(onShake: () => void) {
  if (!Capacitor.isNativePlatform()) return
  import('@capgo/capacitor-shake').then(({ Shake }) => {
    Shake.addListener('shake', onShake)
  })
}
