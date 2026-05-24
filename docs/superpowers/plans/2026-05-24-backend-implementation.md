# Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully working backend for the Pixel-Art Legal Cross-Examination Simulator — real Harvey PDF analysis via Gemini, JWT-secured sessions, and a standalone WebSocket server that runs Deepgram STT → multi-agent Gemini → RumiK SILK TTS.

**Architecture:** The Next.js frontend (port 3000) owns the REST API (`/api/upload`, `/api/session/start`) as Route Handlers; we replace their mock internals with real Gemini/JWT logic. A separate Node.js server (`backend/`, port 8080) owns the WebSocket at `/ws`; it validates the JWT, runs Deepgram STT per session, dispatches to three Gemini agents (Witness, Judge, LawyerCoach), and streams RumiK TTS audio back as Int16 PCM over WebSocket.

**Tech Stack:** Node.js 20+, TypeScript 5, Express-free WS-only server (`ws` lib), `@google/generative-ai`, `@deepgram/sdk` v3, `jsonwebtoken`, `pdf-parse`, `uuid`, `tsx` (dev runner).

---

## File Map

### New files — `backend/`
| File | Responsibility |
|---|---|
| `backend/package.json` | Dependencies + scripts |
| `backend/tsconfig.json` | TypeScript config |
| `backend/.env.example` | Env var documentation |
| `backend/src/types.ts` | Shared types (copy of relevant frontend types) |
| `backend/src/auth/jwt.ts` | Verify JWT, extract `{ sessionId, caseContext }` |
| `backend/src/store/sessionStore.ts` | In-memory `Map<sessionId, ActiveSession>` |
| `backend/src/transcript/transcriptLogger.ts` | Append `CourtroomTranscriptEntry` to session |
| `backend/src/stt/deepgramClient.ts` | Deepgram Live WS per session |
| `backend/src/tts/rumikClient.ts` | RumiK SILK HTTP TTS → PCM chunks |
| `backend/src/harvey/harveyAnalyzer.ts` | Gemini PDF-text → `CaseContext` JSON |
| `backend/src/agents/witness.ts` | Gemini witness (stress tracking) |
| `backend/src/agents/judge.ts` | Gemini judge (patience tracking) |
| `backend/src/agents/lawyerCoach.ts` | Gemini coaching hint (stateless) |
| `backend/src/pipeline/VoicePipelineOrchestrator.ts` | STT→agents→TTS coordinator |
| `backend/src/ws/wsServer.ts` | WS server: auth, routing, TTL |
| `backend/src/index.ts` | Entry point |

### Modified files — `frontend/`
| File | Change |
|---|---|
| `frontend/package.json` | Add `pdf-parse`, `@google/generative-ai`, `jsonwebtoken` + types |
| `frontend/lib/server/uploadStore.ts` | Accept PDF buffer, trigger real Gemini Harvey analysis |
| `frontend/lib/server/harveyAnalyzer.ts` | **New** — Gemini call → `CaseContext` |
| `frontend/app/api/upload/route.ts` | Extract file buffer, pass to Harvey |
| `frontend/app/api/session/start/route.ts` | Issue real JWT embedding `caseContext` |

---

## Task 1: Backend project scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "jolly-backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "@deepgram/sdk": "^3.9.0",
    "@google/generative-ai": "^0.21.0",
    "jsonwebtoken": "^9.0.2",
    "uuid": "^9.0.1",
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^20.17.0",
    "@types/uuid": "^9.0.8",
    "@types/ws": "^8.5.13",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.4",
    "tsx": "^4.19.0",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `backend/.env.example`**

```
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
DEEPGRAM_API_KEY=
RUMIK_BASE_URL=https://api.rumik.ai
RUMIK_API_KEY=
RUMIK_WITNESS_VOICE_ID=
RUMIK_JUDGE_VOICE_ID=
RUMIK_SAMPLE_RATE=24000
JWT_SECRET=change-me-at-least-32-chars
PORT=8080
```

- [ ] **Step 4: Create `backend/.env` from the example (fill in real keys)**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and fill in all API keys
```

- [ ] **Step 5: Install dependencies**

Run from `backend/`:
```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Create `backend/jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
```

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/.env.example backend/jest.config.js
git commit -m "feat: scaffold standalone backend project"
```

---

## Task 2: Backend shared types

**Files:**
- Create: `backend/src/types.ts`

- [ ] **Step 1: Create `backend/src/types.ts`**

```typescript
// Mirrors the relevant types from frontend/types.ts.
// Do NOT import from frontend — this is a standalone project.

export interface CaseContext {
  caseId: string;
  summary: string;
  evidenceItems: EvidenceItem[];
  keyFacts: string[];
  inconsistencies: Inconsistency[];
}

export interface EvidenceItem {
  id: string;
  description: string;
  relevance: 'high' | 'medium' | 'low';
}

export interface Inconsistency {
  id: string;
  description: string;
  involvedFacts: string[];
}

export interface AgentState {
  witnessStress: number;    // 0–100
  judgePatience: number;    // 0–100
  sustainedObjectionsInARow: number;
}

export interface ActiveSession {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
  caseContext: CaseContext;
  agentState: AgentState;
  transcript: CourtroomTranscriptEntry[];
  status: 'active' | 'ended' | 'expired';
  killTimer: ReturnType<typeof setTimeout>;
}

export interface CourtroomTranscriptEntry {
  entryId: string;
  sessionId: string;
  speaker: 'lawyer' | 'witness' | 'judge' | 'system';
  text: string;
  timestamp: number;
}

export interface CoachingHint {
  strength: 'strong' | 'moderate' | 'weak';
  suggestion: string;
  phase: 'pre-turn' | 'post-turn';
}

export type AnimationType =
  | 'idle'
  | 'talking'
  | 'stressed'
  | 'very-stressed'
  | 'gavel-slam'
  | 'zoom-in'
  | 'contempt';

export type AnimationTarget = 'witness' | 'judge' | 'lawyer';
export type AgentSpeaker = 'witness' | 'judge';
export type SessionEndReason = 'timeout' | 'contempt' | 'user';

