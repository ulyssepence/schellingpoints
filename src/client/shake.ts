const THRESHOLD = 30
const COOLDOWN = 1000

let listening = false
let onShakeCallback: (() => void) | null = null

function startListening() {
  if (listening) return
  listening = true
  console.log('[shake] listening for devicemotion')
  let lastX = 0, lastY = 0, lastZ = 0
  let last = 0
  let eventCount = 0

  window.addEventListener('devicemotion', (e) => {
    if (eventCount++ < 3) console.log('[shake] got devicemotion event', e.accelerationIncludingGravity)
    const acc = e.accelerationIncludingGravity
    if (!acc || acc.x == null || acc.y == null || acc.z == null) return

    const dx = Math.abs(acc.x - lastX)
    const dy = Math.abs(acc.y - lastY)
    const dz = Math.abs(acc.z - lastZ)
    lastX = acc.x; lastY = acc.y; lastZ = acc.z

    if (dx + dy + dz > THRESHOLD) {
      const now = Date.now()
      if (now - last > COOLDOWN) {
        last = now
        console.log('[shake] shake detected!')
        onShakeCallback?.()
      }
    }
  })
}

export function initShake(onShake: () => void) {
  onShakeCallback = onShake

  const dme = DeviceMotionEvent as any
  const needsPermission = typeof dme.requestPermission === 'function'
  console.log('[shake] init, needsPermission:', needsPermission)
  if (!needsPermission) {
    startListening()
  }
}

export async function requestShakePermission() {
  const dme = DeviceMotionEvent as any
  if (typeof dme.requestPermission === 'function') {
    console.log('[shake] requesting permission...')
    try {
      const result = await dme.requestPermission()
      console.log('[shake] permission result:', result)
      if (result === 'granted') startListening()
    } catch (err) {
      console.error('[shake] permission error:', err)
    }
  } else {
    console.log('[shake] no requestPermission needed, starting')
    startListening()
  }
}
