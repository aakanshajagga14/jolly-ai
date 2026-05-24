import type { ServerToClientMessage } from '@/types';
import { makeTranscriptEntry } from '@/lib/mockData';

const SESSION_ID = 'mock-session-001';
const TEN_MINUTES_MS = 600_000;

type Dispatch = (message: ServerToClientMessage) => void;

export function startMockSession(dispatch: Dispatch, sessionStartMs: number): () => void {
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  const transcript = [
    makeTranscriptEntry(
      'system',
      'Session started. Cross-examination in progress.',
      sessionStartMs
    ),
  ];

  const schedule = (delayMs: number, fn: () => void) => {
    timeouts.push(setTimeout(fn, delayMs));
  };

  schedule(0, () => {
    dispatch({
      type: 'SESSION_READY',
      sessionId: SESSION_ID,
      expiresAt: sessionStartMs + TEN_MINUTES_MS,
    });
  });

  schedule(2000, () => {
    const text = 'Mr. Sharma, you said you saw the accused at 9PM. Is that correct?';
    transcript.push(makeTranscriptEntry('lawyer', text, sessionStartMs + 2000));
    dispatch({ type: 'STT_FINAL', text });
  });

  schedule(2500, () => {
    const text = 'Yes, that is correct.';
    transcript.push(makeTranscriptEntry('witness', text, sessionStartMs + 2500));
    dispatch({ type: 'AGENT_RESPONSE', speaker: 'witness', text });
    dispatch({ type: 'ANIMATION_CMD', target: 'witness', animation: 'talking' });
  });

  schedule(5000, () => {
    dispatch({ type: 'ANIMATION_CMD', target: 'witness', animation: 'idle' });
  });

  schedule(6000, () => {
    dispatch({
      type: 'COACHING_HINT',
      hint: {
        strength: 'moderate',
        suggestion: 'Push on the lighting conditions next',
        phase: 'post-turn',
      },
    });
  });

  schedule(9000, () => {
    const text = 'What was the source of the light you saw him by?';
    transcript.push(makeTranscriptEntry('lawyer', text, sessionStartMs + 9000));
    dispatch({ type: 'STT_FINAL', text });
  });

  schedule(10000, () => {
    const text = 'There... there was a streetlight.';
    transcript.push(makeTranscriptEntry('witness', text, sessionStartMs + 10000));
    dispatch({ type: 'AGENT_RESPONSE', speaker: 'witness', text });
    dispatch({ type: 'ANIMATION_CMD', target: 'witness', animation: 'stressed' });
  });

  schedule(14000, () => {
    const text = 'Objection overruled. Continue.';
    transcript.push(makeTranscriptEntry('judge', text, sessionStartMs + 14000));
    dispatch({ type: 'AGENT_RESPONSE', speaker: 'judge', text });
    dispatch({ type: 'ANIMATION_CMD', target: 'judge', animation: 'gavel-slam' });
  });

  schedule(18000, () => {
    dispatch({
      type: 'COACHING_HINT',
      hint: {
        strength: 'strong',
        suggestion: 'Ask what time the shop closes',
        phase: 'post-turn',
      },
    });
  });

  schedule(25000, () => {
    dispatch({
      type: 'SESSION_END',
      reason: 'user',
      transcript: [...transcript],
    });
  });

  return () => {
    timeouts.forEach(clearTimeout);
  };
}
