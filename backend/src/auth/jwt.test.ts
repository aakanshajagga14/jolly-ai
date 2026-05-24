import { verifyToken, signToken } from './jwt';

const TEST_SECRET = 'test-secret-at-least-32-chars-long!!';
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
    const payload = verifyToken(token);
    expect(payload?.sessionId).toBe('session-abc');
    expect(payload?.caseContext.caseId).toBe('case-1');
  });

  it('returns null for an invalid token', () => {
    expect(verifyToken('bad.token.here')).toBeNull();
  });

  it('returns null for a token signed with wrong secret', () => {
    const token = signToken('session-xyz', MOCK_CONTEXT);
    process.env.JWT_SECRET = 'other-secret-at-least-32-chars!!!!!';
    expect(verifyToken(token)).toBeNull();
  });
});
