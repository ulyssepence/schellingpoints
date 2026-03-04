import express from 'express'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const BUNDLE_PATH = path.resolve('dist/bundle.zip')

let cachedChecksum: string | null = null

function computeChecksum(): string | null {
  try {
    const data = fs.readFileSync(BUNDLE_PATH)
    cachedChecksum = crypto.createHash('sha256').update(data).digest('hex')
    return cachedChecksum
  } catch {
    return null
  }
}

computeChecksum()

export function addRoutes(app: express.Application) {
  app.post('/api/updates/check', (req, res) => {
    const { version_name } = req.body ?? {}
    const currentVersion = process.env.VITE_APP_VERSION

    if (!cachedChecksum || !currentVersion || version_name === currentVersion) {
      res.json({})
      return
    }

    res.json({
      version: currentVersion,
      url: 'https://schellingpoints.app/api/updates/bundle.zip',
      checksum: cachedChecksum,
    })
  })

  app.get('/api/updates/bundle.zip', (_req, res) => {
    if (!fs.existsSync(BUNDLE_PATH)) {
      res.status(404).send('Not found')
      return
    }
    res.sendFile(BUNDLE_PATH)
  })
}
