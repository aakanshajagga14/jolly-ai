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
