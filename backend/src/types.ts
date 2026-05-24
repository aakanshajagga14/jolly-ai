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
  witnessStress: number;
  judgePatience: number;
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
