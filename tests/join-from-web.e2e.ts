import { test, expect } from '@playwright/test'
import { createPlayer } from './helpers'

// Regression: returning players (playerName in localStorage) got stuck on
// "Joining..." because onReconnect fired on first WS connect, sending
// JOIN_LOUNGE that clobbered the SUBSCRIBE_GAME response.
test('returning player joining via direct URL reaches lobby', async ({ browser }) => {
  // Player 1 creates a game from the lounge
  const p1 = await createPlayer(browser, 'Alice')
  await p1.page.click('button:has-text("New Game")')
  await p1.page.waitForSelector('.screen.lobby')

  const heading = await p1.page.textContent('.screen-header h2')
  const gameId = heading!.replace('Your Game is: ', '')

  // Player 2 is a "returning player" — they already have a name in localStorage.
  // They navigate directly to the game URL (e.g. scanned a QR code).
  const ctx = await browser.newContext()
  const p2 = await ctx.newPage()

  // Pre-set localStorage so the player is "returning" (skips name input)
  await p2.goto('/')
  await p2.evaluate((name: string) => {
    localStorage.setItem('playerName', name)
    localStorage.setItem('playerId', crypto.randomUUID())
  }, 'Bob')

  // Navigate directly to the game URL
  await p2.goto(`/game/${gameId}`)

  // Should reach the lobby — not be stuck on "Joining..."
  await p2.waitForSelector('.screen.lobby', { timeout: 5_000 })
  const lobbyHeading = await p2.textContent('.screen-header h2')
  expect(lobbyHeading).toContain(gameId)

  await p1.context.close()
  await ctx.close()
})
