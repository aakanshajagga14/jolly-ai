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
      return NextResponse.json(
        { message: 'Server misconfiguration: JWT_SECRET not set.' },
        { status: 500 }
      );
    }

    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { sessionId, caseContext: body.caseContext },
      jwtSecret,
      { expiresIn: '10m' }
    );

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws';
    console.log(`[Session] Created session ${sessionId} → ${wsUrl}`);

    return NextResponse.json({ sessionId, wsUrl, token });
  } catch {
    return NextResponse.json({ message: 'Failed to start session.' }, { status: 500 });
  }
}
