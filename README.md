# Jolly

**Pixel-art legal cross-examination simulator** — upload a case PDF, enter a live courtroom session, and cross-examine AI-driven witness and judge agents while a Phaser.js canvas animates the scene in sync with dialogue.


https://github.com/user-attachments/assets/7c4c611e-609a-40a5-81f7-2933686d8110



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
| API | Gemini, Deepgram and Silk |
| Backend | Node.js, Deepgram STT, Gemini, RumiK SILK TTS, Harvey MCP |

---

## License

This project is provided as-is for development and demonstration. 
