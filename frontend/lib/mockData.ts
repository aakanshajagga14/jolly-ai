import type { CaseContext, CourtroomTranscriptEntry, SessionSummaryStats } from '@/types';

export const MOCK_CASE_CONTEXT: CaseContext = {
  caseId: 'case-sharma-v-state',
  summary:
    'The State alleges Mr. Sharma was identified near the scene at 9PM. The defense disputes identification reliability due to poor lighting.',
  evidenceItems: [
    {
      id: 'ev-1',
      description: 'Streetlight maintenance log — bulb out on 12 Mar',
      relevance: 'high',
    },
    {
      id: 'ev-2',
      description: 'Shop closing receipt stamped 9:45 PM',
      relevance: 'high',
    },
    {
      id: 'ev-3',
      description: 'Witness prior statement citing “bright floodlight”',
      relevance: 'medium',
    },
  ],
  keyFacts: [
    'Witness claims sighting at 9:00 PM',
    'Accused wore a dark jacket',
    'Shop on corner closes at 9:45 PM',
  ],
  inconsistencies: [
    {
      id: 'inc-1',
      description: 'Witness described bright floodlight but maintenance log shows streetlight out',
      involvedFacts: ['Witness claims sighting at 9:00 PM'],
    },
  ],
};

const SESSION_ID = 'mock-session-001';

export function makeTranscriptEntry(
  speaker: CourtroomTranscriptEntry['speaker'],
  text: string,
  timestamp: number
): CourtroomTranscriptEntry {
  return {
    entryId: crypto.randomUUID(),
    sessionId: SESSION_ID,
    speaker,
    text,
    timestamp,
  };
}

export function computeSummaryStats(
  transcript: CourtroomTranscriptEntry[]
): SessionSummaryStats {
  const questionsAsked = transcript.filter((e) => e.speaker === 'lawyer').length;
  const judgeText = transcript
    .filter((e) => e.speaker === 'judge')
    .map((e) => e.text.toLowerCase());
  const objectionsSustained = judgeText.filter((t) => t.includes('sustained')).length;
  const objectionsOverruled = judgeText.filter((t) => t.includes('overruled')).length;

  return {
    questionsAsked,
    objectionsSustained,
    objectionsOverruled,
    witnessStressReached: 65,
  };
}
