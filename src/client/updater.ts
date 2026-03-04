import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

let ready = false

export function notifyReady() {
  if (ready) return
  if (!Capacitor.isNativePlatform()) return
  ready = true
  CapacitorUpdater.notifyAppReady()
}
