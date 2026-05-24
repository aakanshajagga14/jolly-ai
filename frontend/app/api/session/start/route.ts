import { NextResponse } from 'next/server';
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

    const sessionId = crypto.randomUUID();
    const token = `mock-jwt-${sessionId}`;
    const wsUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8080/ws';

    return NextResponse.json({ sessionId, wsUrl, token });
  } catch {
    return NextResponse.json({ message: 'Failed to start session.' }, { status: 500 });
  }
}
