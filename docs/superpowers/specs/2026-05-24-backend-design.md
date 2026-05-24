# Backend Design: Pixel-Art Legal Cross-Examination Simulator

**Date:** 2026-05-24
**Status:** Approved

---

## Overview

Standalone Node.js/TypeScript backend server for the Jolly simulator. Provides REST endpoints for PDF upload and session creation, a WebSocket server for real-time voice pipeline communication, and multi-agent AI orchestration (Witness, Judge, LawyerCoach, Harvey).

Frontend is complete and expects:
- REST base: `http://localhost:8080`
- WebSocket: `ws://localhost:8080/ws`

---

## Stack

| Concern | Choice |
|---|---|
| HTTP framework | Express.js |
| WebSocket | `ws` library (attached to same HTTP server) |
| PDF parsing | `pdf-parse` |
| STT | Deepgram Live Streaming API |
| LLM | Gemini API (`@google/generative-ai`) |
| TTS | RumiK SILK HTTP API |
| Auth | `jsonwebtoken` (short-lived session JWTs) |
| Language | TypeScript (`ts-node` or `tsx` for dev, `tsc` for prod) |

---

## Directory Structure

```
backend/
├── src/
│   ├── index.ts                          # HTTP + WebSocket server startup (port 8080)
│   ├── api/
│   │   ├── upload.ts                     # POST /api/upload, GET /api/upload/:id/status
│   │   └── session.ts                    # POST /api/session/start
│   ├── ws/
│   │   └── wsServer.ts                   # WS auth, message routing, TTL enforcement
│   ├── pipeline/
│   │   └── VoicePipelineOrchestrator.ts  # STT→LLM→TTS coordinator per session
│   ├── agents/
│   │   ├── witness.ts                    # Gemini witness (stress tracking, objection detection)
│   │   ├── judge.ts                      # Gemini judge (patience tracking, rulings)
│   │   └── lawyerCoach.ts               # Gemini coaching hint evaluator
│   ├── harvey/
│   │   └── harveyAnalyzer.ts             # pdf-parse + Gemini → CaseContext
│   ├── stt/
│   │   └── deepgramClient.ts             # Deepgram Live WS connection per session
│   ├── tts/
│   │   └── rumikClient.ts                # RumiK SILK HTTP client
│   ├── store/
│   │   └── sessionStore.ts               # In-memory Map<sessionId, ActiveSession>
│   ├── transcript/
│   │   └── transcriptLogger.ts           # Append + serialize CourtroomTranscriptEntry
│   └── auth/
│       └── jwt.ts                        # Issue + verify JWTs
├── package.json
├── tsconfig.json
└── .env.example
```

---

## REST API

### `POST /api/upload`
- Accepts `multipart/form-data` with `file` field (PDF, ≤20 MB)
- Validates MIME type and file size
- Stores PDF buffer in memory under a new `uploadId`
- Kicks off `harveyAnalyzer.analyzeDocument(buffer)` async (non-blocking)
- Returns `{ uploadId: string }`

### `GET /api/upload/:id/status`
- Returns `{ status: 'pending' | 'ready' | 'error', caseContext?, message? }`
- Frontend polls this until `status === 'ready'`

### `POST /api/session/start`
- Accepts `{ caseContext: CaseContext }`
- Creates `ActiveSession` in `sessionStore`
- Issues JWT (10-min expiry, signed with `JWT_SECRET`)
- Starts 10-min hard-kill `setTimeout`
- Returns `{ sessionId, wsUrl: 'ws://localhost:8080/ws', token }`

---

## WebSocket Protocol

All messages are JSON with a `type` discriminant (matches `types.ts`).

### Connection Auth
First message from client must be `{ type: 'AUTH', token }`. Server validates JWT. On failure: close with code 4001.

### Message Routing (wsServer.ts)
| Client message | Handler |
|---|---|
| `AUTH` | Validate JWT, associate connection with session |
| `AUDIO_CHUNK` | Forward PCM to `deepgramClient` for this session |
| `SESSION_END_REQUEST` | Trigger clean session teardown |

### Outbound (server → client)
`SESSION_READY`, `STT_PARTIAL`, `STT_FINAL`, `AGENT_RESPONSE`, `AUDIO_CHUNK` (TTS), `ANIMATION_CMD`, `COACHING_HINT`, `VAD_INTERRUPT`, `TIMER_UPDATE`, `SESSION_END`, `ERROR`

