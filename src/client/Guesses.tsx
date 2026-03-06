import * as React from 'react'
import * as t from './types'
import * as features from './features'
import * as haptics from './haptics'
import { Box } from './mail'
import { Timer } from './components/timer'
import { playerColor } from './playerColor'
import { BugButton } from './BugReport'

function GuessInput(props: { onSubmit: (guess: string) => void, locked: boolean, audioPlayer: t.State['audioPlayer'] }) {
  const [guess, setGuess] = React.useState('')
  const btnRef = React.useRef<HTMLButtonElement>(null)

  function handleLockIn() {
    if (!guess) return
    if (features.flag('lockInPunch') && btnRef.current) {
      btnRef.current.classList.add('lock-in-punch')
      setTimeout(() => btnRef.current?.classList.remove('lock-in-punch'), 150)
    }
    if (features.flag('lockInPunch')) {
      haptics.onLockIn()
    }
    if (features.flag('soundExpansion')) {
      props.audioPlayer.playSound('SubmitClick')
    }
    props.onSubmit(guess)
  }

  if (props.locked) {
    return (
      <div className="screen-footer locked-in">
        <p className="locked-in-msg">Locked in!</p>
      </div>
    )
  }

  return (
    <div className="screen-footer">
      <input
        className="input"
        placeholder="guess here..."
        type="text"
        value={guess}
        onChange={(e) => setGuess(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleLockIn()}
      />
      <button ref={btnRef} className="btn" onClick={handleLockIn}>
        Lock In
      </button>
    </div>
  )
}

function PlayerProgress(props: { hasGuessed: [string, boolean][] }) {
  const prevRef = React.useRef(new Set<string>())
  const lockedIn = props.hasGuessed.filter(([_, done]) => done).length
  const total = props.hasGuessed.length

  const doneSet = new Set(props.hasGuessed.filter(([_, d]) => d).map(([id]) => id))

  React.useEffect(() => {
    prevRef.current = doneSet
  })

  return <div className="player-progress">
            <p>{lockedIn} of {total} locked in</p>
            <div className="player-progress-dots">
              {props.hasGuessed.map(([id, done]) => {
                const justDone = done && !prevRef.current.has(id) && features.flag('progressDotPop')
                return (
                  <div
                    key={id}
                    className={`player-progress-dot${justDone ? ' dot-pop' : ''}`}
                    style={{
                      background: `var(${playerColor(id).primary})`,
                      opacity: done ? 1 : 0.3,
                    }}
                  />
                )
              })}
            </div>
         </div>
}

function TypewriterPrompt({ text }: { text: string }) {
  return (
    <h1 aria-label={text}>
      {text.split('').map((ch, i) => (
        <span key={i} className="typewriter-char" style={{ animationDelay: `${i * 30}ms` }}>
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </h1>
  )
}

type Props = {
  mailbox: Box
  playerId: t.PlayerId
  gameId: t.GameId
  prompt: string
  secsLeft: number
  hasGuessed: [t.PlayerId, boolean][]
  round: number
  totalRounds: number
  scoring?: boolean
  audioPlayer: t.State['audioPlayer']
}

export function Guesses({ mailbox, playerId, gameId, prompt, secsLeft, hasGuessed, round, totalRounds, scoring, audioPlayer }: Props) {
  const totalDuration = React.useRef(secsLeft).current
  const lastTickRef = React.useRef(-1)

  React.useEffect(() => {
    if (!features.flag('soundExpansion')) return
    if (secsLeft <= 5 && secsLeft > 0 && secsLeft !== lastTickRef.current) {
      lastTickRef.current = secsLeft
      audioPlayer.playSound('TimerTick', { volume: 0.3 })
    }
  }, [secsLeft])

  function handleSubmit(guess: string) {
    mailbox.send({
      type: 'GUESS',
      gameId,
      playerId,
      guess,
    })
  }

  const timerClasses = [
    'timer',
    features.flag('timerUrgency') && secsLeft <= 5 ? 'timer-urgent' : '',
  ].filter(Boolean).join(' ')

  const screenClasses = [
    'screen guesses',
    features.flag('timerUrgency') && secsLeft <= 3 ? 'timer-critical-screen' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={screenClasses}>
      <div className="screen-topbar">
        <BugButton />
        {scoring
          ? <div className="timer scoring"><p>...</p></div>
          : <div className={timerClasses} style={{ '--timer-duration': `${totalDuration}s` } as React.CSSProperties}>
              <svg viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" />
              </svg>
              <Timer secsLeft={secsLeft} />
            </div>
        }
      </div>
      <div className="screen-header">
        <h1>{round + 1 > totalRounds ? `Round ${round + 1}` : `Round ${round + 1} of ${totalRounds}`}</h1>
        <h2>Communicate Without Speaking</h2>
      </div>
      <div className="category-display">
        {features.flag('promptTypewriter')
          ? <TypewriterPrompt text={prompt} />
          : <h1>{prompt}</h1>
        }
      </div>
      <div className="screen-footer">
        <PlayerProgress hasGuessed={hasGuessed} />
        <GuessInput
          onSubmit={handleSubmit}
          locked={hasGuessed.some(([id, done]) => id === playerId && done)}
          audioPlayer={audioPlayer}
        />
      </div>
    </div>
  )
}
