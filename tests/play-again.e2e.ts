import { test, expect } from '@playwright/test'
import { createPlayer } from './helpers'

test('play again after meld returns all players to lobby', async ({ browser }) => {
  const p1 = await createPlayer(browser, 'Alice')
  await p1.page.click('button:has-text("New Game")')
  await p1.page.waitForSelector('.screen.lobby')

  const heading = await p1.page.textContent('.screen-header h2')
  const gameId = heading!.replace('Your Game is: ', '')

  const join = async (name: string) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(`/game/${gameId}`)
    await page.fill('input[placeholder="Your name"]', name)
    await page.click('button:has-text("Join Lobby")')
    await page.waitForSelector('.screen.lobby')
    return { context: ctx, page }
  }

  const p2 = await join('Bob')
  const p3 = await join('Carol')
  const allPages = [p1.page, p2.page, p3.page]

  for (const page of allPages) {
    await page.click('button:has-text("Ready")')
  }

  for (const page of allPages) {
    await page.waitForSelector('.screen.guesses', { timeout: 10_000 })
  }

  for (const page of allPages) {
    await page.fill('input[placeholder="guess here..."]', 'banana')
    await page.click('button:has-text("Lock In")')
  }

  for (const page of allPages) {
    await page.waitForSelector('.screen.game-end', { timeout: 15_000 })
  }

  for (const page of allPages) {
    await page.click('button:has-text("Play Again")')
  }

  for (const page of allPages) {
    await page.waitForSelector('.screen.lobby', { timeout: 10_000 })
  }

  for (const ctx of [p1.context, p2.context, p3.context]) {
    await ctx.close()
  }
})