// WebSocket message types (server → client)
export type ServerToClientMessage =
  | { type: 'SESSION_READY'; sessionId: string; expiresAt: number }
  | { type: 'STT_PARTIAL'; text: string }
  | { type: 'STT_FINAL'; text: string }
  | { type: 'AGENT_RESPONSE'; speaker: AgentSpeaker; text: string }
  | { type: 'AUDIO_CHUNK'; data: string; speaker: AgentSpeaker }
  | { type: 'ANIMATION_CMD'; target: AnimationTarget; animation: AnimationType }
  | { type: 'COACHING_HINT'; hint: CoachingHint }
  | { type: 'VAD_INTERRUPT' }
  | { type: 'TIMER_UPDATE'; remainingMs: number }
  | { type: 'SESSION_END'; reason: SessionEndReason; transcript: CourtroomTranscriptEntry[] }
  | { type: 'ERROR'; code: string; message: string };

// WebSocket message types (client → server)
export type ClientToServerMessage =
  | { type: 'AUTH'; token: string }
  | { type: 'AUDIO_CHUNK'; data: string; sampleRate: number }
  | { type: 'SESSION_END_REQUEST' };

export interface JwtPayload {
  sessionId: string;
  caseContext: CaseContext;
  iat?: number;
  exp?: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/types.ts
git commit -m "feat: add shared types for backend"
```

---

## Task 3: JWT auth module

**Files:**
- Create: `backend/src/auth/jwt.ts`
- Create: `backend/src/auth/jwt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/jwt.test.ts`:

```typescript
import { verifyToken, signToken } from './jwt';
import type { JwtPayload } from '../types';

const TEST_SECRET = 'test-secret-at-least-32-chars-long';
const MOCK_CONTEXT = {
  caseId: 'case-1',
  summary: 'test',
  evidenceItems: [],
  keyFacts: [],
  inconsistencies: [],
};

describe('JWT auth', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, JWT_SECRET: TEST_SECRET };
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('signs and verifies a token round-trip', () => {
    const token = signToken('session-abc', MOCK_CONTEXT);
    const payload = verifyToken(token) as JwtPayload;
    expect(payload.sessionId).toBe('session-abc');
    expect(payload.caseContext.caseId).toBe('case-1');
  });

  it('returns null for an invalid token', () => {
    expect(verifyToken('bad.token.here')).toBeNull();
  });

