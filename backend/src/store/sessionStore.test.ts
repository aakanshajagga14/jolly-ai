import { createSession, getSession, destroySession } from './sessionStore';

const MOCK_CTX = {
  caseId: 'c1',
  summary: '',
  evidenceItems: [],
  keyFacts: [],
  inconsistencies: [],
};

describe('sessionStore', () => {
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
