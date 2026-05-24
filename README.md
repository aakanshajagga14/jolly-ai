# Jolly — Pixel-Art Legal Cross-Examination Simulator

A voice-driven courtroom cross-examination simulator with a Phaser.js pixel-art canvas and Next.js UI.

## Project structure

- `frontend/` — Next.js + Phaser.js app (upload, session, summary screens)
- `design(1).md` — System design document
- `requirements.md` — Functional requirements

## Quick start

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Copy `frontend/.env.local.example` to `frontend/.env.local` to configure mock WebSocket mode.

## Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Phaser.js
- **Backend:** Stubbed API routes (upload, session start); mock WebSocket session
- **Planned:** Deepgram, Gemini, RumiK SILK, Harvey MCP