  it('returns null for a token signed with wrong secret', () => {
    process.env.JWT_SECRET = 'other-secret-at-least-32-chars!!';
    const token = signToken('session-xyz', MOCK_CONTEXT);
    process.env.JWT_SECRET = TEST_SECRET;
    expect(verifyToken(token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx jest src/auth/jwt.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './jwt'`

- [ ] **Step 3: Create `backend/src/auth/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';
import type { JwtPayload, CaseContext } from '../types';

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET env var is not set');
  return s;
}

export function signToken(sessionId: string, caseContext: CaseContext): string {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = { sessionId, caseContext };
  return jwt.sign(payload, secret(), { expiresIn: '10m' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, secret()) as JwtPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npx jest src/auth/jwt.test.ts --no-coverage
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth/jwt.ts backend/src/auth/jwt.test.ts
git commit -m "feat: add JWT sign/verify module"
```

---

## Task 4: Session store

**Files:**
- Create: `backend/src/store/sessionStore.ts`
- Create: `backend/src/store/sessionStore.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/src/store/sessionStore.test.ts`:

```typescript
import { createSession, getSession, destroySession } from './sessionStore';

const MOCK_CTX = {
  caseId: 'c1',
  summary: '',
  evidenceItems: [],
  keyFacts: [],
  inconsistencies: [],
};

describe('sessionStore', () => {
  afterEach(() => {
    // destroy any sessions created during tests
  });

  it('creates a session and retrieves it', () => {
    const session = createSession('sess-1', MOCK_CTX, jest.fn());
    expect(session.sessionId).toBe('sess-1');
    expect(session.status).toBe('active');
    expect(session.agentState.witnessStress).toBe(50);
    expect(session.agentState.judgePatience).toBe(100);
    const retrieved = getSession('sess-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe('sess-1');
    destroySession('sess-1');
  });

  it('returns undefined for unknown sessionId', () => {
    expect(getSession('does-not-exist')).toBeUndefined();
  });

  it('destroys a session and cleans it up', () => {
    createSession('sess-2', MOCK_CTX, jest.fn());
    destroySession('sess-2');
    expect(getSession('sess-2')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
cd backend && npx jest src/store/sessionStore.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './sessionStore'`

- [ ] **Step 3: Create `backend/src/store/sessionStore.ts`**

```typescript
import type { ActiveSession, CaseContext, AgentState } from '../types';

const sessions = new Map<string, ActiveSession>();

export function createSession(
  sessionId: string,
  caseContext: CaseContext,
  onExpiry: (sessionId: string) => void
): ActiveSession {
  const createdAt = Date.now();
  const expiresAt = createdAt + 600_000;

  const agentState: AgentState = {
    witnessStress: 50,
    judgePatience: 100,
    sustainedObjectionsInARow: 0,
  };

  const killTimer = setTimeout(() => {
    onExpiry(sessionId);
  }, 600_000);

  const session: ActiveSession = {
    sessionId,
    createdAt,
    expiresAt,
    caseContext,
    agentState,
    transcript: [],
    status: 'active',
    killTimer,
  };

  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): ActiveSession | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, patch: Partial<Omit<ActiveSession, 'sessionId'>>): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.set(sessionId, { ...session, ...patch });
}

export function destroySession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  clearTimeout(session.killTimer);
  sessions.delete(sessionId);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npx jest src/store/sessionStore.test.ts --no-coverage
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/store/sessionStore.ts backend/src/store/sessionStore.test.ts
git commit -m "feat: add in-memory session store"
```

---

## Task 5: Transcript logger

**Files:**
- Create: `backend/src/transcript/transcriptLogger.ts`

- [ ] **Step 1: Create `backend/src/transcript/transcriptLogger.ts`**

```typescript
import { v4 as uuidv4 } from 'uuid';
import { getSession, updateSession } from '../store/sessionStore';
import type { CourtroomTranscriptEntry } from '../types';

export function appendEntry(
  sessionId: string,
  speaker: CourtroomTranscriptEntry['speaker'],
  text: string
): void {
  const session = getSession(sessionId);
  if (!session) return;

  const entry: CourtroomTranscriptEntry = {
    entryId: uuidv4(),
    sessionId,
    speaker,
    text,
    timestamp: Date.now(),
  };

  updateSession(sessionId, {
    transcript: [...session.transcript, entry],
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/transcript/transcriptLogger.ts
git commit -m "feat: add transcript logger"
```

---

## Task 6: Deepgram STT client

**Files:**
- Create: `backend/src/stt/deepgramClient.ts`

- [ ] **Step 1: Create `backend/src/stt/deepgramClient.ts`**

```typescript
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type WebSocket from 'ws';
import type { ServerToClientMessage } from '../types';

type SendFn = (msg: ServerToClientMessage) => void;

export class DeepgramSession {
  private connection: ReturnType<typeof createClient>['listen']['live'] extends infer T ? (T extends (...args: unknown[]) => infer R ? R : never) : never;
  private live: ReturnType<typeof createClient>['listen'];
  private active = false;

  constructor(
    private readonly sessionId: string,
    private readonly send: SendFn,
    private readonly onFinalTranscript: (text: string) => void
  ) {}

  start(sampleRate: number): void {
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);
    const conn = deepgram.listen.live({
      encoding: 'linear16',
      sample_rate: sampleRate,
      channels: 1,
      model: 'nova-2',
      interim_results: true,
      smart_format: true,
    });

    conn.on(LiveTranscriptionEvents.Open, () => {
      this.active = true;
    });

    conn.on(LiveTranscriptionEvents.Transcript, (data) => {
      const alt = data.channel?.alternatives?.[0];
      if (!alt?.transcript) return;

      if (data.is_final) {
        this.send({ type: 'STT_FINAL', text: alt.transcript });
        this.onFinalTranscript(alt.transcript);
      } else {
        this.send({ type: 'STT_PARTIAL', text: alt.transcript });
      }
    });

    conn.on(LiveTranscriptionEvents.Error, () => {
      this.active = false;
      this.send({
        type: 'ERROR',
        code: 'STT_ERROR',
        message: 'Speech recognition disconnected. Attempting to reconnect.',
      });
      setTimeout(() => this.start(sampleRate), 2000);
    });

    conn.on(LiveTranscriptionEvents.Close, () => {
      this.active = false;
    });

    // @ts-expect-error — store connection reference
    this.connection = conn;
  }

  sendAudio(pcmBuffer: Buffer): void {
    if (!this.active) return;
    // @ts-expect-error — send raw bytes
    this.connection?.send(pcmBuffer);
  }

  stop(): void {
    this.active = false;
    // @ts-expect-error — finish connection
    this.connection?.finish?.();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/stt/deepgramClient.ts
git commit -m "feat: add Deepgram live STT client"
```

---

## Task 7: RumiK TTS client

**Files:**
- Create: `backend/src/tts/rumikClient.ts`

The RumiK SILK API is a REST endpoint. Set `RUMIK_BASE_URL`, `RUMIK_API_KEY`, and voice IDs in `.env`. The endpoint accepts `POST /v1/synthesize` with JSON body `{ text, speaker_id, audio_format }` and returns raw PCM 16-bit little-endian audio. Adjust the implementation if the actual RumiK endpoint differs.

- [ ] **Step 1: Create `backend/src/tts/rumikClient.ts`**

```typescript
import type { AgentSpeaker } from '../types';

const CHUNK_BYTES = 960 * 2; // 20 ms at 24 kHz, 1 channel, Int16 = 960 samples × 2 bytes
const TTS_TIMEOUT_MS = 3000;

export type AudioChunkCallback = (base64Chunk: string) => void;
export type TtsDoneCallback = () => void;

function voiceId(speaker: AgentSpeaker): string {
  if (speaker === 'witness') {
    return process.env.RUMIK_WITNESS_VOICE_ID ?? 'witness-default';
  }
  return process.env.RUMIK_JUDGE_VOICE_ID ?? 'judge-default';
}

export async function synthesize(
  text: string,
  speaker: AgentSpeaker,
  onChunk: AudioChunkCallback,
  onDone: TtsDoneCallback
): Promise<void> {
  const baseUrl = process.env.RUMIK_BASE_URL;
  const apiKey = process.env.RUMIK_API_KEY;
  const sampleRate = parseInt(process.env.RUMIK_SAMPLE_RATE ?? '24000', 10);

  if (!baseUrl || !apiKey) {
    // TTS not configured — skip audio, caller falls back to text-only
    onDone();
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/v1/synthesize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        speaker_id: voiceId(speaker),
        audio_format: 'pcm_16bit',
        sample_rate: sampleRate,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok || !response.body) {
      onDone();
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Split into 20 ms chunks and emit
    for (let offset = 0; offset < buffer.length; offset += CHUNK_BYTES) {
      const chunk = buffer.subarray(offset, offset + CHUNK_BYTES);
      onChunk(chunk.toString('base64'));
    }
  } catch {
    clearTimeout(timeout);
    // Timeout or network error — fall through to onDone (text-only fallback)
  }

  onDone();
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/tts/rumikClient.ts
git commit -m "feat: add RumiK SILK TTS client"
```

---

## Task 8: Harvey analyzer (backend)

**Files:**
- Create: `backend/src/harvey/harveyAnalyzer.ts`
- Create: `backend/src/harvey/harveyAnalyzer.test.ts`

This module is used server-side in the Next.js API routes, **not** in the standalone WS backend. However, the implementation code lives here so it can be shared. In Task 15, the Next.js frontend will import this logic by duplicating it (or via a symlink — see Task 15 for details).

- [ ] **Step 1: Write the failing test**

Create `backend/src/harvey/harveyAnalyzer.test.ts`:

```typescript
import { parseCaseContext } from './harveyAnalyzer';

describe('parseCaseContext', () => {
  it('parses valid Gemini JSON response', () => {
    const raw = JSON.stringify({
      caseId: 'case-abc',
      summary: 'A theft case.',
      evidenceItems: [{ id: 'e1', description: 'CCTV', relevance: 'high' }],
      keyFacts: ['suspect seen at 9pm'],
      inconsistencies: [{ id: 'i1', description: 'lighting mismatch', involvedFacts: [] }],
    });
    const ctx = parseCaseContext(raw, 'abc.pdf');
    expect(ctx.caseId).toBe('case-abc');
    expect(ctx.evidenceItems).toHaveLength(1);
  });

  it('falls back to filename-based caseId if missing', () => {
    const raw = JSON.stringify({
      summary: 'Case summary',
      evidenceItems: [],
      keyFacts: [],
      inconsistencies: [],
    });
    const ctx = parseCaseContext(raw, 'my-case.pdf');
    expect(ctx.caseId).toBe('case-my-case');
  });

  it('throws on unparseable response', () => {
    expect(() => parseCaseContext('not json at all { }', 'x.pdf')).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && npx jest src/harvey/harveyAnalyzer.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module './harveyAnalyzer'`

- [ ] **Step 3: Create `backend/src/harvey/harveyAnalyzer.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext } from '../types';

const HARVEY_PROMPT = `You are Harvey, a legal case analyst. Analyze the following case document text and return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "caseId": "case-<short-slug>",
  "summary": "2–3 sentence case summary",
  "evidenceItems": [
    { "id": "ev-1", "description": "...", "relevance": "high|medium|low" }
  ],
  "keyFacts": ["fact 1", "fact 2"],
  "inconsistencies": [
    { "id": "inc-1", "description": "...", "involvedFacts": ["fact 1"] }
  ]
}

Document text:
`;

const ANALYSIS_TIMEOUT_MS = 30_000;

export function parseCaseContext(rawJson: string, fileName: string): CaseContext {
  // Strip markdown code fences if Gemini wraps in them
  const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: Partial<CaseContext>;
  try {
    parsed = JSON.parse(cleaned) as Partial<CaseContext>;
  } catch {
    throw new Error(`Harvey returned unparseable JSON: ${cleaned.slice(0, 200)}`);
  }

  const slug = fileName.replace(/\.pdf$/i, '').replace(/\s+/g, '-').toLowerCase();

  return {
    caseId: parsed.caseId ?? `case-${slug}`,
    summary: parsed.summary ?? '',
    evidenceItems: parsed.evidenceItems ?? [],
    keyFacts: parsed.keyFacts ?? [],
    inconsistencies: parsed.inconsistencies ?? [],
  };
}

export async function analyzeDocument(pdfText: string, fileName: string): Promise<CaseContext> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const gemini = genAI.getGenerativeModel({ model });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Harvey analysis timed out after 30s')), ANALYSIS_TIMEOUT_MS)
  );

  const analysisPromise = gemini
    .generateContent(HARVEY_PROMPT + pdfText)
    .then((result) => result.response.text());

  const rawJson = await Promise.race([analysisPromise, timeoutPromise]);
  return parseCaseContext(rawJson, fileName);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && npx jest src/harvey/harveyAnalyzer.test.ts --no-coverage
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/harvey/harveyAnalyzer.ts backend/src/harvey/harveyAnalyzer.test.ts
git commit -m "feat: add Harvey PDF analyzer with Gemini"
```

---

## Task 9: Witness agent

**Files:**
- Create: `backend/src/agents/witness.ts`

- [ ] **Step 1: Create `backend/src/agents/witness.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext, AgentState } from '../types';

export interface WitnessResponse {
  text: string;
  stressLevel: number;
  objection?: string;
}

function buildSystemPrompt(ctx: CaseContext): string {
  return `You are a witness in a cross-examination. You are defending your position.

Case summary: ${ctx.summary}

Key facts you know:
${ctx.keyFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Evidence supporting your testimony:
${ctx.evidenceItems.map((e) => `- ${e.description} (relevance: ${e.relevance})`).join('\n')}

Known weaknesses in your testimony (do NOT reveal these directly — get evasive or stressed when these are probed):
${ctx.inconsistencies.map((inc) => `- ${inc.description}`).join('\n')}

Behavior rules:
1. Answer questions defensively but believably.
2. If the lawyer's question directly hits a weakness/inconsistency, add "(STRESSED)" at the start of your response and get noticeably evasive.
3. If the question is leading or assumes facts not in evidence, start your response with "(OBJECTION: <basis>)" where basis is the legal objection.
4. Keep responses under 3 sentences.
5. Never break character.

Respond ONLY as the witness. No stage directions except the prefixes above.`;
}

export class WitnessAgent {
  private chat: ReturnType<InstanceType<typeof GoogleGenerativeAI>['getGenerativeModel']>['startChat'] extends (...args: infer A) => infer R ? R : never;
  private initialized = false;

  constructor(
    private readonly caseContext: CaseContext
  ) {}

  private ensureChat() {
    if (this.initialized) return;
    const apiKey = process.env.GEMINI_API_KEY!;
    const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: buildSystemPrompt(this.caseContext),
    });
    // @ts-expect-error — store chat instance
    this.chat = geminiModel.startChat({ history: [] });
    this.initialized = true;
  }

  async respond(question: string, agentState: AgentState): Promise<WitnessResponse> {
    this.ensureChat();

    const prompt = `[Witness stress level: ${agentState.witnessStress}/100] Lawyer asks: "${question}"`;

    let text: string;
    try {
      // @ts-expect-error — dynamic chat reference
      const result = await this.chat.sendMessage(prompt);
      text = result.response.text().trim();
    } catch {
      text = 'I... I need a moment. Could you repeat the question?';
    }

    // Parse stress signal
    const isStressed = text.startsWith('(STRESSED)');
    if (isStressed) {
      text = text.replace(/^\(STRESSED\)\s*/, '');
    }

    // Parse objection
    const objectionMatch = text.match(/^\(OBJECTION:\s*([^)]+)\)/i);
    const objection = objectionMatch ? objectionMatch[1].trim() : undefined;
    if (objection) {
      text = text.replace(/^\(OBJECTION:[^)]+\)\s*/i, '');
    }

    // Update stress: +10 if stressed, but clamp to 0–100
    const newStress = isStressed
      ? Math.min(100, agentState.witnessStress + 10)
      : agentState.witnessStress;

    return { text, stressLevel: newStress, objection };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/agents/witness.ts
git commit -m "feat: add Gemini witness agent"
```

---

## Task 10: Judge agent

**Files:**
- Create: `backend/src/agents/judge.ts`

- [ ] **Step 1: Create `backend/src/agents/judge.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext, AgentState } from '../types';

export type JudgeRuling = 'sustained' | 'overruled' | 'warning' | 'contempt';

export interface JudgeResponse {
  ruling: JudgeRuling;
  text: string;
}

function buildSystemPrompt(ctx: CaseContext): string {
  return `You are the presiding judge in a cross-examination. Your role is to rule on objections and maintain courtroom order.

Case summary: ${ctx.summary}

Your rules:
1. When the witness raises an objection, respond with EXACTLY one of:
   - "(SUSTAINED) <your ruling statement>" — if the objection is legally valid
   - "(OVERRULED) <your ruling statement>" — if the lawyer's question was proper
2. If the lawyer has been warned before and continues to misbehave, or if the judge patience is very low, respond with "(CONTEMPT) <contempt statement>".
3. If the lawyer has 3+ sustained objections in a row, respond with "(WARNING) <warning statement>".
4. Keep your ruling under 2 sentences. Be authoritative.
5. Never break character. You are a strict but fair judge.`;
}

export class JudgeAgent {
  private chat: unknown;
  private initialized = false;

  constructor(private readonly caseContext: CaseContext) {}

  private ensureChat() {
    if (this.initialized) return;
    const apiKey = process.env.GEMINI_API_KEY!;
    const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({
      model,
      systemInstruction: buildSystemPrompt(this.caseContext),
    });
    this.chat = geminiModel.startChat({ history: [] });
    this.initialized = true;
  }

  async rule(
    witnessObjection: string | undefined,
    lawyerQuestion: string,
    agentState: AgentState
  ): Promise<JudgeResponse> {
    this.ensureChat();

    const prompt = witnessObjection
      ? `[Judge patience: ${agentState.judgePatience}/100, sustained in a row: ${agentState.sustainedObjectionsInARow}] Witness objects: "${witnessObjection}" to lawyer's question: "${lawyerQuestion}"`
      : `[Judge patience: ${agentState.judgePatience}/100] Lawyer asks (no objection): "${lawyerQuestion}" — no ruling needed, respond with "(OVERRULED) No objection raised, proceed."`;

    let text: string;
    try {
      // @ts-expect-error — dynamic chat reference
      const result = await (this.chat as { sendMessage: (p: string) => Promise<{ response: { text: () => string } }> }).sendMessage(prompt);
      text = result.response.text().trim();
    } catch {
      text = '(OVERRULED) Proceed, counsel.';
    }

    const ruling = parseRuling(text);
    const cleaned = text.replace(/^\((?:SUSTAINED|OVERRULED|WARNING|CONTEMPT)\)\s*/i, '');
    return { ruling, text: cleaned };
  }
}

function parseRuling(text: string): JudgeRuling {
  if (/^\(CONTEMPT\)/i.test(text)) return 'contempt';
  if (/^\(WARNING\)/i.test(text)) return 'warning';
  if (/^\(SUSTAINED\)/i.test(text)) return 'sustained';
  return 'overruled';
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/agents/judge.ts
git commit -m "feat: add Gemini judge agent"
```

---

## Task 11: Lawyer coach

**Files:**
- Create: `backend/src/agents/lawyerCoach.ts`

- [ ] **Step 1: Create `backend/src/agents/lawyerCoach.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext, CoachingHint } from '../types';

const PROMPT_TEMPLATE = (question: string, caseContext: CaseContext, phase: 'pre-turn' | 'post-turn') => `
You are a legal strategist coaching a junior lawyer in a cross-examination.

Case context:
Summary: ${caseContext.summary}
Key facts: ${caseContext.keyFacts.join('; ')}
Known inconsistencies: ${caseContext.inconsistencies.map((i) => i.description).join('; ')}

The lawyer just ${phase === 'pre-turn' ? 'is about to ask' : 'asked'}: "${question}"

Evaluate the strategic strength of this question and respond ONLY with valid JSON (no markdown):
{
  "strength": "strong" | "moderate" | "weak",
  "suggestion": "one sentence of coaching advice"
}
`;

export async function evaluateQuestion(
  question: string,
  caseContext: CaseContext,
  phase: 'pre-turn' | 'post-turn' = 'pre-turn'
): Promise<CoachingHint | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({ model });

    const result = await Promise.race([
      gemini.generateContent(PROMPT_TEMPLATE(question, caseContext, phase)),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('coaching timeout')), 2000)
      ),
    ]);

    const raw = (result as Awaited<ReturnType<typeof gemini.generateContent>>)
      .response.text()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const parsed = JSON.parse(raw) as { strength: CoachingHint['strength']; suggestion: string };
    return { strength: parsed.strength, suggestion: parsed.suggestion, phase };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/agents/lawyerCoach.ts
git commit -m "feat: add Gemini lawyer coach agent"
```

---

## Task 12: Voice pipeline orchestrator

**Files:**
- Create: `backend/src/pipeline/VoicePipelineOrchestrator.ts`

- [ ] **Step 1: Create `backend/src/pipeline/VoicePipelineOrchestrator.ts`**

```typescript
import type { ServerToClientMessage, AgentState, SessionEndReason } from '../types';
import { DeepgramSession } from '../stt/deepgramClient';
import { synthesize } from '../tts/rumikClient';
import { WitnessAgent } from '../agents/witness';
import { JudgeAgent } from '../agents/judge';
import { evaluateQuestion } from '../agents/lawyerCoach';
import { getSession, updateSession, destroySession } from '../store/sessionStore';
import { appendEntry } from '../transcript/transcriptLogger';

type SendFn = (msg: ServerToClientMessage) => void;

export class VoicePipelineOrchestrator {
  private deepgramSession: DeepgramSession;
  private witnessAgent: WitnessAgent;
  private judgeAgent: JudgeAgent;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private ttsPlaying = false;
  private currentSampleRate = 16000;

  constructor(
    private readonly sessionId: string,
    private readonly send: SendFn,
    private readonly onSessionEnd: (reason: SessionEndReason) => void
  ) {
    const session = getSession(sessionId)!;
    this.witnessAgent = new WitnessAgent(session.caseContext);
    this.judgeAgent = new JudgeAgent(session.caseContext);
    this.deepgramSession = new DeepgramSession(
      sessionId,
      send,
      (text) => this.handleFinalTranscript(text)
    );
  }

  start(): void {
    this.deepgramSession.start(this.currentSampleRate);
    this.startTimer();

    const session = getSession(this.sessionId)!;
    appendEntry(this.sessionId, 'system', 'Session started. Cross-examination in progress.');

    this.send({
      type: 'SESSION_READY',
      sessionId: this.sessionId,
      expiresAt: session.expiresAt,
    });
  }

  handleAudioChunk(base64Pcm: string, sampleRate: number): void {
    if (sampleRate !== this.currentSampleRate) {
      this.currentSampleRate = sampleRate;
    }

    // VAD interrupt: if TTS is playing and user speaks, stop TTS
    if (this.ttsPlaying) {
      this.send({ type: 'VAD_INTERRUPT' });
      this.ttsPlaying = false;
    }

    const pcmBuffer = Buffer.from(base64Pcm, 'base64');
    this.deepgramSession.sendAudio(pcmBuffer);
  }

  endSession(reason: SessionEndReason): void {
    this.cleanup();
    this.onSessionEnd(reason);
  }

  private async handleFinalTranscript(question: string): Promise<void> {
    const session = getSession(this.sessionId);
    if (!session || session.status !== 'active') return;

    appendEntry(this.sessionId, 'lawyer', question);

    // Dispatch coaching + witness + judge concurrently
    const [coachingHint, witnessResponse] = await Promise.all([
      evaluateQuestion(question, session.caseContext, 'pre-turn'),
      this.witnessAgent.respond(question, session.agentState),
    ]);

    // Send coaching hint if available
    if (coachingHint) {
      this.send({ type: 'COACHING_HINT', hint: coachingHint });
    }

    // Judge evaluates witness objection (if any)
    const judgeResponse = await this.judgeAgent.rule(
      witnessResponse.objection,
      question,
      session.agentState
    );

    // Update agent state
    const newStress = witnessResponse.stressLevel;
    let { judgePatience, sustainedObjectionsInARow } = session.agentState;

    if (judgeResponse.ruling === 'sustained') {
      sustainedObjectionsInARow += 1;
      judgePatience = Math.max(0, judgePatience - 10);
    } else if (judgeResponse.ruling === 'overruled') {
      sustainedObjectionsInARow = 0;
      judgePatience = Math.min(100, judgePatience + 5);
    }

    updateSession(this.sessionId, {
      agentState: {
        witnessStress: newStress,
        judgePatience,
        sustainedObjectionsInARow,
      },
    });

    // Animation: witness stress
    if (newStress >= 80) {
      this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'very-stressed' });
    } else if (newStress >= 60) {
      this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'stressed' });
    }

    // Handle contempt
    if (judgeResponse.ruling === 'contempt' || judgePatience <= 0) {
      appendEntry(this.sessionId, 'judge', judgeResponse.text);
      this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
      this.send({ type: 'ANIMATION_CMD', target: 'judge', animation: 'contempt' });
      this.endSession('contempt');
      return;
    }

    // Handle warning
    if (judgeResponse.ruling === 'warning') {
      appendEntry(this.sessionId, 'judge', judgeResponse.text);
      this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
      this.send({ type: 'ANIMATION_CMD', target: 'judge', animation: 'gavel-slam' });
    }

    // Handle sustained objection — don't send witness response
    if (judgeResponse.ruling === 'sustained') {
      appendEntry(this.sessionId, 'judge', judgeResponse.text);
      this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
      this.send({ type: 'ANIMATION_CMD', target: 'judge', animation: 'gavel-slam' });
      this.send({
        type: 'ERROR',
        code: 'OBJECTION_SUSTAINED',
        message: 'Objection sustained. Please rephrase your question.',
      });
      return;
    }

    // Send witness response + TTS
    appendEntry(this.sessionId, 'witness', witnessResponse.text);
    this.send({ type: 'AGENT_RESPONSE', speaker: 'witness', text: witnessResponse.text });
    this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'talking' });

    if (judgeResponse.text) {
      appendEntry(this.sessionId, 'judge', judgeResponse.text);
      this.send({ type: 'AGENT_RESPONSE', speaker: 'judge', text: judgeResponse.text });
    }

    // TTS for witness
    this.ttsPlaying = true;
    await synthesize(
      witnessResponse.text,
      'witness',
      (chunk) => this.send({ type: 'AUDIO_CHUNK', data: chunk, speaker: 'witness' }),
      () => {
        this.ttsPlaying = false;
        this.send({ type: 'ANIMATION_CMD', target: 'witness', animation: 'idle' });
      }
    );
  }

  private startTimer(): void {
    const session = getSession(this.sessionId)!;
    this.timerInterval = setInterval(() => {
      const remaining = session.expiresAt - Date.now();
      if (remaining <= 0) {
        this.endSession('timeout');
        return;
      }
      this.send({ type: 'TIMER_UPDATE', remainingMs: remaining });
    }, 1000);
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.deepgramSession.stop();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/pipeline/VoicePipelineOrchestrator.ts
git commit -m "feat: add voice pipeline orchestrator"
```

---

## Task 13: WebSocket server

**Files:**
- Create: `backend/src/ws/wsServer.ts`

- [ ] **Step 1: Create `backend/src/ws/wsServer.ts`**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import { parse as parseUrl } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken } from '../auth/jwt';
import { createSession, destroySession, getSession } from '../store/sessionStore';
import { VoicePipelineOrchestrator } from '../pipeline/VoicePipelineOrchestrator';
import type { ClientToServerMessage, ServerToClientMessage, SessionEndReason } from '../types';

const orchestrators = new Map<string, VoicePipelineOrchestrator>();

function sendTo(ws: WebSocket, message: ServerToClientMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Extract token from query param
    const query = parseUrl(req.url ?? '', true).query;
    const token = typeof query.token === 'string' ? query.token : null;

    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    const { sessionId, caseContext } = payload;

    // Create session + orchestrator
    const session = createSession(sessionId, caseContext, (id) => {
      handleSessionEnd(id, ws, 'timeout');
    });

    const orchestrator = new VoicePipelineOrchestrator(
      sessionId,
      (msg) => sendTo(ws, msg),
      (reason) => handleSessionEnd(sessionId, ws, reason)
    );

    orchestrators.set(sessionId, orchestrator);
    orchestrator.start();

    ws.on('message', (raw) => {
      let message: ClientToServerMessage;
      try {
        message = JSON.parse(String(raw)) as ClientToServerMessage;
      } catch {
        return;
      }

      switch (message.type) {
        case 'AUTH':
          // Token already validated on connection — no-op
          break;

        case 'AUDIO_CHUNK':
          orchestrator.handleAudioChunk(message.data, message.sampleRate);
          break;

        case 'SESSION_END_REQUEST':
          orchestrator.endSession('user');
          break;

        default:
          break;
      }
    });

    ws.on('close', () => {
      // Clean up on disconnect
      const s = getSession(sessionId);
      if (s && s.status === 'active') {
        orchestrators.get(sessionId)?.endSession('user');
      }
      orchestrators.delete(sessionId);
    });

    ws.on('error', () => {
      ws.close();
    });
  });
}

function handleSessionEnd(sessionId: string, ws: WebSocket, reason: SessionEndReason): void {
  const session = getSession(sessionId);
  if (!session) return;

  sendTo(ws, {
    type: 'SESSION_END',
    reason,
    transcript: session.transcript,
  });

  orchestrators.delete(sessionId);
  destroySession(sessionId);

  setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close(1000, 'Session ended');
    }
  }, 500);
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/ws/wsServer.ts
git commit -m "feat: add WebSocket server with JWT auth and session routing"
```

---

## Task 14: Backend entry point

**Files:**
- Create: `backend/src/index.ts`

- [ ] **Step 1: Create `backend/src/index.ts`**

```typescript
import { createServer } from 'http';
import { attachWebSocketServer } from './ws/wsServer';

// Load env vars if not already loaded (production: use a real dotenv loader)
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config();
}

const PORT = parseInt(process.env.PORT ?? '8080', 10);

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Jolly backend running on port ${PORT}`);
  console.log(`WebSocket endpoint: ws://localhost:${PORT}/ws`);
});
```

- [ ] **Step 2: Add `dotenv` dependency**

```bash
cd backend && npm install dotenv
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/index.ts
git commit -m "feat: add backend entry point"
```

- [ ] **Step 4: Verify the backend starts**

```bash
cd backend && npm run dev
```

Expected output:
```
Jolly backend running on port 8080
WebSocket endpoint: ws://localhost:8080/ws
```

---

## Task 15: Next.js — install server-side deps

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install dependencies in the frontend project**

```bash
cd frontend && npm install pdf-parse @google/generative-ai jsonwebtoken
cd frontend && npm install --save-dev @types/pdf-parse @types/jsonwebtoken
```

- [ ] **Step 2: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat: add server-side deps to frontend (pdf-parse, gemini, jwt)"
```

---

## Task 16: Next.js — real Harvey analyzer

**Files:**
- Create: `frontend/lib/server/harveyAnalyzer.ts`

This is the same logic as `backend/src/harvey/harveyAnalyzer.ts` — duplicated here because the Next.js app is a separate project with its own dependencies.

- [ ] **Step 1: Create `frontend/lib/server/harveyAnalyzer.ts`**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext } from '@/types';

const HARVEY_PROMPT = `You are Harvey, a legal case analyst. Analyze the following case document text and return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "caseId": "case-<short-slug>",
  "summary": "2–3 sentence case summary",
  "evidenceItems": [
    { "id": "ev-1", "description": "...", "relevance": "high|medium|low" }
  ],
  "keyFacts": ["fact 1", "fact 2"],
  "inconsistencies": [
    { "id": "inc-1", "description": "...", "involvedFacts": ["fact 1"] }
  ]
}

Document text:
`;

const ANALYSIS_TIMEOUT_MS = 30_000;

function parseCaseContext(rawJson: string, fileName: string): CaseContext {
  const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  let parsed: Partial<CaseContext>;
  try {
    parsed = JSON.parse(cleaned) as Partial<CaseContext>;
  } catch {
    throw new Error(`Harvey returned unparseable JSON: ${cleaned.slice(0, 200)}`);
  }

  const slug = fileName.replace(/\.pdf$/i, '').replace(/\s+/g, '-').toLowerCase();

  return {
    caseId: parsed.caseId ?? `case-${slug}`,
    summary: parsed.summary ?? '',
    evidenceItems: parsed.evidenceItems ?? [],
    keyFacts: parsed.keyFacts ?? [],
    inconsistencies: parsed.inconsistencies ?? [],
  };
}

export async function analyzeDocument(pdfText: string, fileName: string): Promise<CaseContext> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set on server');

  const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const gemini = genAI.getGenerativeModel({ model });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Harvey analysis timed out after 30s')), ANALYSIS_TIMEOUT_MS)
  );

