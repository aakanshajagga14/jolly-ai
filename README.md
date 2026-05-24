# Jolly

**Pixel-art legal cross-examination simulator** — upload a case PDF, enter a live courtroom session, and cross-examine AI-driven witness and judge agents while a Phaser.js canvas animates the scene in sync with dialogue.

Repository: [github.com/aakanshajagga14/jolly-ai](https://github.com/aakanshajagga14/jolly-ai)

---

## Features

- **Case upload** — PDF dropzone with validation (PDF only, ≤ 20 MB) and mock Harvey case analysis
- **Live session** — 10-minute countdown, microphone indicator, real-time transcript, coaching hints
- **Phaser courtroom** — pixel-art scene with lawyer, witness, and judge; speech bubbles on dialogue
- **Sprite animations** — `idle`, `talking`, `stressed`, `very-stressed`, `gavel-slam`, `zoom-in`, `contempt`
- **Session summary** — chronological transcript, score card, play-again flow
- **Mock-first architecture** — full UI works without a real backend; WebSocket and voice pipeline are stubbed

---

## Tech stack

| Layer | Technology |
|--------|------------|
| UI | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Game canvas | Phaser.js 4 (≥ 30 FPS, pixel-art rendering) |
| Events | mitt EventBus |
| API (stubbed) | Next.js Route Handlers (`/api/upload`, `/api/session/start`) |
| Planned backend | Node.js, Deepgram STT, Gemini, RumiK SILK TTS, Harvey MCP |

---

## Project structure

```
jolly/
├── frontend/                 # Next.js + Phaser application
│   ├── app/                  # App Router pages & API routes
│   ├── components/           # UploadScreen, SessionScreen, SummaryScreen, PhaserCanvas
│   ├── game/                 # CourtroomScene, PhaserGame, SpeechBubble
│   ├── lib/                  # WebSocketClient, MicrophoneCapture, mockSession, uploadApi
│   ├── public/assets/        # Courtroom background & audio worklet
│   └── types.ts              # Shared TypeScript interfaces
├── design(1).md              # System design & WebSocket protocol
└── requirements.md           # Functional requirements
```

---

## Getting started

### Prerequisites

- **Node.js** 20+
- **npm** 9+

### Install & run

```bash
git clone https://github.com/aakanshajagga14/jolly-ai.git
cd jolly-ai/frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Copy the example file and adjust if needed:

```bash
cp .env.local.example .env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_USE_MOCK_WS` | `true` | Use mock WebSocket session (no real server required) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL when mock mode is disabled |

With mock mode enabled, the app simulates a full cross-examination timeline (~25 s) including transcript entries, animations, and coaching hints.

### Production build

```bash
cd frontend
npm run build
npm start
```

---

## How it works

### 1. Upload (`UploadScreen`)

1. User drops a PDF on the landing screen.
2. Frontend calls `POST /api/upload`, then polls `GET /api/upload/:id/status`.
3. Mock Harvey analysis returns a structured `CaseContext` after ~2 seconds.

### 2. Session (`SessionScreen`)

1. Frontend calls `POST /api/session/start` for a session token and WebSocket URL.
2. `WebSocketClient` connects (mock or real) and streams events to a shared EventBus.
3. Phaser `CourtroomScene` listens for `ANIMATION_CMD` and drives character states.
4. Speech bubbles appear on `STT_FINAL` (lawyer) and `AGENT_RESPONSE` (witness/judge).
5. Sidebars show live transcript, coaching hints, timer, and mic status.

### 3. Summary (`SummaryScreen`)

Session ends with a full transcript, score stats, and a **Play Again** button.

---

## Architecture notes

- **Mock boundary** — Only `WebSocketClient.ts` internals need to change to wire a real backend; the rest of the app uses typed EventBus events.
- **Voice pipeline (stubbed)** — `MicrophoneCapture` supports AudioWorklet PCM frames; `TtsPlayback` handles server audio and `VAD_INTERRUPT`.
- **Session cap** — Design specifies a hard 10-minute limit per session (enforced by backend when wired).

See [`design(1).md`](design(1).md) for WebSocket message types, data models, and component diagrams.

---

## Roadmap

- [ ] Real Node.js backend with WebSocket server
- [ ] Harvey MCP PDF analysis & in-session coaching
- [ ] Deepgram live STT + Gemini multi-agent pipeline
- [ ] RumiK SILK TTS with interruptible playback
- [ ] Replace placeholder sprites with pixel-art sprite sheets

---

## Scripts

Run from `frontend/`:

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run lint` | ESLint |

---

## License

This project is provided as-is for development and demonstration. Add a license file if you plan to open-source formally.
