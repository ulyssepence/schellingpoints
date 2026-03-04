import { test, expect, type Page } from '@playwright/test'
import { createPlayer } from './helpers'

test('three players complete a full game round', async ({ browser }) => {
  const p1 = await createPlayer(browser, 'Alice')
  await p1.page.click('button:has-text("New Game")')
  await p1.page.waitForSelector('.screen.lobby')

  const heading = await p1.page.textContent('.screen-header h2')
  const gameId = heading!.replace('Your Game is: ', '')

  const joinAndReady = async (page: Page, id: string, name: string) => {
    const ctx = await browser.newContext()
    const p = await ctx.newPage()
    await p.goto(`/game/${id}`)
    await p.fill('input[placeholder="Your name"]', name)
    await p.click('button:has-text("Join Lobby")')
    await p.waitForSelector('.screen.lobby')
    return { context: ctx, page: p }
  }

  const p2 = await joinAndReady(p1.page, gameId, 'Bob')
  const p3 = await joinAndReady(p1.page, gameId, 'Carol')

  const allPages = [p1.page, p2.page, p3.page]

  for (const page of allPages) {
    await page.click('button:has-text("Ready")')
  }

  for (const page of allPages) {
    await page.waitForSelector('.screen.guesses', { timeout: 10_000 })
  }

  const guesses = ['apple', 'banana', 'cherry']
  for (let i = 0; i < allPages.length; i++) {
    await allPages[i].fill('input[placeholder="guess here..."]', guesses[i])
    await allPages[i].click('button:has-text("Lock In")')
  }

  for (const page of allPages) {
    await page.waitForSelector('.screen.reveal', { timeout: 15_000 })
  }

  for (const page of allPages) {
    const centroid = await page.textContent('.screen-header h1')
    expect(centroid).toBeTruthy()
    const myGuess = await page.textContent('.my-guess p')
    expect(myGuess).toMatch(/You said:/)
  }

  for (const page of allPages) {
    await page.click('button:has-text("Ready")')
  }

  for (const page of allPages) {
    await page.waitForSelector('.screen.guesses', { timeout: 10_000 })
  }

  for (const ctx of [p1.context, p2.context, p3.context]) {
    await ctx.close()
  }
})
