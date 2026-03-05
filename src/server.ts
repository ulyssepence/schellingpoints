import express from 'express'
import * as api from './server/api'
import * as updates from './server/updates'
import * as names from './server/names'
import * as play from './server/play'
import * as t from './server/types'
import * as categories from './server/categories'
import * as db from './server/db'
import * as apns from './server/apns'
import * as persist from './server/persist'
import { loadVocab } from './server/vocab'

import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// TODO: Path may need adjusting for production (navigates from dist/ back to src/)
const allCategories = categories.load(
  __dirname + '/../src/server/categories.json'
)

const vocab = loadVocab()

const state: t.State = new t.State(
  new names.Chooser(
    [
      __dirname + '/../static/adjectives.txt',
      __dirname + '/../static/nouns.txt',
    ],
  ),
  allCategories,
  vocab,
)

const app = express()
app.use(express.json())

api.addWebsockets(
  state,
  app,
)

updates.addRoutes(app)

api.addStatic(
  app,
)

db.init()
persist.loadGames(state)
apns.init()
play.startTicking(state, 100)
play.startReaper(state)

process.on('SIGTERM', () => {
  console.log('SIGTERM received, flushing game state...')
  try {
    persist.syncAll(state.games)
  } catch (err) {
    console.error('Final persist flush failed:', err)
  }
  process.exit(0)
})

const port = Number(process.env.PORT) || 8000
app.listen(port, '0.0.0.0')
