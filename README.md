# Schelling Points

A multiplayer word game where players try to converge on the same answer. Each round, everyone sees a category prompt and submits a word. Responses are scored by how semantically close they are to each other — the more players cluster around the same idea, the higher everyone scores. Think of it as a cooperative game about reading the room.

Play it at [schellingpoints.app](https://schellingpoints.app).

## How it works

1. Create a game and share the link or QR code
2. Everyone sees the same prompt (e.g. "Something you'd find in a kitchen")
3. Each player submits a one-word answer
4. Answers are scored by semantic similarity — words that are closer in meaning score higher
5. The group's centroid (average meaning) becomes the next round's prompt
6. If everyone converges on the same word, you've achieved a **mind meld**

## Stack

- **Frontend:** React
- **Backend:** Express
- **Scoring:** Word embeddings via Ollama (`nomic-embed-text`)

## Development

```bash
bun install
bun run dev
```

Requires [Ollama](https://ollama.com) running locally with the `nomic-embed-text` model for scoring.

## Team

- [Hart](https://twitter.com/puheenix)
- [Julianna](https://twitter.com/jannaaar)
- [Marianne](https://twitter.com/thrialectics)
- [Ulysse](https://twitter.com/ulyssepence)
