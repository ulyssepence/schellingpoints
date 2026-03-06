import * as React from 'react'
import * as t from './types'
import * as features from './features'
import confetti from 'canvas-confetti'
import { Box } from './mail'
import { Timer } from './components/timer'
import { ScatterPlot } from './components/ScatterPlot'
import { BugButton } from './BugReport'

type Props = {
  gameId: t.GameId
  playerId: t.PlayerId
  mailbox: Box
  centroidWord: string
  centroidIsRepeat: boolean
  positions: [t.PlayerId, number, number][]
  melded: boolean
  round: number
  totalRounds: number
  secsLeft?: number
  isReady: [t.PlayerId, boolean][]
  audioPlayer: t.State['audioPlayer']
}

export function Reveal({ gameId, playerId, mailbox, centroidWord, centroidIsRepeat, positions, melded, round, totalRounds, secsLeft, isReady, audioPlayer }: Props) {
  const totalDuration = React.useRef(secsLeft).current
  const celebratedRef = React.useRef(false)

  const amReady = isReady.find(([id]) => id === playerId)?.[1] ?? false

  React.useEffect(() => {
    if (!melded || celebratedRef.current) return
    celebratedRef.current = true

    if (features.flag('meldCelebration')) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        disableForReducedMotion: true,
      })

      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReduced) {
        const body = document.body
        let trauma = 1
        const start = performance.now()
        function shake(now: number) {
          const elapsed = now - start
          if (elapsed > 300) { body.style.transform = ''; return }
          trauma = Math.max(0, 1 - elapsed / 300)
          const t2 = trauma * trauma
          const dx = (Math.random() * 2 - 1) * t2 * 4
          const dy = (Math.random() * 2 - 1) * t2 * 4
          body.style.transform = `translate(${dx}px, ${dy}px)`
          requestAnimationFrame(shake)
        }
        requestAnimationFrame(shake)
      }
    }

    if (features.flag('soundExpansion')) {
      audioPlayer.playSound('MeldCelebration')
    }
  }, [melded])

  function handleToggleReady() {
    mailbox.send({ type: 'REVEAL_READY', gameId, playerId, isReady: !amReady })
  }

  const roundLabel = round + 1 > totalRounds
    ? `Round ${round + 1}`
    : `Round ${round + 1} of ${totalRounds}`

  return (
    <div className="screen reveal">
      <div className="screen-topbar">
        <BugButton />
        {secsLeft !== undefined
          ? <div className="timer" style={{ '--timer-duration': `${totalDuration}s` } as React.CSSProperties}>
              <svg viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" />
              </svg>
              <Timer secsLeft={secsLeft} />
            </div>
          : <span />
        }
      </div>

      <div className="screen-header">
        <h2>{roundLabel}</h2>
        <h1>{centroidWord}</h1>
        {centroidIsRepeat && <h2>(again)</h2>}
        {melded && <p className="meld-indicator">Mind Meld!</p>}
      </div>

      <div className="reveal-content">
        {positions.length > 0 && (
          <ScatterPlot positions={positions} playerId={playerId} melded={melded} />
        )}

      </div>

      <div className="screen-footer">
        <button className="btn" onClick={handleToggleReady}>
          {amReady ? 'Waiting...' : 'Ready'}
        </button>
      </div>
    </div>
  )
}
