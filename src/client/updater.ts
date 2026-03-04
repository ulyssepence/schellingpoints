import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'

let ready = false

export function notifyReady() {
  if (ready) return
  if (!Capacitor.isNativePlatform()) return
  ready = true
  CapacitorUpdater.notifyAppReady()
}

export async function applyPendingUpdate() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const next = await CapacitorUpdater.getNextBundle()
    if (!next) return
    await CapacitorUpdater.reload()
  } catch {}
}
