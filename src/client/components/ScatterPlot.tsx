import * as React from 'react'
import * as t from '../types'
import * as features from '../features'
import { playerColor } from '../playerColor'

export const PLOT_SIZE = 300
export const PLOT_CENTER = PLOT_SIZE / 2
export const PLOT_RADIUS = PLOT_SIZE / 2 - 30

export function ScatterPlot({ positions, playerId, nameOf, guesses, melded }: {
  positions: [t.PlayerId, number, number][]
  playerId: t.PlayerId
  nameOf: Map<t.PlayerId, string>
  guesses?: [t.PlayerId, string][]
  melded?: boolean
}) {
  const guessOf = new Map(guesses?.map(([id, g]) => [id, g]))
  const gridLines = [0.25, 0.5, 0.75].map(frac => frac * PLOT_RADIUS)

  const animate = features.flag('scatterAnimation')
  const enhance = features.flag('scatterEnhancements')
  const [revealed, setRevealed] = React.useState(!animate)
  const [merged, setMerged] = React.useState(false)

  React.useEffect(() => {
    if (!animate) return
    requestAnimationFrame(() => setRevealed(true))
  }, [])

  React.useEffect(() => {
    if (!enhance || !melded) return
    const t = setTimeout(() => setMerged(true), 800)
    return () => clearTimeout(t)
  }, [melded])

  return (
    <svg className="scatter-plot" viewBox={`0 0 ${PLOT_SIZE} ${PLOT_SIZE}`}>
      {gridLines.map(r => (
        <circle key={r} cx={PLOT_CENTER} cy={PLOT_CENTER} r={r}
          fill="none" stroke="#e0e0e0" strokeWidth={1} />
      ))}
      <circle cx={PLOT_CENTER} cy={PLOT_CENTER} r={PLOT_RADIUS}
        fill="none" stroke="#ccc" strokeWidth={1} />

      <circle cx={PLOT_CENTER} cy={PLOT_CENTER} r={3} fill="#999" />

      {positions.map(([id, x, y], idx) => {
        const dx = x * PLOT_RADIUS
        const dy = y * PLOT_RADIUS
        const targetX = PLOT_CENTER + dx
        const targetY = PLOT_CENTER + dy
        const isMe = id === playerId
        const name = nameOf.get(id) ?? ''
        const guess = guessOf.get(id) ?? ''
        const label = guess ? `${name}: "${guess}"` : name
        const color = `var(${playerColor(id).primary})`
        const dist = Math.sqrt(x * x + y * y)

        const tx = merged ? 0 : (revealed ? dx : 0)
        const ty = merged ? 0 : (revealed ? dy : 0)
        const groupStyle: React.CSSProperties = animate
          ? { transform: `translate(${tx}px, ${ty}px)`, transition: 'transform 0.6s ease-out' }
          : { transform: `translate(${tx}px, ${ty}px)` }

        return (
          <React.Fragment key={id}>
            {enhance && revealed && !merged && (
              <line
                x1={PLOT_CENTER} y1={PLOT_CENTER}
                x2={targetX} y2={targetY}
                stroke={color} strokeWidth={1}
                opacity={Math.max(0.1, 1 - dist)}
              />
            )}
            <g style={groupStyle}>
              {enhance && (
                <circle
                  cx={PLOT_CENTER} cy={PLOT_CENTER}
                  r={isMe ? 10 : 7}
                  fill={color}
                  opacity={0.2}
                />
              )}
              <circle
                cx={PLOT_CENTER} cy={PLOT_CENTER}
                r={isMe ? 6 : 4}
                fill={color}
              />
              <text
                x={PLOT_CENTER} y={PLOT_CENTER - 10}
                fontSize={11} fill="var(--cream)" textAnchor="middle"
                fontFamily="DM Sans, sans-serif" fontWeight={700}
                letterSpacing="0.1em"
                opacity={revealed ? 1 : 0}
                style={{
                  transition: animate ? 'opacity 0.3s ease-out' : undefined,
                  transitionDelay: animate ? `${0.4 + idx * 0.1}s` : undefined,
                }}
              >
                {label.toUpperCase()}
              </text>
            </g>
          </React.Fragment>
        )
      })}
    </svg>
  )
}
