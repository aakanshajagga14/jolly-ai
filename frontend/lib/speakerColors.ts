import type { CoachingHint, TranscriptSpeaker } from '@/types';

export const SPEAKER_COLORS: Record<TranscriptSpeaker, string> = {
  lawyer: '#0f3460',
  witness: '#e94560',
  judge: '#f5a623',
  system: '#888888',
};

export const SPEAKER_LABELS: Record<TranscriptSpeaker, string> = {
  lawyer: 'LAWYER',
  witness: 'WITNESS',
  judge: 'JUDGE',
  system: 'SYSTEM',
};

export function hintStrengthColor(strength: CoachingHint['strength']): string {
  switch (strength) {
    case 'strong':
      return '#4ecca3';
    case 'moderate':
      return '#f7c948';
    case 'weak':
      return '#e94560';
  }
}
