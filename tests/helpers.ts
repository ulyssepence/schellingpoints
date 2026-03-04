import type { Browser, BrowserContext, Page } from '@playwright/test'

export async function createPlayer(
  browser: Browser,
  name: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')
  await page.fill('input[placeholder="Your name"]', name)
  await page.click('button:has-text("Join Lobby")')
  return { context, page }
}
