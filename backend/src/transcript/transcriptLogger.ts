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
