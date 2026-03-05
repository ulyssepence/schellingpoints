import * as React from 'react'
import * as Router from 'react-router'
import * as ReactDOM from "react-dom/client"
import * as t from "./client/types"
import { Guesses } from "./client/Guesses"
import { Lounge } from "./client/Lounge"
import { Lobby } from "./client/Lobby"
import { Reveal } from "./client/Reveal"
import { GameEnd } from "./client/GameEnd"
import { ScreenBackground } from './client/ScreenBackground'
import { DebugMenu } from './client/DebugMenu'
import * as features from './client/features'
import * as gameEvents from './client/gameEvents'
import * as haptics from './client/haptics'
import * as push from './client/push'
import * as network from './client/network'
import { PlayerRing } from "./client/PlayerRing"
import { MoodPicker } from './client/MoodPicker'

const router = Router.createBrowserRouter([
  {
    path: "/",
    Component: () => <App />,
  },
  {
    path: "game/:gameId",
    Component: () => {
      const { gameId } = Router.useParams()
      return <App gameId={gameId!} />
    },
  },
])

function onMessage(state: t.State, message: t.ToClientMessage): t.State {
  switch (message.type) {
    case 'LOUNGE':
      return { ...state, view: { type: 'LOUNGE' } }

    case 'MEMBER_CHANGE': {
      const viewGameId = 'gameId' in state.view ? state.view.gameId : undefined
      if (message.gameId !== viewGameId) return state
      return { ...state, otherPlayers: message.allPlayers }
    }

    case 'LOBBY_STATE':
      console.log(message)
      return { ...state, view: { type: 'LOBBY', gameId: message.gameId, isReady: message.isReady } }

    case 'GUESS_STATE':
      return { ...state, view: { type: 'GUESSES', gameId: message.gameId, hasGuessed: message.hasGuessed, prompt: message.prompt, secsLeft: message.secsLeft, round: message.round, totalRounds: message.totalRounds } }

    case 'REVEAL_STATE':
      return { ...state, view: {
        type: 'REVEAL', gameId: message.gameId,
        centroidWord: message.centroidWord,
        centroidIsRepeat: message.centroidIsRepeat,
        positions: message.positions,
        guesses: message.guesses,
        melded: message.melded,
        round: message.round,
        totalRounds: message.totalRounds,
        secsLeft: message.secsLeft,
        isReady: message.isReady,
      }}

    case 'GAME_END':
      return { ...state, view: {
        type: 'GAME_END', gameId: message.gameId,
        melded: message.melded,
        meldRound: message.meldRound,
        centroidHistory: message.centroidHistory,
        playerHistory: message.playerHistory,
      }}

    case 'CONTINUE_PROMPT':
      return { ...state, view: {
        type: 'CONTINUE', gameId: message.gameId,
        centroidHistory: message.centroidHistory,
        playerHistory: message.playerHistory,
      }}

    case 'LOBBY_COUNTDOWN': {
      const isReady = state.view.type === 'LOBBY' ? state.view.isReady : []
      return { ...state, view: { type: 'LOBBY', gameId: message.gameId, isReady, secsLeft: message.secsLeft } }
    }

    case 'SCORING': {
      if (state.view.type !== 'GUESSES' || state.view.gameId !== message.gameId) return state
      return { ...state, view: { ...state.view, scoring: true } }
    }

    case 'CONNECTION_STATUS':
      return { ...state, connected: message.connected }

    case 'NETWORK_STATUS':
      return { ...state, networkOnline: message.online }

    case 'NO_SUCH_GAME':
      // TODO: Create notification?
      return state
  }
}