---

## Voice Pipeline — One Turn

```
1. AUDIO_CHUNK → deepgramClient streams PCM to Deepgram
2. Deepgram → STT_PARTIAL (forwarded to client for display)
3. Deepgram → STT_FINAL → VoicePipelineOrchestrator

4. Orchestrator dispatches concurrently:
   a. lawyerCoach.evaluate(question, caseContext) → CoachingHint (2s budget)
   b. witness.respond(question, caseContext, agentState) → { text, stressLevel, objection? }
   c. judge.rule(witnessObjection | question, caseContext, agentState) → { ruling, text }

5. Objection resolution:
   - ruling = 'sustained'  → send judge text only, ANIMATION_CMD gavel-slam, prompt rephrase
   - ruling = 'overruled'  → send both witness + judge text
   - ruling = 'warning'    → send judge warning, update agentState
   - ruling = 'contempt'   → send SESSION_END (reason: 'contempt')

6. TTS: rumikClient.synthesize(text, voiceId) → stream audio back as AUDIO_CHUNK chunks
   - If TTS times out (3s): send AGENT_RESPONSE text only, log failure

7. ANIMATION_CMD: talking (TTS start) → idle (TTS end)
   Witness stress increase → stressed / very-stressed sprite
   Judge ruling → gavel-slam

8. COACHING_HINT sent to client
9. Each turn appended to transcript via transcriptLogger

10. TIMER_UPDATE sent every 1s; at 0ms → SESSION_END (reason: 'timeout')
```

---

## Harvey (PDF Analysis)

1. `pdf-parse` extracts raw text from PDF buffer
2. Gemini prompt requests structured JSON: `{ caseId, summary, evidenceItems[], keyFacts[], inconsistencies[] }`
3. 30-second timeout enforced; timeout → status `'error'`
4. If `pdf-parse` throws (corrupt PDF) or text extraction yields no content (scanned PDF): status `'error'` with descriptive message
5. On success: `uploadStore` record updated to `status: 'ready'`, `caseContext` attached

---

## Agent Design

### WitnessAgent
- Gemini `startChat()` with system prompt containing `CaseContext` facts + inconsistencies
- Tracks `agentState.witnessStress` (0–100); increments when user question hits an inconsistency
- Returns `{ text: string, stressLevel: number, objection?: string }`

### JudgeAgent
- Separate Gemini `startChat()` with courtroom rules + `CaseContext` summary
- Tracks `agentState.judgePatience` (0–100); decrements on sustained objections
- Tracks `agentState.sustainedObjectionsInARow`; at 3 in a row → `ruling: 'warning'`
- At `judgePatience === 0` → `ruling: 'contempt'`
- Returns `{ ruling: 'sustained' | 'overruled' | 'warning' | 'contempt', text: string }`

### LawyerCoach
- Stateless Gemini call (no chat history) per question
- Evaluates legal strength: `'strong' | 'moderate' | 'weak'`
- Returns `CoachingHint { strength, suggestion, phase: 'pre-turn' }`
- If unavailable: session continues, client notified via `ERROR { code: 'COACHING_UNAVAILABLE' }`

---

## Session Store

In-memory `Map<sessionId, ActiveSession>`. Interface:
- `create(sessionId, caseContext)` → `ActiveSession`
- `get(sessionId)` → `ActiveSession | undefined`
- `update(sessionId, patch)` → void
- `destroy(sessionId)` → void (clears `killTimer`, removes from map)

`destroy` is called by: hard-kill setTimeout, `SESSION_END_REQUEST`, contempt event.

---

## Security

- All API keys in `.env` only (never sent to client)
- JWT signed with `JWT_SECRET` env var; expiry = 10 min
- WS connection rejected on invalid/missing token
- Session data isolated by `sessionId`; cross-session access not possible via the store API
- PDF buffer stored in-memory only; discarded after Harvey analysis completes

---

## Environment Variables

```
GEMINI_API_KEY=
DEEPGRAM_API_KEY=
RUMIK_API_KEY=
RUMIK_WITNESS_VOICE_ID=
RUMIK_JUDGE_VOICE_ID=
JWT_SECRET=
PORT=8080
```
