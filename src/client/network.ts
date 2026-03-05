import { Network } from '@capacitor/network'
import { Capacitor } from '@capacitor/core'

export function listenNetwork(onStatusChange: (connected: boolean) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}

  const listenerPromise = Network.addListener('networkStatusChange', status => {
    onStatusChange(status.connected)
  })

  Network.getStatus().then(status => onStatusChange(status.connected))

  return () => { listenerPromise.then(h => h.remove()) }
}