export interface Props {
  gameId?: t.GameId
}
function App({ gameId }: Props) {
  let [state, dispatch] = React.useReducer(onMessage, t.initialState())
  const [playerName, setPlayerName] = React.useState(state.playerName)
  const [nameInput, setNameInput] = React.useState('')
  const [currentMood, setCurrentMood] = React.useState(state.mood)
  const prevPlayerCount = React.useRef(0)
  const prevViewType = React.useRef(state.view.type)
  const hasConnected = React.useRef(false)
  if (state.connected) hasConnected.current = true

  function handleNameSubmit() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    localStorage.setItem('playerName', trimmed)
    setPlayerName(trimmed)
  }

  const reconnectInfoRef = React.useRef<{
    gameId?: string, playerId: string, playerName: string, mood: t.Mood, clientVersion?: string
  } | null>(null)

  React.useEffect(() => {
    state.mailbox.listen(dispatch)
    push.register(state.mailbox, state.playerId)
    const pendingGameId = push.getPendingGameId()
    if (pendingGameId) {
      history.pushState(null, '', `/game/${pendingGameId}`)
      dispatchEvent(new PopStateEvent('popstate'))
    }
    const cleanupNetwork = network.listenNetwork(connected => {
      dispatch({ type: 'NETWORK_STATUS', online: connected })
    })
    state.mailbox.onReconnect = () => {
      const info = reconnectInfoRef.current
      if (!info) return
      if (info.gameId) {
        state.mailbox.send({
          type: 'SUBSCRIBE_GAME',
          gameId: info.gameId,
          playerId: info.playerId,
          playerName: info.playerName,
          mood: info.mood,
          clientVersion: info.clientVersion,
        })
      } else {
        state.mailbox.send({
          type: 'JOIN_LOUNGE',
          playerId: info.playerId,
          playerName: info.playerName,
          mood: info.mood,
        })
      }
    }
    return cleanupNetwork
  }, [])

  React.useEffect(() => {
    reconnectInfoRef.current = {
      gameId: 'gameId' in state.view ? state.view.gameId : undefined,
      playerId: state.playerId,
      playerName: playerName,
      mood: currentMood,
      clientVersion: import.meta.env.APP_VERSION,
    }
  }, [state.view, state.playerId, playerName, currentMood])

  React.useEffect(() => {
    const count = state.otherPlayers.length
    if (state.view.type === 'LOBBY' && count > prevPlayerCount.current && prevPlayerCount.current > 0) {
      state.audioPlayer.playSound('PlayerJoined')
    }
    prevPlayerCount.current = count
  }, [state.otherPlayers])

  React.useEffect(() => {
    const prev = prevViewType.current
    prevViewType.current = state.view.type

    if (state.view.type === 'GUESSES' && prev !== 'GUESSES') {
      gameEvents.emit('round-start')
      if (features.flag('soundExpansion')) state.audioPlayer.playSound('RoundStart', { volume: 0.4 })
    }
    if (state.view.type === 'REVEAL' && prev !== 'REVEAL') {
      gameEvents.emit('reveal')
      if (features.flag('soundExpansion')) state.audioPlayer.playSound('RevealStinger', { volume: 0.5 })
      if (state.view.melded) gameEvents.emit('meld')
    }
    if (prev !== state.view.type && features.flag('soundExpansion')) {
      state.audioPlayer.playSound('TransitionSwoosh', { volume: 0.2 })
    }
  }, [state.view.type])

  React.useEffect(() => {
    if (state.view.type !== 'REVEAL') return
    const pos = state.view.positions.find(([id]) => id === state.playerId)
    if (!pos) return
    const [, x, y] = pos
    haptics.onReveal(Math.sqrt(x * x + y * y), state.view.melded)
  }, [state.view.type === 'REVEAL' ? state.view.round : null])

  React.useEffect(() => {
    if (state.view.type === 'LOUNGE') {
      window.history.replaceState(null, '', '/')
    } else if ('gameId' in state.view) {
      window.history.replaceState(null, '', `/game/${state.view.gameId}`)
    }
  }, [state.view])

  React.useEffect(() => {
    if (!gameId) return
    if (!playerName) return

    state.mailbox.send({
      type: 'SUBSCRIBE_GAME',
      gameId,
      playerId: state.playerId,
      playerName: playerName,
      mood: currentMood,
      clientVersion: import.meta.env.APP_VERSION,
    })
  }, [gameId, playerName])

  const offlineBanner = !state.networkOnline
    ? <div className="offline-banner">No connection — waiting for network</div>
    : null

  const showReconnecting = hasConnected.current && !state.connected && state.networkOnline
  const reconnectOverlay = showReconnecting
    ? <div className="reconnecting-overlay"><p>Reconnecting...</p></div>
    : null

  if (gameId && !playerName) {
    return <>
      {offlineBanner}
      {reconnectOverlay}
      <div className="screen lounge">
        <div className="title-block">
          <h1 className="title">The Schelling Point</h1>
          <p className="subtitle">Do you & your friends think alike?</p>
        </div>
        <PlayerRing />
        <div className="screen-footer">
          <input className="input"
            type="text"
            placeholder="Your name"
            maxLength={20}
            value={nameInput}
            autoFocus
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
          />
          <button className="btn" onClick={handleNameSubmit}>Join Lobby</button>
        </div>
      </div>
    </>
  }

  let screen: React.ReactNode
  switch (state.view.type) {
    case 'LOUNGE':
      screen = <Lounge
        mailbox={state.mailbox}
        playerId={state.playerId}
        mood={state.mood}
        otherPlayers={state.otherPlayers}
      />
      break

    case 'LOBBY':
      screen = <Lobby
        mailbox={state.mailbox}
        playerId={state.playerId}
        gameId={state.view.gameId}
        isReady={state.view.isReady}
        secsLeft={state.view.secsLeft}
        mood={state.mood}
        playerName={state.playerName}
        otherPlayers={state.otherPlayers}
      />
      break

    case 'GUESSES':
      screen = <Guesses
        mailbox={state.mailbox}
        playerId={state.playerId}
        gameId={state.view.gameId}
        prompt={state.view.prompt}
        secsLeft={state.view.secsLeft}
        hasGuessed={state.view.hasGuessed}
        round={state.view.round}
        totalRounds={state.view.totalRounds}
        scoring={state.view.scoring}
        audioPlayer={state.audioPlayer}
      />
      break

    case 'REVEAL':
      screen = <Reveal
        gameId={state.view.gameId}
        playerId={state.playerId}
        playerName={playerName}
        mood={currentMood}
        mailbox={state.mailbox}
        centroidWord={state.view.centroidWord}
        centroidIsRepeat={state.view.centroidIsRepeat}
        positions={state.view.positions}
        guesses={state.view.guesses}
        melded={state.view.melded}
        round={state.view.round}
        totalRounds={state.view.totalRounds}
        secsLeft={state.view.secsLeft}
        isReady={state.view.isReady}
        otherPlayers={state.otherPlayers}
        audioPlayer={state.audioPlayer}
      />
      break

    case 'GAME_END':
      screen = <GameEnd
        gameId={state.view.gameId}
        playerId={state.playerId}
        playerName={playerName}
        mood={currentMood}
        mailbox={state.mailbox}
        melded={state.view.melded}
        meldRound={state.view.meldRound}
        centroidHistory={state.view.centroidHistory}
        playerHistory={state.view.playerHistory}
      />
      break

    case 'CONTINUE':
      screen = <GameEnd
        gameId={state.view.gameId}
        playerId={state.playerId}
        playerName={playerName}
        mood={currentMood}
        mailbox={state.mailbox}
        isContinue
        centroidHistory={state.view.centroidHistory}
        playerHistory={state.view.playerHistory}
      />
      break

    default: {
      const _exhaustive: never = state.view
      screen = _exhaustive
    }
  }

  const rawKey = state.view.type + ('round' in state.view ? `-${state.view.round}` : '')
  const [screenKey, setScreenKey] = React.useState(rawKey)
  const keyTimer = React.useRef<ReturnType<typeof setTimeout>>()
  const lastKeyTime = React.useRef(0)
  React.useEffect(() => {
    clearTimeout(keyTimer.current)
    const now = Date.now()
    const elapsed = now - lastKeyTime.current
    if (elapsed < 150) {
      keyTimer.current = setTimeout(() => {
        setScreenKey(rawKey)
        lastKeyTime.current = Date.now()
      }, 100)
    } else {
      setScreenKey(rawKey)
      lastKeyTime.current = now
    }
    return () => clearTimeout(keyTimer.current)
  }, [rawKey])

  return <>
    {offlineBanner}
    {reconnectOverlay}
    <React.Fragment key={screenKey}>{screen}</React.Fragment>
  </>
}

features.applyBodyClasses()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ScreenBackground />
    <DebugMenu />
    <Router.RouterProvider router={router} />
  </React.StrictMode>
)
