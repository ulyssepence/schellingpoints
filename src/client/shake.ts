const THRESHOLD = 30
const COOLDOWN = 1000

let listening = false
let onShakeCallback: (() => void) | null = null

function startListening() {
  if (listening) return
  listening = true
  let lastX = 0, lastY = 0, lastZ = 0
  let last = 0

  window.addEventListener('devicemotion', (e) => {
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
        onShakeCallback?.()
      }
    }
  })
}

export function initShake(onShake: () => void) {
  onShakeCallback = onShake

  const dme = DeviceMotionEvent as any
  if (typeof dme.requestPermission !== 'function') {
    startListening()
  }
}

export async function requestShakePermission() {
  const dme = DeviceMotionEvent as any
  if (typeof dme.requestPermission === 'function') {
    const result = await dme.requestPermission()
    if (result === 'granted') startListening()
  }
}
