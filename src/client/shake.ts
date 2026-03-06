import { Capacitor } from '@capacitor/core'

export function initShake(onShake: () => void) {
  if (!Capacitor.isNativePlatform()) return
  import('@capgo/capacitor-shake').then(({ Shake }) => {
    console.log('[shake] registering listener')
    Shake.addListener('shake', () => {
      console.log('[shake] shake detected')
      onShake()
    })
  }).catch(err => {
    console.error('[shake] failed to load plugin:', err)
  })
}
