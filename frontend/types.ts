import type { Emitter } from 'mitt';

// ─── Data Models ───────────────────────────────────────────────────────────

/** Produced by Harvey MCP pre-session analysis */
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
  /** References keyFacts entries */
  involvedFacts: string[];
}

/** Per-agent emotional/logical parameters */
export interface AgentState {
  /** 0–100; higher = more stressed */
  witnessStress: number;
  /** 0–100; lower = less patient */
  judgePatience: number;
  sustainedObjectionsInARow: number;
}

/** The live session object held in SessionStore */
export interface ActiveSession {
  sessionId: string;
  /** JWT for WebSocket auth */
  token: string;
  /** Unix ms timestamp */
  createdAt: number;
  /** createdAt + 600_000 */
  expiresAt: number;
  caseContext: CaseContext;
  agentState: AgentState;
  transcript: CourtroomTranscriptEntry[];
  status: 'active' | 'ended' | 'expired';
  killTimer: NodeJS.Timeout;
}

/** A single speaker turn in the transcript */
export interface CourtroomTranscriptEntry {
  /** UUID */
  entryId: string;
  sessionId: string;
  speaker: TranscriptSpeaker;
  text: string;
  /** Unix ms */
  timestamp: number;
}

/** Coaching hint returned by Harvey MCP in-session */
export interface CoachingHint {
  strength: 'strong' | 'moderate' | 'weak';
  suggestion: string;
  phase: 'pre-turn' | 'post-turn';
}

// ─── Sprite / Animation ─────────────────────────────────────────────────────

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

export type TranscriptSpeaker = 'lawyer' | 'witness' | 'judge' | 'system';

export type SessionEndReason = 'timeout' | 'contempt' | 'user';

export type SessionStatus = 'active' | 'ended' | 'expired';

// ─── WebSocket Message Protocol ─────────────────────────────────────────────
// All messages are JSON-encoded with a `type` discriminant.

/** Client → Server messages */
export type ClientToServerMessage =
  | AuthMessage
  | AudioChunkClientMessage
  | SessionEndRequestMessage;

export interface AuthMessage {
  type: 'AUTH';
  token: string;
}

export interface AudioChunkClientMessage {
  type: 'AUDIO_CHUNK';
  /** Base64-encoded PCM audio frame */
  data: string;
  sampleRate: number;
}

export interface SessionEndRequestMessage {
  type: 'SESSION_END_REQUEST';
}

/** Server → Client messages */
export type ServerToClientMessage =
  | SessionReadyMessage
  | SttPartialMessage
  | SttFinalMessage
  | AgentResponseMessage
  | AudioChunkServerMessage
  | AnimationCmdMessage
  | CoachingHintMessage
  | VadInterruptMessage
  | TimerUpdateMessage
  | SessionEndMessage
  | ErrorMessage;

export interface SessionReadyMessage {
  type: 'SESSION_READY';
  sessionId: string;
  expiresAt: number;
}

export interface SttPartialMessage {
  type: 'STT_PARTIAL';
  text: string;
}

export interface SttFinalMessage {
  type: 'STT_FINAL';
  text: string;
}

export interface AgentResponseMessage {
  type: 'AGENT_RESPONSE';
  speaker: AgentSpeaker;
  text: string;
}

export interface AudioChunkServerMessage {
  type: 'AUDIO_CHUNK';
  /** Base64-encoded PCM audio frame */
  data: string;
  speaker: AgentSpeaker;
}

export interface AnimationCmdMessage {
  type: 'ANIMATION_CMD';
  target: AnimationTarget;
  animation: AnimationType;
}

export interface CoachingHintMessage {
  type: 'COACHING_HINT';
  hint: CoachingHint;
}

export interface VadInterruptMessage {
  type: 'VAD_INTERRUPT';
}

export interface TimerUpdateMessage {
  type: 'TIMER_UPDATE';
  remainingMs: number;
}

export interface SessionEndMessage {
  type: 'SESSION_END';
  reason: SessionEndReason;
  transcript: CourtroomTranscriptEntry[];
}

export interface ErrorMessage {
  type: 'ERROR';
  code: string;
  message: string;
}

// ─── Event Bus (mitt) ─────────────────────────────────────────────────────────

/** Events emitted on the shared EventBus */
export type EventBusEvents = {
  ws_message: ServerToClientMessage;
  animation_cmd: AnimationCmdMessage;
  coaching_hint: CoachingHintMessage;
  agent_response: AgentResponseMessage;
  stt_partial: SttPartialMessage;
  stt_final: SttFinalMessage;
  session_ready: SessionReadyMessage;
  session_end: SessionEndMessage;
  timer_update: TimerUpdateMessage;
  vad_interrupt: VadInterruptMessage;
  error: ErrorMessage;
  mic_active: { active: boolean };
};

export type EventBus = Emitter<EventBusEvents>;

// ─── Session Summary ────────────────────────────────────────────────────────

/** Score card displayed on the summary screen */
export interface SessionSummaryStats {
  questionsAsked: number;
  objectionsSustained: number;
  objectionsOverruled: number;
  witnessStressReached: number;
}

export interface SessionSummary {
  reason: SessionEndReason;
  transcript: CourtroomTranscriptEntry[];
  stats: SessionSummaryStats;
}

// ─── Screen State ─────────────────────────────────────────────────────────────

export type AppScreen = 'upload' | 'session' | 'summary';

// ─── REST API ───────────────────────────────────────────────────────────────

export interface UploadResponse {
  uploadId: string;
}

export interface UploadStatusResponse {
  status: 'pending' | 'ready' | 'error';
  caseContext?: CaseContext;
  message?: string;
}

export interface SessionStartResponse {
  sessionId: string;
  wsUrl: string;
  token: string;
}

export interface SessionStartRequest {
  caseContext: CaseContext;
}

export type WebSocketConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'mock';

export interface WebSocketClientOptions {
  wsUrl: string;
  token: string;
  eventBus: EventBus;
  useMock?: boolean;
  onConnectionChange?: (state: WebSocketConnectionState) => void;
}

export interface MicrophoneCaptureOptions {
  eventBus: EventBus;
  onPcmFrame: (data: string, sampleRate: number) => void;
}

export type MicrophoneCaptureState = 'idle' | 'active' | 'mock' | 'denied' | 'error';

