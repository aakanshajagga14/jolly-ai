# Jolly

**Pixel-art legal cross-examination simulator** — upload a case PDF, enter a live courtroom session, and cross-examine AI-driven witness and judge agents while a Phaser.js canvas animates the scene in sync with dialogue.


https://github.com/user-attachments/assets/794e6d2f-4510-49b4-bca9-0d7a1e00c1d7


---

## Features

- **Case upload** — PDF dropzone with validation (PDF only, ≤ 20 MB) and mock Harvey case analysis
- **Live session** — 10-minute countdown, microphone indicator, real-time transcript, coaching hints
- **Phaser courtroom** — pixel-art scene with lawyer, witness, and judge; speech bubbles on dialogue
- **Sprite animations** — `idle`, `talking`, `stressed`, `very-stressed`, `gavel-slam`, `zoom-in`, `contempt`
- **Session summary** — chronological transcript, score card, play-again flow

---

## Tech stack

| Layer | Technology |
|--------|------------|
| UI | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Game canvas | Phaser.js 4 (≥ 30 FPS, pixel-art rendering) |
| Events | mitt EventBus |
| API (stubbed) | Next.js Route Handlers (`/api/upload`, `/api/session/start`) |
| Backend | Node.js, Deepgram STT, Gemini, RumiK SILK TTS, Harvey MCP |

---

## Getting started


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

## License

This project is provided as-is for development and demonstration. 