  const analysisPromise = gemini
    .generateContent(HARVEY_PROMPT + pdfText)
    .then((result) => result.response.text());

  const rawJson = await Promise.race([analysisPromise, timeoutPromise]);
  return parseCaseContext(rawJson, fileName);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/server/harveyAnalyzer.ts
git commit -m "feat: add Harvey analyzer to Next.js server lib"
```

---

## Task 17: Next.js — real upload store

**Files:**
- Modify: `frontend/lib/server/uploadStore.ts`

- [ ] **Step 1: Replace `frontend/lib/server/uploadStore.ts`**

Read the current file first. Then replace it entirely:

```typescript
import pdfParse from 'pdf-parse';
import type { CaseContext } from '@/types';
import { analyzeDocument } from './harveyAnalyzer';

export type UploadRecordStatus = 'pending' | 'ready' | 'error';

export interface UploadRecord {
  uploadId: string;
  fileName: string;
  status: UploadRecordStatus;
  caseContext?: CaseContext;
  errorMessage?: string;
  createdAt: number;
}

const uploads = new Map<string, UploadRecord>();

export function createUpload(fileName: string): UploadRecord {
  const uploadId = crypto.randomUUID();
  const record: UploadRecord = {
    uploadId,
    fileName,
    status: 'pending',
    createdAt: Date.now(),
  };
  uploads.set(uploadId, record);
  return record;
}

export async function processUpload(uploadId: string, pdfBuffer: Buffer): Promise<void> {
  const record = uploads.get(uploadId);
  if (!record) return;

  try {
    const parsed = await pdfParse(pdfBuffer);
    const text = parsed.text?.trim();

    if (!text || text.length < 50) {
      uploads.set(uploadId, {
        ...record,
        status: 'error',
        errorMessage:
          'Could not extract text from this PDF. It may be a scanned image. Please upload a text-based PDF.',
      });
      return;
    }

    const caseContext = await analyzeDocument(text, record.fileName);
    uploads.set(uploadId, { ...record, status: 'ready', caseContext });
  } catch (err) {
    uploads.set(uploadId, {
      ...record,
      status: 'error',
      errorMessage: err instanceof Error ? err.message : 'Harvey analysis failed.',
    });
  }
}

export function getUpload(uploadId: string): UploadRecord | undefined {
  return uploads.get(uploadId);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/server/uploadStore.ts
git commit -m "feat: replace mock upload store with real Harvey analysis"
```

---

## Task 18: Next.js — real upload route

**Files:**
- Modify: `frontend/app/api/upload/route.ts`

- [ ] **Step 1: Replace `frontend/app/api/upload/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { createUpload, processUpload } from '@/lib/server/uploadStore';

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'No file provided.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ message: 'Only PDF files are accepted.' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ message: 'File is empty.' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'File exceeds 20 MB limit.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const record = createUpload(file.name);

    // Fire-and-forget — status is polled by frontend
    void processUpload(record.uploadId, buffer);

    return NextResponse.json({ uploadId: record.uploadId });
  } catch {
    return NextResponse.json({ message: 'Upload failed.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/api/upload/route.ts
git commit -m "feat: upload route now buffers PDF and triggers Harvey"
```

---

## Task 19: Next.js — real session/start route

**Files:**
- Modify: `frontend/app/api/session/start/route.ts`

- [ ] **Step 1: Replace `frontend/app/api/session/start/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import type { CaseContext } from '@/types';

interface SessionStartBody {
  caseContext?: CaseContext;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as SessionStartBody;

    if (!body.caseContext?.caseId) {
      return NextResponse.json({ message: 'caseContext is required.' }, { status: 400 });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return NextResponse.json({ message: 'Server misconfiguration: JWT_SECRET not set.' }, { status: 500 });
    }

    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { sessionId, caseContext: body.caseContext },
      jwtSecret,
      { expiresIn: '10m' }
    );

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws';

    return NextResponse.json({ sessionId, wsUrl, token });
  } catch {
    return NextResponse.json({ message: 'Failed to start session.' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add env vars to `frontend/.env.local`**

Create `frontend/.env.local`:
```
GEMINI_API_KEY=<your-gemini-api-key>
GEMINI_MODEL=gemini-1.5-flash
JWT_SECRET=<same-secret-as-backend-env>
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws
NEXT_PUBLIC_USE_MOCK_WS=false
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/session/start/route.ts frontend/.env.local
git commit -m "feat: session/start issues real JWT with caseContext"
```

---

## Task 20: Full integration test

- [ ] **Step 1: Start the backend**

In terminal 1 (from repo root):
```bash
cd backend && npm run dev
```

Expected:
```
Jolly backend running on port 8080
WebSocket endpoint: ws://localhost:8080/ws
```

- [ ] **Step 2: Start the frontend**

In terminal 2 (from repo root):
```bash
cd frontend && npm run dev
```

Expected: `ready on http://localhost:3000`

- [ ] **Step 3: Upload a real PDF and verify Harvey**

1. Open `http://localhost:3000`
2. Upload any text-based PDF (a legal document or anything with real text)
3. The UI should show a loading state, then transition past upload
4. Check terminal 1 — no errors should appear

- [ ] **Step 4: Start a session and verify WebSocket**

1. Click "Start Session" in the UI
2. Browser should connect to `ws://localhost:8080/ws?token=<jwt>`
3. Backend terminal should not log any errors
4. The canvas / session screen should appear

- [ ] **Step 5: Test voice input**

1. Grant microphone access when prompted
2. Speak a question (e.g., "Where were you on the night of March 12th?")
3. Expected sequence in UI: STT partial text appears → STT final fires → Witness responds (text + audio) → coaching hint appears

- [ ] **Step 6: Verify session ends correctly**

1. Click "End Session" or wait for the 10-minute timer
2. Summary screen should appear with the full transcript

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete backend integration — Harvey, JWT sessions, voice pipeline"
```
