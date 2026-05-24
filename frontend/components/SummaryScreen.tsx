'use client';

import type { SessionSummary } from '@/types';
import { SPEAKER_COLORS, SPEAKER_LABELS } from '@/lib/speakerColors';

interface SummaryScreenProps {
  summary: SessionSummary;
  onPlayAgain: () => void;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export default function SummaryScreen({ summary, onPlayAgain }: SummaryScreenProps) {
  const { stats, transcript, reason } = summary;

  return (
    <div className="pixel-app min-h-screen p-6">
      <div className="max-w-2xl mx-auto pixel-panel p-6">
        <h1 className="pixel-title">SESSION COMPLETE</h1>
        <p className="pixel-subtitle">Ended: {reason.toUpperCase()}</p>

        <div className="score-grid">
          <div className="score-cell">
            QUESTIONS ASKED
            <div className="score-value">{stats.questionsAsked}</div>
          </div>
          <div className="score-cell">
            OBJECTIONS SUSTAINED
            <div className="score-value">{stats.objectionsSustained}</div>
          </div>
          <div className="score-cell">
            OBJECTIONS OVERRULED
            <div className="score-value">{stats.objectionsOverruled}</div>
          </div>
          <div className="score-cell">
            WITNESS STRESS
            <div className="score-value">{stats.witnessStressReached}%</div>
          </div>
        </div>

        <p className="text-[7px] mb-3 border-b-2 border-[#eaeaea] pb-2">FULL TRANSCRIPT</p>
        <div className="max-h-80 overflow-y-auto mb-6">
          {transcript.map((entry) => (
            <div key={entry.entryId} className="transcript-line mb-4">
              <div className="mb-1">
                <span
                  className="speaker-badge"
                  style={{
                    color: SPEAKER_COLORS[entry.speaker],
                    borderColor: SPEAKER_COLORS[entry.speaker],
                  }}
                >
                  {SPEAKER_LABELS[entry.speaker]}
                </span>
                <span className="text-[6px] text-[#666]">{formatTimestamp(entry.timestamp)}</span>
              </div>
              <p className="text-[7px] leading-loose pl-1">{entry.text}</p>
            </div>
          ))}
        </div>

        <button type="button" className="pixel-btn w-full" onClick={onPlayAgain}>
          PLAY AGAIN
        </button>
      </div>
    </div>
  );
}
