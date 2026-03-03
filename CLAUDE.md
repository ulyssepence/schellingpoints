# Schelling Points

Jackbox-style mobile word game. Players submit answers to category prompts, responses are scored by semantic clustering. TypeScript throughout.

- **Frontend:** React 19 + React Router 7 + Vite 7
- **Backend:** Express 5 + express-ws (WebSocket)
- **Package manager:** Bun (server runs via `tsx`, not `bun` directly)
- **State:** In-memory (no database)
- **Architecture:** `docs/solutions/2026-02-18-codebase-review-handoff.md`

## Conventions

### Pull Requests
- All PRs target `main`
- **Link issues in PR body.** Use `Closes #N` (or `Fixes #N` for bugs)
  so the issue auto-closes on merge. Multiple issues: `Closes #N, closes #M`.
- **PR description required.** Every PR body must include: what changed,
  why, and which issue(s) it addresses. One-liner is fine for small PRs.
