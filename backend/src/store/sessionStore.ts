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

export function updateSession(
  sessionId: string,
  patch: Partial<Omit<ActiveSession, 'sessionId' | 'killTimer'>>
): void {
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
