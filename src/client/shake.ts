import { Capacitor } from '@capacitor/core'

export function initShake(onShake: () => void) {
  if (!Capacitor.isNativePlatform()) return
  import('@capgo/capacitor-shake').then(async ({ Shake }) => {
    await Shake.start({ threshold: 3.5 })
    Shake.addListener('shake', onShake)
  })
}
