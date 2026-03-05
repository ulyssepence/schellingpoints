import { describe, it, expect } from 'bun:test'
import { onMessage } from './client/reducer'
import type * as t from './client/types'

function mockState(overrides: Partial<t.State> = {}): t.State {
  return {
    audioPlayer: {} as any,
    mailbox: {} as any,
    view: { type: 'LOUNGE' },
    otherPlayers: [],
    playerId: 'me',
    playerName: 'Me',
    mood: '😀',
    connected: false,
    networkOnline: true,
    ...overrides,
  }
}

describe('LOUNGE handler (bug 5)', () => {
  it('sets otherPlayers from loungingPlayers', () => {
    const state = mockState({ otherPlayers: [['old', 'Old', '😀']] })
    const next = onMessage(state, {
      type: 'LOUNGE',
      loungingPlayers: [['a', 'Alice', '😀'], ['b', 'Bob', '😐']],
    })
    expect(next.otherPlayers).toEqual([['a', 'Alice', '😀'], ['b', 'Bob', '😐']])
    expect(next.view).toEqual({ type: 'LOUNGE' })
  })
})

describe('LOBBY_STATE handler (bug 4)', () => {
  it('resets otherPlayers to empty', () => {
    const state = mockState({
      otherPlayers: [['a', 'Alice', '😀'], ['b', 'Bob', '😐']],
    })
    const next = onMessage(state, {
      type: 'LOBBY_STATE',
      gameId: 'game1',
      isReady: [],
    })
    expect(next.otherPlayers).toEqual([])
    expect(next.view).toEqual({ type: 'LOBBY', gameId: 'game1', isReady: [] })
  })

  it('clears gameNotFound', () => {
    const state = mockState({ gameNotFound: true })
    const next = onMessage(state, {
      type: 'LOBBY_STATE',
      gameId: 'game1',
      isReady: [],
    })
    expect(next.gameNotFound).toBe(false)
  })
})

describe('NO_SUCH_GAME handler (bug 1)', () => {
  it('sets gameNotFound and transitions to LOUNGE', () => {
    const state = mockState({
      view: { type: 'LOBBY', gameId: 'old', isReady: [] },
    })
    const next = onMessage(state, {
      type: 'NO_SUCH_GAME',
      gameId: 'nonexistent',
    })
    expect(next.view).toEqual({ type: 'LOUNGE' })
    expect(next.gameNotFound).toBe(true)
  })
})
