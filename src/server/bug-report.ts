import express from 'express'

const hits = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  let entry = hits.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 3600_000 }
    hits.set(ip, entry)
  }
  entry.count++
  return entry.count > 10
}

export function cleanup() {
  const now = Date.now()
  for (const [ip, entry] of hits) {
    if (now > entry.resetAt) hits.delete(ip)
  }
}

export function addRoutes(app: express.Application) {
  app.post('/api/bug-reports', async (req, res) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    if (isRateLimited(ip)) {
      res.status(429).json({ error: 'Rate limited' })
      return
    }

    const { description, context, stackTrace } = req.body ?? {}
    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPO
    if (!token || !repo) {
      console.error('GITHUB_TOKEN or GITHUB_REPO not set')
      res.status(500).json({ error: 'Bug reporting not configured' })
      return
    }

    const bodyParts = [
      description && `**Description:** ${description}`,
      context?.url && `**URL:** ${context.url}`,
      context?.userAgent && `**User Agent:** ${context.userAgent}`,
      context?.appVersion && `**App Version:** ${context.appVersion}`,
      `**Timestamp:** ${new Date().toISOString()}`,
      stackTrace && `\n**Stack Trace:**\n\`\`\`\n${stackTrace}\n\`\`\``,
    ].filter(Boolean).join('\n')

    const title = description
      ? `[Bug Report] ${description.slice(0, 80)}`
      : '[Bug Report] Crash report'

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ title, body: bodyParts }),
      })
      if (!response.ok) {
        const text = await response.text()
        console.error('GitHub API error:', response.status, text)
        res.status(502).json({ error: 'Failed to create issue' })
        return
      }
      res.json({ ok: true })
    } catch (err) {
      console.error('GitHub API request failed:', err)
      res.status(502).json({ error: 'Failed to create issue' })
    }
  })
}
