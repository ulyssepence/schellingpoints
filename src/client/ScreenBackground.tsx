import * as React from 'react'
import * as features from './features'
import * as gameEvents from './gameEvents'

const NODE_COLORS = [
  '#e05aa0', '#e8645a', '#e0b84a', '#44c47a',
  '#3abba5', '#4a8fd4', '#44d4e8', '#b088e0',
  '#8855cc',
]

export function ScreenBackground() {
  const starRef = React.useRef<HTMLDivElement>(null)
  const nodeRef = React.useRef<HTMLDivElement>(null)
  const blobRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!starRef.current || !nodeRef.current) return

    for (let i = 0; i < 80; i++) {
      const s = document.createElement('div')
      s.className = 'star'
      const size = Math.random() * 2 + 0.5
      Object.assign(s.style, {
        width: size + 'px', height: size + 'px',
        left: Math.random() * 100 + '%',
        top: Math.random() * 100 + '%',
        animationDuration: (Math.random() * 4 + 2) + 's',
        animationDelay: (Math.random() * 4) + 's',
      })
      starRef.current.appendChild(s)
    }

    for (let i = 0; i < 20; i++) {
      const n = document.createElement('div')
      n.className = 'node'
      const size = Math.random() * 5 + 2
      const color = NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)]
      Object.assign(n.style, {
        width: size + 'px', height: size + 'px',
        background: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
        left: Math.random() * 100 + '%',
        top: (Math.random() * 80 + 10) + '%',
        animationDuration: (Math.random() * 8 + 6) + 's',
        animationDelay: (Math.random() * 8) + 's',
      })
      nodeRef.current.appendChild(n)
    }
  }, [])

  React.useEffect(() => {
    if (!features.flag('backgroundReactivity') || !blobRef.current) return
    const blobs = blobRef.current

    function flashBlobs(duration: number, opacity: string) {
      blobs.style.opacity = opacity
      blobs.style.transition = 'opacity 0.3s ease-out'
      setTimeout(() => {
        blobs.style.opacity = ''
        blobs.style.transition = 'opacity 0.5s ease-in'
      }, duration)
    }

    const offMeld = gameEvents.on('meld', () => {
      flashBlobs(2000, '0.6')
      for (const b of Array.from(blobs.children) as HTMLElement[]) {
        b.style.animationDuration = '4s'
        setTimeout(() => b.style.animationDuration = '', 2000)
      }
    })

    const offReveal = gameEvents.on('reveal', () => {
      flashBlobs(500, '0.45')
    })

    return () => { offMeld(); offReveal() }
  }, [])

  return (
    <>
      <div className="starfield" ref={starRef} />
      <div className="blob-layer" ref={blobRef}>
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
        <div className="blob b5" />
        <div className="blob b6" />
        <div className="blob b7" />
      </div>
      <div className="nodes" ref={nodeRef} />
    </>
  )
}
