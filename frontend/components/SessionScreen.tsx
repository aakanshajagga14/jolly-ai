'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PhaserCanvas from '@/components/PhaserCanvas';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type {
  AgentResponseMessage,
  CaseContext,
  CoachingHint,
  CoachingHintMessage,
  CourtroomTranscriptEntry,
  SessionEndMessage,
  SessionSummary,
  ServerToClientMessage,
  SttFinalMessage,
  WebSocketConnectionState,
} from '@/types';
import { WebSocketClient } from '@/lib/WebSocketClient';
import { MicrophoneCapture } from '@/lib/MicrophoneCapture';
import { TtsPlayback } from '@/lib/TtsPlayback';
import { createEventBus } from '@/lib/eventBus';
import { computeSummaryStats } from '@/lib/mockData';
import { startSession } from '@/lib/uploadApi';
import { hintStrengthColor, SPEAKER_COLORS, SPEAKER_LABELS } from '@/lib/speakerColors';

interface SessionScreenProps {
  caseContext: CaseContext;
  onSessionEnd: (summary: SessionSummary) => void;
}

const INITIAL_SECONDS = 10 * 60;

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function SessionScreen({ caseContext, onSessionEnd }: SessionScreenProps) {
  const onSessionEndRef = useRef(onSessionEnd);
  const [transcript, setTranscript] = useState<CourtroomTranscriptEntry[]>([]);
  const [hint, setHint] = useState<CoachingHint | null>(null);
  const [micActive, setMicActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_SECONDS);
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');
  const [bootError, setBootError] = useState<string | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const eventBus = useMemo(() => createEventBus(), []);
  const wsClient = useMemo(() => new WebSocketClient(), []);
  const mic = useMemo(() => new MicrophoneCapture(), []);
  const tts = useMemo(() => new TtsPlayback(), []);

  useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
  }, [onSessionEnd]);

  useEffect(() => {
    let cancelled = false;

    const bootSession = async () => {
      try {
        const session = await startSession(caseContext);
        if (cancelled) {
          return;
        }

        wsClient.connect({
          wsUrl: session.wsUrl,
          token: session.token,
          eventBus,
          onConnectionChange: setConnectionState,
        });

        await mic.start(
          {
            eventBus,
            onPcmFrame: (data, sampleRate) => {
              wsClient.send({ type: 'AUDIO_CHUNK', data, sampleRate });
            },
          },
          () => undefined
        );
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : 'Session failed to start.');
        }
      }
    };

    void bootSession();

    const handleCoaching = (msg: CoachingHintMessage) => {
      setHint(msg.hint);
    };

    const handleMic = (payload: { active: boolean }) => {
      setMicActive(payload.active);
    };

    const handleSttFinal = (msg: SttFinalMessage) => {
      setTranscript((prev) => [
        ...prev,
        {
          entryId: crypto.randomUUID(),
          sessionId: 'live',
          speaker: 'lawyer',
          text: msg.text,
          timestamp: Date.now(),
        },
      ]);
    };

    const handleAgentResponse = (msg: AgentResponseMessage) => {
      setTranscript((prev) => [
        ...prev,
        {
          entryId: crypto.randomUUID(),
          sessionId: 'live',
          speaker: msg.speaker,
          text: msg.text,
          timestamp: Date.now(),
        },
      ]);
    };

    const handleSessionEnd = (msg: SessionEndMessage) => {
      onSessionEndRef.current({
        reason: msg.reason,
        transcript: msg.transcript,
        stats: computeSummaryStats(msg.transcript),
      });
    };

    const handleTimerUpdate = (msg: { remainingMs: number }) => {
      setSecondsLeft(Math.max(0, Math.ceil(msg.remainingMs / 1000)));
    };

    const handleVadInterrupt = () => {
      tts.stopAll();
    };

    const handleWsMessage = (msg: ServerToClientMessage) => {
      if (msg.type === 'AUDIO_CHUNK') {
        void tts.enqueueChunk(msg.data, msg.speaker);
      }
    };

    eventBus.on('coaching_hint', handleCoaching);
    eventBus.on('mic_active', handleMic);
    eventBus.on('stt_final', handleSttFinal);
    eventBus.on('agent_response', handleAgentResponse);
    eventBus.on('session_end', handleSessionEnd);
    eventBus.on('timer_update', handleTimerUpdate);
    eventBus.on('vad_interrupt', handleVadInterrupt);
    eventBus.on('ws_message', handleWsMessage);

    const timerId = setInterval(() => {
      setSecondsLeft((value) => Math.max(0, value - 1));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(timerId);
      eventBus.off('coaching_hint', handleCoaching);
      eventBus.off('mic_active', handleMic);
      eventBus.off('stt_final', handleSttFinal);
      eventBus.off('agent_response', handleAgentResponse);
      eventBus.off('session_end', handleSessionEnd);
      eventBus.off('timer_update', handleTimerUpdate);
      eventBus.off('vad_interrupt', handleVadInterrupt);
      eventBus.off('ws_message', handleWsMessage);
      wsClient.disconnect();
      mic.stop();
      tts.destroy();
    };
  }, [caseContext, eventBus, wsClient, mic, tts]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  if (bootError) {
    return (
      <div className="pixel-app flex items-center justify-center p-6">
        <div className="pixel-panel max-w-md p-6 text-center">
          <p className="pixel-error">{bootError}</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Session crashed">
      <div className="pixel-app h-screen flex flex-col">
        <header className="pixel-panel flex items-center justify-between px-4 py-3 shrink-0">
          <span className="text-[7px] truncate max-w-[35%]">{caseContext.caseId}</span>
          <span className="text-[6px] text-[#888] uppercase">{connectionState}</span>
          <span className="text-[10px] text-[#f7c948]">{formatTime(secondsLeft)}</span>
        </header>

        <div className="flex flex-1 min-h-0">
          <aside className="pixel-panel w-52 shrink-0 flex flex-col m-2 mr-0">
            <p className="text-[7px] p-2 border-b-2 border-[#eaeaea]">TRANSCRIPT</p>
            <div className="transcript-scroll">
              {transcript.map((entry) => (
                <div key={entry.entryId} className="transcript-line">
                  <span
                    className="speaker-badge"
                    style={{
                      color: SPEAKER_COLORS[entry.speaker],
                      borderColor: SPEAKER_COLORS[entry.speaker],
                    }}
                  >
                    {SPEAKER_LABELS[entry.speaker]}
                  </span>
                  {entry.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </aside>

          <main className="flex-1 flex flex-col m-2 min-w-0 relative">
            <PhaserCanvas eventBus={eventBus} />

            {hint && (
              <div className="coaching-float">
                <span
                  className="hint-badge"
                  style={{
                    color: hintStrengthColor(hint.strength),
                    borderColor: hintStrengthColor(hint.strength),
                  }}
                >
                  {hint.strength.toUpperCase()}
                </span>
                <p className="text-[7px] leading-loose">{hint.suggestion}</p>
              </div>
            )}

            <footer className="pixel-panel flex items-center px-4 py-2 mt-2 shrink-0">
              <span className={`mic-indicator ${micActive ? 'active' : 'inactive'}`} />
              <span className="text-[7px]">{micActive ? 'MIC ACTIVE' : 'MIC STANDBY'}</span>
            </footer>
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
